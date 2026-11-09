import { readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { idSchema, songManifestSchema, type SongManifest } from '../../src/shared';
import { AUDIO_EXT } from './audio';
import { UserError } from './errors';
import type { Alignment } from './align';

export const songYamlSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    credits: z.string().optional(),
    parts: z
      .array(
        z
          .object({
            id: idSchema,
            label: z.string().min(1),
            file: z.string().min(1),
            kind: z.enum(['voice', 'accompaniment']).default('voice'),
            channels: z.union([z.literal(1), z.literal(2)]).default(1),
            defaultGain: z.number().min(0).max(4).default(1),
          })
          .strict(),
      )
      .min(1, 'list at least one part'),
  })
  .strict()
  .superRefine((song, ctx) => {
    const dup = (vals: string[]) => vals.find((v, i) => vals.indexOf(v) !== i);
    const id = dup(song.parts.map((p) => p.id));
    if (id)
      ctx.addIssue({ code: 'custom', message: `two parts share the id "${id}"`, path: ['parts'] });
    const file = dup(song.parts.map((p) => p.file));
    if (file)
      ctx.addIssue({
        code: 'custom',
        message: `two parts use the file "${file}"`,
        path: ['parts'],
      });
  });

export type SongYaml = z.infer<typeof songYamlSchema>;

export function formatZodError(err: z.ZodError, where: string): string {
  const lines = err.issues.map(
    (i) => `  ${i.path.length ? i.path.join('.') : '(top)'}: ${i.message}`,
  );
  return `${where} has problems:\n${lines.join('\n')}`;
}

export function parseSongYaml(text: string, where = 'song.yaml'): SongYaml {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    throw new UserError(`${where} is not valid YAML: ${(e as Error).message}`);
  }
  const r = songYamlSchema.safeParse(raw);
  if (!r.success) throw new UserError(formatZodError(r.error, where));
  return r.data;
}

// ---------- init-song ----------

const ACCOMPANIMENT = /organ|piano|accomp|keyboard|instrument|band|orchestra|track/i;
// Conventional order for common voice names; anything else sorts after, naturally (Part 2 before Part 10).
const VOICE_RANK = ['soprano', 'alto', 'tenor', 'baritone', 'bass'];

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function orderParts(names: string[]): string[] {
  const rank = (n: string) => {
    if (ACCOMPANIMENT.test(n)) return -1;
    const i = VOICE_RANK.indexOf(n.toLowerCase());
    return i === -1 ? VOICE_RANK.length : i;
  };
  return [...names].sort(
    (a, b) =>
      rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

/** Text of a starter song.yaml for the audio files found in `folder`. */
export async function scanForInit(
  folder: string,
): Promise<{ yaml: string; files: string[]; skipped: string[] }> {
  const dir = resolve(folder);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    throw new UserError(`Can't read the folder "${folder}". Does it exist?`);
  }
  const audio = entries
    .filter(
      (e) => e.isFile() && !e.name.startsWith('.') && AUDIO_EXT.has(extname(e.name).toLowerCase()),
    )
    .map((e) => e.name);
  if (audio.length === 0)
    throw new UserError(`No audio files (.aif, .aiff, .wav, .flac) found in "${folder}".`);
  const byStem = new Map<string, string>();
  const skipped: string[] = [];
  for (const f of audio) {
    const stem = basename(f, extname(f));
    if (byStem.has(stem)) skipped.push(f);
    else byStem.set(stem, f);
  }
  const ordered = orderParts([...byStem.keys()]);
  const id = slug(basename(dir)) || 'my-song';
  const lines = [
    `# Check this file, then run:  pnpm choir add-song ${folder}`,
    `id: ${id}            # lowercase letters, numbers and dashes; used in URLs, don't change it later`,
    `title: ${JSON.stringify(titleCase(basename(dir)))}`,
    `credits: ""          # e.g. composer or arranger (optional)`,
    `parts:               # the order here is the order in the player`,
  ];
  for (const stem of ordered) {
    const kind = ACCOMPANIMENT.test(stem) ? 'accompaniment' : 'voice';
    lines.push(
      `  - { id: ${slug(stem) || 'part'}, label: ${JSON.stringify(titleCase(stem))}, file: ${JSON.stringify(byStem.get(stem))}, kind: ${kind} }`,
    );
  }
  lines.push(
    '',
    '# Optional per part: channels: 2 (keep stereo), defaultGain: 0.8 (quieter by default)',
  );
  return { yaml: lines.join('\n') + '\n', files: ordered.map((s) => byStem.get(s)!), skipped };
}

// ---------- manifest ----------

export function buildSongManifest(
  song: SongYaml,
  files: Map<string, string>, // part id -> R2 key
  alignment: Alignment,
): SongManifest {
  const manifest = {
    schemaVersion: 1 as const,
    id: song.id,
    title: song.title,
    ...(song.credits ? { credits: song.credits } : {}),
    durationSec: Math.round((alignment.targetSamples / alignment.sampleRate) * 1000) / 1000,
    durationSamples: alignment.targetSamples,
    sampleRate: alignment.sampleRate,
    parts: song.parts.map((p, order) => ({
      id: p.id,
      label: p.label,
      file: files.get(p.id)!,
      defaultGain: p.defaultGain,
      channels: p.channels,
      order,
      kind: p.kind,
    })),
  };
  return songManifestSchema.parse(manifest);
}

export const audioKey = (songId: string, partId: string, hash12: string) =>
  `audio/${songId}/${partId}.${hash12}.m4a`;
