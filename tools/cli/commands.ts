import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import {
  choirManifestKey,
  choirManifestSchema,
  indexKey,
  indexSchema,
  songManifestKey,
  songManifestSchema,
  type ChoirManifest,
  type ContentIndex,
  type SongManifest,
} from '../../src/shared';
import { decideAlignment, type PartProbe } from './align';
import { encodePart, ensureTools, isLossless, probe, sha256File } from './audio';
import {
  checkId,
  generateToken,
  hashToken,
  linkUrl,
  newChoir,
  withSong,
  withToken,
  withoutSong,
  withoutToken,
} from './choir';
import type { Target } from './env';
import { UserError } from './errors';
import { audioKey, buildSongManifest, formatZodError, parseSongYaml, scanForInit } from './song';
import type { Storage } from './storage';

export interface Ctx {
  storage: Storage;
  target: Target;
  log: (line: string) => void;
  confirm: (question: string) => Promise<boolean>;
  /** Prompt for a line of text. */
  ask: (question: string) => Promise<string>;
  /** YYYY-MM-DD */
  today: () => string;
  yes?: boolean;
}

const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + '\n');

async function readJson<T>(
  ctx: Ctx,
  key: string,
  schema: {
    safeParse(
      v: unknown,
    ): { success: true; data: T } | { success: false; error: import('zod').ZodError };
  },
): Promise<T | null> {
  const buf = await ctx.storage.get(key);
  if (!buf) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(buf.toString('utf8'));
  } catch {
    throw new UserError(`${key} in ${ctx.target.name} is not valid JSON.`);
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new UserError(formatZodError(r.error, key));
  return r.data;
}

const loadIndex = async (ctx: Ctx): Promise<ContentIndex> =>
  (await readJson(ctx, indexKey, indexSchema)) ?? { schemaVersion: 1, songs: [], choirs: [] };

async function register(ctx: Ctx, kind: 'songs' | 'choirs', id: string) {
  const idx = await loadIndex(ctx);
  if (idx[kind].includes(id)) return;
  idx[kind] = [...idx[kind], id].sort();
  await ctx.storage.put(indexKey, json(idx), 'application/json');
}

async function unregister(ctx: Ctx, id: string) {
  const idx = await loadIndex(ctx);
  if (!idx.songs.includes(id)) return;
  idx.songs = idx.songs.filter((s) => s !== id);
  await ctx.storage.put(indexKey, json(idx), 'application/json');
}

/** Real writes to prod need an explicit yes. */
async function guardWrite(ctx: Ctx) {
  if (ctx.target.name !== 'prod' || ctx.yes) return;
  if (!(await ctx.confirm('Upload to PRODUCTION? (y/N) ')))
    throw new UserError('Cancelled. Nothing was changed.');
}

function table(rows: string[][]): string {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => r[c]!.length)));
  return rows
    .map(
      (r) =>
        '  ' +
        r
          .map((cell, c) => cell.padEnd(widths[c]!))
          .join('  ')
          .trimEnd(),
    )
    .join('\n');
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// ---------- init-song ----------

export async function initSong(ctx: Ctx, folder: string, force = false) {
  const { yaml, files, skipped } = await scanForInit(folder);
  const out = join(resolve(folder), 'song.yaml');
  const exists = await stat(out).then(
    () => true,
    () => false,
  );
  if (exists && !force)
    throw new UserError(
      `${out} already exists. Edit it, or run again with --force to overwrite it.`,
    );
  await writeFile(out, yaml);
  ctx.log(`Wrote ${out} with ${files.length} parts:`);
  for (const f of files) ctx.log(`  ${f}`);
  if (skipped.length) ctx.log(`Ignored (same name as another file): ${skipped.join(', ')}`);
  ctx.log('\nNow open song.yaml and check:');
  ctx.log('  - title and credits');
  ctx.log("  - each part's label (what singers see) and order");
  ctx.log('  - "kind: accompaniment" for organ/piano parts, "voice" for singers');
  ctx.log(
    '  - stereo parts you want to keep stereo: add "channels: 2" (default is mono, which is smaller)',
  );
  ctx.log(`Then try:  pnpm choir add-song ${folder} --dry-run`);
}

