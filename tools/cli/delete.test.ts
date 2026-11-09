import { beforeEach, describe, expect, it } from 'vitest';
import * as cmd from './commands';
import { TARGETS } from './env';
import { MemoryStorage } from './storage';

let storage: MemoryStorage;
let out: string[];
let answers: { confirm: boolean; ask: string };
const ctx = (env: 'dev' | 'prod' = 'dev', yes = false): cmd.Ctx => ({
  storage,
  target: TARGETS[env],
  log: (l) => out.push(l),
  today: () => '2026-11-08',
  yes,
  confirm: async () => answers.confirm,
  ask: async () => answers.ask,
});

const FILES = ['audio/carol/organ.aaaaaaaaaaaa.m4a', 'audio/carol/alto.bbbbbbbbbbbb.m4a'];
const put = (k: string, v: unknown) =>
  storage.objects.set(k, Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v)));
const has = (k: string) => storage.objects.has(k);
const readJson = (k: string) => JSON.parse(storage.objects.get(k)!.toString());
const choir = (id: string, songs: string[]) => ({
  schemaVersion: 1,
  id,
  name: id,
  songs,
  accessTokens: [],
});

beforeEach(() => {
  storage = new MemoryStorage();
  out = [];
  answers = { confirm: true, ask: 'carol' };
  put('manifests/songs/carol.json', {
    schemaVersion: 1,
    id: 'carol',
    title: 'Carol',
    durationSec: 1,
    sampleRate: 44100,
    parts: FILES.map((file, order) => ({
      id: file.split('/')[2]!.split('.')[0],
      label: `P${order}`,
      file,
      defaultGain: 1,
      channels: 1,
      order,
      kind: 'voice',
    })),
  });
  put('manifests/songs/keep.json', {
    schemaVersion: 1,
    id: 'keep',
    title: 'Keep',
    durationSec: 1,
    sampleRate: 44100,
    parts: [
      {
        id: 'a',
        label: 'A',
        file: 'audio/keep/a.cccccccccccc.m4a',
        defaultGain: 1,
        channels: 1,
        order: 0,
        kind: 'voice',
      },
    ],
  });
  for (const f of [...FILES, 'audio/keep/a.cccccccccccc.m4a']) put(f, Buffer.alloc(1024));
  put('manifests/choirs/oak.json', choir('oak', ['carol', 'keep']));
  put('manifests/choirs/elm.json', choir('elm', ['keep']));
  put('manifests/index.json', {
    schemaVersion: 1,
    songs: ['carol', 'keep'],
    choirs: ['elm', 'oak'],
  });
});

describe('delete-song', () => {
  it('refuses while a choir lists the song, naming it and the exact command', async () => {
    await expect(cmd.deleteSong(ctx(), 'carol')).rejects.toThrow(
      /oak[\s\S]*pnpm choir remove-song-from-choir oak carol --env dev[\s\S]*--from-all-choirs/,
    );
    expect(storage.deletes).toEqual([]);
    expect(has('manifests/songs/carol.json')).toBe(true);
  });

  it('deletes manifest, every audio file and the index entry once no choir lists it', async () => {
    put('manifests/choirs/oak.json', choir('oak', ['keep']));
    await cmd.deleteSong(ctx(), 'carol');
    expect(has('manifests/songs/carol.json')).toBe(false);
    for (const f of FILES) expect(has(f)).toBe(false);
    expect(has('manifests/deleting/carol.json')).toBe(false);
    expect(readJson('manifests/index.json').songs).toEqual(['keep']);
    // other songs untouched
    expect(has('manifests/songs/keep.json')).toBe(true);
    expect(has('audio/keep/a.cccccccccccc.m4a')).toBe(true);
    // manifest goes before any audio
    expect(storage.deletes[0]).toBe('manifests/songs/carol.json');
  });

  it('--from-all-choirs removes it from every choir first', async () => {
    await cmd.deleteSong(ctx(), 'carol', { fromAllChoirs: true });
    expect(readJson('manifests/choirs/oak.json').songs).toEqual(['keep']);
    expect(readJson('manifests/choirs/elm.json').songs).toEqual(['keep']);
    expect(has('manifests/songs/carol.json')).toBe(false);
  });

  it('dry run shows titles/sizes and changes nothing', async () => {
    await cmd.deleteSong(ctx(), 'carol', { dryRun: true, fromAllChoirs: true });
    expect(storage.deletes).toEqual([]);
    expect(storage.puts).toEqual([]);
    const text = out.join('\n');
    expect(text).toContain('"Carol"');
    expect(text).toContain('0.0 MB');
    expect(text).toContain('Will also remove it from: oak');
    expect(text).toContain('nothing was deleted');
  });

  it('asks y/N on dev and cancels on "no"', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    answers.confirm = false;
    await expect(cmd.deleteSong(ctx(), 'carol')).rejects.toThrow(/Cancelled/);
    expect(storage.deletes).toEqual([]);
  });

  it('prod requires typing the song id; --yes skips it', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    answers.ask = 'wrong';
    await expect(cmd.deleteSong(ctx('prod'), 'carol')).rejects.toThrow(/did not match/);
    expect(storage.deletes).toEqual([]);
    answers.ask = 'carol';
    await cmd.deleteSong(ctx('prod'), 'carol');
    expect(has('manifests/songs/carol.json')).toBe(false);
  });

  it('prod with --yes does not prompt', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    answers = { confirm: false, ask: 'nope' };
    await cmd.deleteSong(ctx('prod', true), 'carol');
    expect(has('manifests/songs/carol.json')).toBe(false);
  });

  it('re-running after a partial failure finishes the job', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    storage.failDeleteOf.add(FILES[1]!);
    await expect(cmd.deleteSong(ctx(), 'carol')).rejects.toThrow(/simulated failure/);
    // manifest already gone (nothing can reach the audio), second file still there, record kept for the re-run
    expect(has('manifests/songs/carol.json')).toBe(false);
    expect(has(FILES[0]!)).toBe(false);
    expect(has(FILES[1]!)).toBe(true);
    expect(has('manifests/deleting/carol.json')).toBe(true);
    expect(readJson('manifests/index.json').songs).toContain('carol');

    storage.failDeleteOf.clear();
    out.length = 0;
    await cmd.deleteSong(ctx(), 'carol');
    expect(out.join('\n')).toContain('Finishing an interrupted delete');
    expect(has(FILES[1]!)).toBe(false);
    expect(has('manifests/deleting/carol.json')).toBe(false);
    expect(readJson('manifests/index.json').songs).toEqual(['keep']);
  });

  it('re-running when everything is gone is harmless; unknown songs get a hint', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    await cmd.deleteSong(ctx(), 'carol');
    await expect(cmd.deleteSong(ctx(), 'carol')).rejects.toThrow(
      /no song "carol".*Songs there: keep/s,
    );
  });

  it('cleans a stale index entry whose files are already gone', async () => {
    put('manifests/choirs/oak.json', choir('oak', []));
    storage.objects.delete('manifests/songs/carol.json');
    await cmd.deleteSong(ctx(), 'carol');
    expect(readJson('manifests/index.json').songs).toEqual(['keep']);
  });
});
