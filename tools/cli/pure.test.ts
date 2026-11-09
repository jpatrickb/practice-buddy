import { describe, expect, it } from 'vitest';
import { decideAlignment } from './align';
import {
  generateToken,
  hashToken,
  linkUrl,
  newChoir,
  withSong,
  withToken,
  withoutSong,
  withoutToken,
} from './choir';
import { UserError } from './errors';
import { buildSongManifest, orderParts, parseSongYaml, titleCase } from './song';

const yaml = `
id: demo
title: Demo
credits: Someone
parts:
  - { id: organ, label: Organ, file: organ.aif, kind: accompaniment, channels: 2 }
  - { id: soprano, label: Soprano, file: soprano.aif }
`;

describe('alignment (ADR-0003)', () => {
  const p = (id: string, samples: number, sampleRate = 44100) => ({ id, samples, sampleRate });
  it('equal lengths: no warnings', () => {
    expect(decideAlignment([p('a', 1000), p('b', 1000)])).toEqual({
      sampleRate: 44100,
      targetSamples: 1000,
      warnings: [],
    });
  });
  it('under 1 s apart: pads to the longest and warns', () => {
    const r = decideAlignment([p('a', 44100 * 10), p('b', 44100 * 10 - 500)]);
    expect(r.targetSamples).toBe(441000);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('b is');
  });
  it('1 s or more apart: fails with a fix', () => {
    expect(() => decideAlignment([p('a', 441000), p('b', 441000 - 44100)])).toThrow(/cycle region/);
  });
  it('different sample rates fail', () => {
    expect(() => decideAlignment([p('a', 10, 44100), p('b', 10, 48000)])).toThrow(/sample rates/);
  });
});

describe('song.yaml', () => {
  it('parses with defaults', () => {
    const s = parseSongYaml(yaml);
    expect(s.parts[1]).toMatchObject({ kind: 'voice', channels: 1, defaultGain: 1 });
  });
  it.each([
    ['unknown key (typo)', yaml.replace('title:', 'titel:')],
    ['bad id', yaml.replace('id: demo', 'id: Demo Song')],
    ['bad kind', yaml.replace('kind: accompaniment', 'kind: drums')],
    ['duplicate part id', yaml.replace('id: soprano', 'id: organ')],
    ['no parts', 'id: demo\ntitle: T\nparts: []'],
    ['not yaml', 'a: [1,'],
  ])('rejects %s with a UserError', (_n, text) => {
    expect(() => parseSongYaml(text)).toThrow(UserError);
  });
  it('orders accompaniment first, common voices conventionally, others naturally', () => {
    expect(orderParts(['bass', 'tenor', 'organ', 'soprano', 'alto', 'baritone'])).toEqual([
      'organ',
      'soprano',
      'alto',
      'tenor',
      'baritone',
      'bass',
    ]);
    expect(orderParts(['part-10', 'part-2', 'piano', 'part-1'])).toEqual([
      'piano',
      'part-1',
      'part-2',
      'part-10',
    ]);
    expect(titleCase('part-1_high')).toBe('Part 1 High');
  });
  it('builds a valid manifest with durationSamples and part order', () => {
    const m = buildSongManifest(
      parseSongYaml(yaml),
      new Map([
        ['organ', 'audio/demo/organ.aaaaaaaaaaaa.m4a'],
        ['soprano', 'audio/demo/soprano.bbbbbbbbbbbb.m4a'],
      ]),
      { sampleRate: 44100, targetSamples: 9404805, warnings: [] },
    );
    expect(m).toMatchObject({
      schemaVersion: 1,
      durationSamples: 9404805,
      durationSec: 213.261,
      sampleRate: 44100,
    });
    expect(m.parts.map((x) => [x.id, x.order, x.channels, x.kind])).toEqual([
      ['organ', 0, 2, 'accompaniment'],
      ['soprano', 1, 1, 'voice'],
    ]);
  });
});

describe('choirs and tokens', () => {
  it('token is 128-bit base64url; hash is sha256 hex (known vector)', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(generateToken()).not.toBe(generateToken());
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(linkUrl('https://h', 'c1', 't')).toBe('https://h/c/c1/t');
  });
  it('adds/removes songs and links', () => {
    let c = newChoir('oak', 'Oak');
    c = withSong(c, 's1').choir;
    expect(withSong(c, 's1').changed).toBe(false);
    expect(() => withoutSong(c, 'nope')).toThrow(UserError);
    expect(withoutSong(c, 's1').songs).toEqual([]);
    c = withToken(c, 'h'.repeat(64), '2026 link', '2026-01-01');
    expect(() => withToken(c, 'x', '2026 link', '2026-01-02')).toThrow(/already has a link/);
    expect(() => withoutToken(c, 'missing')).toThrow(/no link labelled/);
    expect(withoutToken(c, '2026 link').accessTokens).toEqual([]);
  });
  it('rejects bad choir ids', () => {
    expect(() => newChoir('Bad Id', 'x')).toThrow(UserError);
  });
});