// ---------- add-song ----------

export interface AddSongResult {
  manifest: SongManifest;
  uploaded: string[];
  alreadyThere: string[];
  manifestWritten: boolean;
}

export async function addSong(
  ctx: Ctx,
  folder: string,
  opts: { dryRun?: boolean; allowLossy?: boolean } = {},
): Promise<AddSongResult> {
  const dir = resolve(folder);
  const yamlPath = join(dir, 'song.yaml');
  let text: string;
  try {
    text = await readFile(yamlPath, 'utf8');
  } catch {
    throw new UserError(
      `No song.yaml in ${folder}. Create one with:\n  pnpm choir init-song ${folder}`,
    );
  }
  const song = parseSongYaml(text, yamlPath);
  await ensureTools();

  // Resolve + check files.
  const inputs = new Map<string, string>();
  for (const p of song.parts) {
    const path = resolve(dir, p.file);
    if (relative(dir, path).startsWith('..'))
      throw new UserError(`Part "${p.id}": file "${p.file}" must be inside the song folder.`);
    if (
      !(await stat(path).then(
        (s) => s.isFile(),
        () => false,
      ))
    )
      throw new UserError(`Part "${p.id}": file "${p.file}" was not found in ${folder}.`);
    inputs.set(p.id, path);
  }
  const lossy = song.parts.filter((p) => !isLossless(p.file));
  const warnings: string[] = [];
  if (lossy.length) {
    if (!opts.allowLossy)
      throw new UserError(
        `These files are lossy (MP3/AAC/etc.), so the parts may not line up exactly:\n${lossy
          .map((p) => `  ${p.file}`)
          .join(
            '\n',
          )}\nExport AIFF or WAV from GarageBand instead (see docs/adding-songs.md), or add --allow-lossy.`,
      );
    warnings.push(
      'Lossy source files in use (--allow-lossy): the parts may be slightly out of sync.',
    );
  }

  if (!opts.dryRun) await guardWrite(ctx);

  ctx.log(`Checking ${song.parts.length} parts...`);
  const probes = new Map<string, Awaited<ReturnType<typeof probe>>>();
  for (const p of song.parts) probes.set(p.id, await probe(inputs.get(p.id)!, isLossless(p.file)));
  const partProbes: PartProbe[] = song.parts.map((p) => ({
    id: p.id,
    sampleRate: probes.get(p.id)!.sampleRate,
    samples: probes.get(p.id)!.samples,
  }));
  const alignment = decideAlignment(partProbes);
  warnings.push(...alignment.warnings);

  const tmp = await mkdtemp(join(tmpdir(), 'choir-encode-'));
  try {
    const keys = new Map<string, string>();
    const sizes = new Map<string, number>();
    const encoded = new Map<string, string>();
    for (const p of song.parts) {
      ctx.log(`Encoding ${p.label}...`);
      const out = join(tmp, `${p.id}.m4a`);
      await encodePart({
        input: inputs.get(p.id)!,
        output: out,
        channels: p.channels,
        sampleRate: alignment.sampleRate,
        targetSamples: alignment.targetSamples,
      });
      const hash = (await sha256File(out)).slice(0, 12);
      keys.set(p.id, audioKey(song.id, p.id, hash));
      sizes.set(p.id, (await stat(out)).size);
      encoded.set(p.id, out);
    }
    const manifest = buildSongManifest(song, keys, alignment);

    // What is already there? Files named in the existing manifest were fully uploaded before it was written.
    let existing: SongManifest | null = null;
    try {
      existing = await readJson(ctx, songManifestKey(song.id), songManifestSchema);
    } catch (e) {
      if (!opts.dryRun) throw e;
      warnings.push(
        `Could not check what is already uploaded (${(e as Error).message.split('\n')[0]}).`,
      );
    }
    const have = new Set(existing?.parts.map((p) => p.file) ?? []);

    const uploaded: string[] = [];
    const alreadyThere: string[] = [];
    const rows = [['Part', 'Kind', 'Ch', 'Size', 'File', opts.dryRun ? 'Would' : 'Result']];
    for (const p of song.parts) {
      const key = keys.get(p.id)!;
      const isNew = !have.has(key);
      if (isNew && !opts.dryRun)
        await ctx.storage.put(key, { file: encoded.get(p.id)! }, 'audio/mp4');
      (isNew ? uploaded : alreadyThere).push(key);
      rows.push([
        p.label,
        p.kind,
        String(p.channels),
        mb(sizes.get(p.id)!),
        key,
        isNew ? (opts.dryRun ? 'upload' : 'uploaded') : 'already there',
      ]);
    }

    const same = existing && JSON.stringify(existing) === JSON.stringify(manifest);
    let manifestWritten = false;
    if (!opts.dryRun && !same) {
      await ctx.storage.put(songManifestKey(song.id), json(manifest), 'application/json');
      await register(ctx, 'songs', song.id);
      manifestWritten = true;
    }

    ctx.log('');
    ctx.log(table(rows));
    ctx.log('');
    ctx.log(
      `Song "${song.title}" (${song.id}): ${manifest.durationSec} s, ${manifest.sampleRate} Hz, ${song.parts.length} parts.`,
    );
    for (const w of warnings) ctx.log(`Warning: ${w}`);
    if (opts.dryRun) ctx.log(`Dry run on ${ctx.target.name}: nothing was uploaded.`);
    else if (uploaded.length === 0 && !manifestWritten)
      ctx.log(`Nothing to do: ${ctx.target.name} is already up to date.`);
    else
      ctx.log(
        `Done: ${uploaded.length} file(s) uploaded to ${ctx.target.name}${manifestWritten ? ', manifest written' : ''}.`,
      );
    if (!opts.dryRun)
      ctx.log(`Next: pnpm choir add-song-to-choir <choir-id> ${song.id} --env ${ctx.target.name}`);
    return { manifest, uploaded, alreadyThere, manifestWritten };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ---------- choirs ----------

async function requireChoir(ctx: Ctx, choirId: string): Promise<ChoirManifest> {
  checkId('choir', choirId);
  const choir = await readJson(ctx, choirManifestKey(choirId), choirManifestSchema);
  if (!choir) {
    const known = (await loadIndex(ctx)).choirs;
    throw new UserError(
      `There is no choir "${choirId}" on ${ctx.target.name}.` +
        (known.length ? ` Existing choirs: ${known.join(', ')}.` : '') +
        `\nCreate it with: pnpm choir add-choir ${choirId} --name "Display Name" --env ${ctx.target.name}`,
    );
  }
  return choir;
}

const saveChoir = (ctx: Ctx, c: ChoirManifest) =>
  ctx.storage.put(choirManifestKey(c.id), json(c), 'application/json');

export async function addChoir(ctx: Ctx, choirId: string, name: string | undefined) {
  if (!name)
    throw new UserError('Give the choir a display name: --name "Oak Hills 3rd Ward Choir"');
  const choir = newChoir(choirId, name);
  if (await ctx.storage.get(choirManifestKey(choirId)))
    throw new UserError(`Choir "${choirId}" already exists on ${ctx.target.name}.`);
  await guardWrite(ctx);
  await saveChoir(ctx, choir);
  await register(ctx, 'choirs', choirId);
  ctx.log(`Created choir "${name}" (${choirId}) on ${ctx.target.name}.`);
  ctx.log(`Next: pnpm choir add-song-to-choir ${choirId} <song-id> --env ${ctx.target.name}`);
  ctx.log(`      pnpm choir new-link ${choirId} --env ${ctx.target.name}`);
}

export async function addSongToChoir(ctx: Ctx, choirId: string, songId: string) {
  const choir = await requireChoir(ctx, choirId);
  checkId('song', songId);
  if (!(await ctx.storage.get(songManifestKey(songId)))) {
    const known = (await loadIndex(ctx)).songs;
    throw new UserError(
      `There is no song "${songId}" on ${ctx.target.name}.` +
        (known.length ? ` Songs there: ${known.join(', ')}.` : '') +
        `\nUpload it first: pnpm choir add-song <folder> --env ${ctx.target.name}`,
    );
  }
  const { choir: next, changed } = withSong(choir, songId);
  if (!changed) return ctx.log(`"${choirId}" already has "${songId}". Nothing to do.`);
  await guardWrite(ctx);
  await saveChoir(ctx, next);
  ctx.log(`Added "${songId}" to "${choirId}". Members see it within about a minute.`);
}

export async function removeSongFromChoir(ctx: Ctx, choirId: string, songId: string) {
  const choir = await requireChoir(ctx, choirId);
  const next = withoutSong(choir, songId);
  await guardWrite(ctx);
  await saveChoir(ctx, next);
  ctx.log(`Removed "${songId}" from "${choirId}". (The song itself is still uploaded.)`);
}

export async function newLink(ctx: Ctx, choirId: string, label: string | undefined) {
  const choir = await requireChoir(ctx, choirId);
  const finalLabel = label ?? `link ${ctx.today()}`;
  const token = generateToken();
  const next = withToken(choir, hashToken(token), finalLabel, ctx.today());
  await guardWrite(ctx);
  await saveChoir(ctx, next);
  ctx.log(
    `Created link "${finalLabel}" for "${choirId}" on ${ctx.target.name}. Share this URL with the choir:\n`,
  );
  ctx.log(`  ${linkUrl(ctx.target.host, choirId, token)}\n`);
  ctx.log(
    "This is the only time the link is shown: only a fingerprint is stored, so it can't be recovered.",
  );
  ctx.log(
    `If you lose it, make a new one. To disable this link later: pnpm choir revoke-link ${choirId} "${finalLabel}"`,
  );
}

export async function revokeLink(ctx: Ctx, choirId: string, label: string) {
  const choir = await requireChoir(ctx, choirId);
  const next = withoutToken(choir, label);
  await guardWrite(ctx);
  await saveChoir(ctx, next);
  ctx.log(`Revoked link "${label}" for "${choirId}". It stops working within about a minute.`);
  if (next.accessTokens.length === 0)
    ctx.log(
      `Note: "${choirId}" now has no active links, so nobody can get in. Make one with: pnpm choir new-link ${choirId}`,
    );
}

// ---------- list ----------

export async function list(ctx: Ctx) {
  const idx = await loadIndex(ctx);
  ctx.log(`Contents of ${ctx.target.name} (${ctx.target.bucket}):\n`);
  ctx.log('Choirs:');
  if (idx.choirs.length === 0) ctx.log('  (none)');
  for (const id of idx.choirs) {
    const c = await readJson(ctx, choirManifestKey(id), choirManifestSchema);
    if (!c) {
      ctx.log(`  ${id}  (manifest missing)`);
      continue;
    }
    ctx.log(`  ${c.id}  "${c.name}"`);
    ctx.log(`    songs: ${c.songs.join(', ') || '(none)'}`);
    ctx.log(
      `    links: ${c.accessTokens.map((t) => `"${t.label}" (${t.createdAt})`).join(', ') || '(none)'}`,
    );
  }
  ctx.log('\nSongs:');
  if (idx.songs.length === 0) ctx.log('  (none)');
  for (const id of idx.songs) {
    const s = await readJson(ctx, songManifestKey(id), songManifestSchema);
    if (!s) {
      ctx.log(`  ${id}  (manifest missing)`);
      continue;
    }
    const inChoirs: string[] = [];
    for (const cid of idx.choirs) {
      const c = await readJson(ctx, choirManifestKey(cid), choirManifestSchema);
      if (c?.songs.includes(id)) inChoirs.push(cid);
    }
    ctx.log(
      `  ${s.id}  "${s.title}"  ${s.parts.length} parts, ${s.durationSec} s  in: ${inChoirs.join(', ') || '(no choir yet)'}`,
    );
  }
}

// ---------- delete-song ----------

const pendingKey = (songId: string) => `manifests/deleting/${songId}.json`;

/**
 * Permanently delete a song and its audio.
 * Order (crash-safe): remove from choirs -> write a "deleting" record listing the audio ->
 * delete the song manifest -> delete the audio -> delete the record -> update the index.
 * Once the manifest is gone nothing can reach the audio, and the record lets a re-run finish the job.
 */
export async function deleteSong(
  ctx: Ctx,
  songId: string,
  opts: { dryRun?: boolean; fromAllChoirs?: boolean } = {},
) {
  checkId('song', songId);
  const manifest = await readJson(ctx, songManifestKey(songId), songManifestSchema);
  const pendingBuf = await ctx.storage.get(pendingKey(songId));
  const pending: { files: string[] } | null = pendingBuf
    ? JSON.parse(pendingBuf.toString('utf8'))
    : null;
  const idx = await loadIndex(ctx);

  if (!manifest && !pending) {
    if (idx.songs.includes(songId)) {
      if (!opts.dryRun) await unregister(ctx, songId);
      return ctx.log(
        `"${songId}" was already deleted from ${ctx.target.name}; cleaned it out of the index.`,
      );
    }
    throw new UserError(
      `There is no song "${songId}" on ${ctx.target.name}.` +
        (idx.songs.length ? ` Songs there: ${idx.songs.join(', ')}.` : '') +
        ' (Check --env.)',
    );
  }

  // Which choirs still list it?
  const holders: ChoirManifest[] = [];
  for (const cid of idx.choirs) {
    const c = await readJson(ctx, choirManifestKey(cid), choirManifestSchema);
    if (c?.songs.includes(songId)) holders.push(c);
  }
  if (holders.length && !opts.fromAllChoirs)
    throw new UserError(
      `Choirs still list "${songId}": ${holders.map((c) => c.id).join(', ')}.\n` +
        'Remove it from them first:\n' +
        holders
          .map(
            (c) => `  pnpm choir remove-song-from-choir ${c.id} ${songId} --env ${ctx.target.name}`,
          )
          .join('\n') +
        '\nor delete it from all of them at once by adding --from-all-choirs.',
    );

  const files = manifest ? manifest.parts.map((p) => p.file) : pending!.files;
  ctx.log(
    manifest
      ? `Song "${manifest.title}" (${songId}) on ${ctx.target.name} (${ctx.target.bucket}):`
      : `Finishing an interrupted delete of "${songId}" on ${ctx.target.name}:`,
  );
  const rows = [['Part', 'File', 'Size']];
  for (const f of files) {
    const label = manifest?.parts.find((p) => p.file === f)?.label ?? '';
    const obj = await ctx.storage.get(f);
    rows.push([label, f, obj ? mb(obj.length) : 'already gone']);
  }
  ctx.log(table(rows));
  if (holders.length) ctx.log(`Will also remove it from: ${holders.map((c) => c.id).join(', ')}.`);
  ctx.log(
    'This deletes the audio permanently. It cannot be undone (you would have to upload the song again).',
  );

  if (opts.dryRun) return ctx.log(`Dry run on ${ctx.target.name}: nothing was deleted.`);

  if (!ctx.yes) {
    if (ctx.target.name === 'prod') {
      const typed = (
        await ctx.ask(`PRODUCTION. Type the song id (${songId}) to delete it: `)
      ).trim();
      if (typed !== songId)
        throw new UserError('That did not match the song id. Cancelled; nothing was deleted.');
    } else if (!(await ctx.confirm('Delete permanently? (y/N) '))) {
      throw new UserError('Cancelled. Nothing was deleted.');
    }
  }

  for (const c of holders) await saveChoir(ctx, withoutSong(c, songId));
  if (manifest) {
    await ctx.storage.put(pendingKey(songId), json({ songId, files }), 'application/json');
    await ctx.storage.delete(songManifestKey(songId));
  }
  for (const f of files) await ctx.storage.delete(f);
  await ctx.storage.delete(pendingKey(songId));
  await unregister(ctx, songId);
  ctx.log(`Deleted "${songId}" and ${files.length} audio file(s) from ${ctx.target.name}.`);
}
