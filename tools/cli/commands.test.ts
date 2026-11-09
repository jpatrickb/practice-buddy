import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { choirManifestSchema, songManifestSchema } from '../../src/shared';
import * as cmd from './commands';
import type { Deployment } from '../deployment';
import { targetsFor } from './env';
import { MemoryStorage } from './storage';

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

let root: string;
let storage: MemoryStorage;
let out: string[];
let confirmAnswer = true;
const DEPLOYMENT: Deployment = {
  prod: { domain: 'choir.example.org', workersDevUrl: '' },
  dev: { workersDevUrl: 'https://practice-buddy-dev.example-sub.workers.dev' },
};
const TARGETS = targetsFor(DEPLOYMENT);
const ctx = (env: 'dev' | 'prod' = 'dev', yes = false): cmd.Ctx => ({
  storage,
  target: TARGETS[env],
  log: (l) => out.push(l),
  today: () => '2026-11-08',
  yes,
  confirm: async () => confirmAnswer,
  ask: async () => '',
});

/** A song folder of sine WAVs (no real music). `seconds` per part; ids in order. */
function makeSong(name: string, parts: Record<string, number>, ext = 'wav') {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  let hz = 220;
  for (const [id, seconds] of Object.entries(parts)) {
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${hz}:sample_rate=44100:duration=${seconds}`,
      '-ac',
      '2',
      join(dir, `${id}.${ext}`),
    ]);
    hz += 110;
  }
  const lines = Object.keys(parts).map(
    (id) =>
      `  - { id: ${id}, label: ${id}, file: ${id}.${ext}${id === 'piano' ? ', kind: accompaniment, channels: 2' : ''} }`,
  );
  writeFileSync(
    join(dir, 'song.yaml'),
    `id: ${name}\ntitle: ${name}\nparts:\n${lines.join('\n')}\n`,
  );
  return dir;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'choir-test-'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
beforeEach(() => {
  storage = new MemoryStorage();
  out = [];
  confirmAnswer = true;
});

describe.skipIf(!hasFfmpeg)('add-song', () => {
  it('encodes, uploads, writes the manifest and index; is idempotent', async () => {
    const dir = makeSong('demo', { piano: 2, part1: 2, part2: 2 });
    const first = await cmd.addSong(ctx(), dir);
    expect(first.uploaded).toHaveLength(3);
    const manifest = songManifestSchema.parse(
      JSON.parse(storage.objects.get('manifests/songs/demo.json')!.toString()),
    );
    expect(manifest.durationSamples).toBe(88200);
    expect(manifest.parts.map((p) => [p.id, p.channels, p.kind])).toEqual([
      ['piano', 2, 'accompaniment'],
      ['part1', 1, 'voice'],
      ['part2', 1, 'voice'],
    ]);
    for (const p of manifest.parts) {
      expect(p.file).toMatch(/^audio\/demo\/[a-z0-9]+\.[0-9a-f]{12}\.m4a$/);
      expect(storage.objects.has(p.file)).toBe(true);
    }
    expect(JSON.parse(storage.objects.get('manifests/index.json')!.toString()).songs).toEqual([
      'demo',
    ]);

    storage.puts.length = 0;
    const second = await cmd.addSong(ctx(), dir);
    expect(second.uploaded).toEqual([]);
    expect(second.manifestWritten).toBe(false);
    expect(storage.puts).toEqual([]); // nothing uploaded at all
    expect(out.join('\n')).toContain('already up to date');
  });

  it('re-uploads only the part that changed', async () => {
    const dir = makeSong('change', { part1: 2, part2: 2 });
    await cmd.addSong(ctx(), dir);
    makeSong('change', { part1: 2, part2: 2 }); // regenerate: identical audio
    storage.puts.length = 0;
    expect((await cmd.addSong(ctx(), dir)).uploaded).toEqual([]);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=999:sample_rate=44100:duration=2',
      '-ac',
      '2',
      join(dir, 'part2.wav'),
    ]);
    const r = await cmd.addSong(ctx(), dir);
    expect(r.uploaded).toHaveLength(1);
    expect(r.uploaded[0]).toContain('/part2.');
  });

  it('re-exporting a part deletes only its old file, after the new manifest is written', async () => {
    const dir = makeSong('swap', { part1: 2, part2: 2 });
    const first = await cmd.addSong(ctx(), dir);
    const [old1, old2] = first.manifest.parts.map((p) => p.file) as [string, string];
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=999:sample_rate=44100:duration=2',
      '-ac',
      '2',
      join(dir, 'part2.wav'),
    ]);
    storage.puts.length = 0;
    const r = await cmd.addSong(ctx(), dir);
    expect(r.replaced).toEqual([old2]);
    expect(storage.deletes).toEqual([old2]);
    expect(storage.objects.has(old2)).toBe(false);
    expect(storage.objects.has(old1)).toBe(true); // unchanged part untouched
    const m = JSON.parse(storage.objects.get('manifests/songs/swap.json')!.toString());
    expect(m.parts.map((p: { file: string }) => p.file)).not.toContain(old2);
    for (const p of m.parts) expect(storage.objects.has(p.file)).toBe(true); // nothing points at missing audio
    expect(out.join('\n')).toContain('replaced (old file deleted)');
  });

  it('a delete failure for an old file is a warning, not a crash', async () => {
    const dir = makeSong('swapfail', { part1: 2 });
    const first = await cmd.addSong(ctx(), dir);
    storage.failDeleteOf.add(first.manifest.parts[0]!.file);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=999:sample_rate=44100:duration=2',
      '-ac',
      '2',
      join(dir, 'part1.wav'),
    ]);
    await cmd.addSong(ctx(), dir);
    expect(out.join('\n')).toContain('DELETE FAILED');
    expect(out.join('\n')).toContain('Could not delete these old files');
  });

  it('dry run does not delete old files', async () => {
    const dir = makeSong('swapdry', { part1: 2 });
    await cmd.addSong(ctx(), dir);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=999:sample_rate=44100:duration=2',
      '-ac',
      '2',
      join(dir, 'part1.wav'),
    ]);
    storage.puts.length = 0;
    await cmd.addSong(ctx(), dir, { dryRun: true });
    expect(storage.deletes).toEqual([]);
    expect(storage.puts).toEqual([]);
    expect(out.join('\n')).toContain('replaced (would delete old file)');
  });

  it('dry run uploads nothing', async () => {
    const dir = makeSong('dry', { part1: 2 });
    await cmd.addSong(ctx(), dir, { dryRun: true });
    expect(storage.puts).toEqual([]);
    expect(out.join('\n')).toContain('nothing was uploaded');
  });

  it('pads a part that is a little short (with a warning)', async () => {
    const dir = makeSong('pad', { part1: 2, part2: 1.8 });
    await cmd.addSong(ctx(), dir, { dryRun: true });
    expect(out.join('\n')).toMatch(/Warning: part2 is .* shorter/);
  });

  it('fails when lengths differ by 1 s or more', async () => {
    const dir = makeSong('bad', { part1: 3, part2: 1.5 });
    await expect(cmd.addSong(ctx(), dir)).rejects.toThrow(/not the same length/);
    expect(storage.puts).toEqual([]);
  });

  it('rejects lossy sources unless --allow-lossy', async () => {
    const dir = makeSong('lossy', { part1: 2 }, 'mp3');
    await expect(cmd.addSong(ctx(), dir)).rejects.toThrow(/lossy/);
    await expect(
      cmd.addSong(ctx(), dir, { allowLossy: true, dryRun: true }),
    ).resolves.toBeDefined();
  });

  it('gives friendly errors for a missing song.yaml and a missing file', async () => {
    const empty = join(root, 'empty');
    mkdirSync(empty);
    await expect(cmd.addSong(ctx(), empty)).rejects.toThrow(/init-song/);
    const dir = makeSong('missing', { part1: 2 });
    rmSync(join(dir, 'part1.wav'));
    await expect(cmd.addSong(ctx(), dir)).rejects.toThrow(/was not found/);
  });

  it('asks before touching prod, and honours "no"', async () => {
    const dir = makeSong('prodsong', { part1: 2 });
    confirmAnswer = false;
    await expect(cmd.addSong(ctx('prod'), dir)).rejects.toThrow(/Cancelled/);
    expect(storage.puts).toEqual([]);
    confirmAnswer = true;
    await cmd.addSong(ctx('prod'), dir);
    expect(storage.puts.length).toBeGreaterThan(0);
  });

  it('init-song writes a song.yaml that add-song accepts', async () => {
    const dir = makeSong('initme', { organ: 2, tenor: 2, soprano: 2 });
    rmSync(join(dir, 'song.yaml'));
    await cmd.initSong(ctx(), dir);
    const r = await cmd.addSong(ctx(), dir, { dryRun: true });
    expect(r.manifest.parts.map((p) => [p.id, p.kind])).toEqual([
      ['organ', 'accompaniment'],
      ['soprano', 'voice'],
      ['tenor', 'voice'],
    ]);
    await expect(cmd.initSong(ctx(), dir)).rejects.toThrow(/already exists/);
  });
});

describe('choirs and links', () => {
  beforeEach(async () => {
    storage.objects.set(
      'manifests/songs/s1.json',
      Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          id: 's1',
          title: 'S1',
          durationSec: 1,
          sampleRate: 44100,
          parts: [
            {
              id: 'a',
              label: 'A',
              file: 'audio/s1/a.123456789abc.m4a',
              defaultGain: 1,
              channels: 1,
              order: 0,
              kind: 'voice',
            },
          ],
        }),
      ),
    );
    await cmd.addChoir(ctx(), 'oak', 'Oak Hills');
  });
  const choir = () =>
    choirManifestSchema.parse(
      JSON.parse(storage.objects.get('manifests/choirs/oak.json')!.toString()),
    );

  it('creates a choir once', async () => {
    await expect(cmd.addChoir(ctx(), 'oak', 'Again')).rejects.toThrow(/already exists/);
    await expect(cmd.addChoir(ctx(), 'x', undefined)).rejects.toThrow(/--name/);
  });

  it('adds/removes songs; unknown choir/song give guidance', async () => {
    await cmd.addSongToChoir(ctx(), 'oak', 's1');
    expect(choir().songs).toEqual(['s1']);
    await cmd.removeSongFromChoir(ctx(), 'oak', 's1');
    expect(choir().songs).toEqual([]);
    await expect(cmd.addSongToChoir(ctx(), 'nope', 's1')).rejects.toThrow(
      /no choir "nope".*Existing choirs: oak/s,
    );
    await expect(cmd.addSongToChoir(ctx(), 'oak', 'nope')).rejects.toThrow(/Upload it first/);
  });

  it('new-link prints the URL once and stores only the hash', async () => {
    await cmd.newLink(ctx(), 'oak', 'Spring');
    const url = out
      .join('\n')
      .match(
        /https:\/\/practice-buddy-dev\.example-sub\.workers\.dev\/c\/oak\/([A-Za-z0-9_-]{22})/,
      );
    expect(url).not.toBeNull();
    const token = url![1]!;
    const stored = storage.objects.get('manifests/choirs/oak.json')!.toString();
    expect(stored).not.toContain(token);
    expect(choir().accessTokens[0]).toMatchObject({
      label: 'Spring',
      createdAt: '2026-11-08',
      sha256: (await import('./choir')).hashToken(token),
    });
    out.length = 0;
    await cmd.list(ctx());
    expect(out.join('\n')).not.toContain(token);
    expect(out.join('\n')).toContain('"Spring"');
  });

  it('prod links use the prod host', async () => {
    out.length = 0;
    await cmd.newLink(ctx('prod', true), 'oak', undefined);
    expect(out.join('\n')).toContain('https://choir.example.org/c/oak/');
    expect(out.join('\n')).toContain('link 2026-11-08');
  });

  it('prints only the path (and says so) when deployment.json has no address yet', async () => {
    const empty = targetsFor({
      prod: { domain: '', workersDevUrl: '' },
      dev: { workersDevUrl: '' },
    });
    await cmd.newLink({ ...ctx(), target: empty.dev }, 'oak', 'NoHost');
    const text = out.join('\n');
    expect(text).toMatch(/\n {2}\/c\/oak\/[A-Za-z0-9_-]{22}\n/);
    expect(text).toContain('deployment.json has no dev workersDevUrl yet');
  });

  it('revokes a link by label', async () => {
    await cmd.newLink(ctx(), 'oak', 'A');
    await cmd.newLink(ctx(), 'oak', 'B');
    await cmd.revokeLink(ctx(), 'oak', 'A');
    expect(choir().accessTokens.map((t) => t.label)).toEqual(['B']);
    await expect(cmd.revokeLink(ctx(), 'oak', 'A')).rejects.toThrow(/no link labelled/);
  });
});
