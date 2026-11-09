import { describe, expect, it } from 'vitest';
import { choirManifestSchema, songManifestSchema } from './schemas';

const song = {
  schemaVersion: 1,
  id: 'candlelight-carol',
  title: 'Candlelight Carol',
  credits: 'John Rutter',
  durationSec: 213.3,
  sampleRate: 44100,
  parts: [
    {
      id: 'organ',
      label: 'Organ',
      file: 'audio/candlelight-carol/organ.ab12cd34ef56.m4a',
      defaultGain: 1.0,
      channels: 1,
      order: 0,
      kind: 'accompaniment',
    },
    {
      id: 'part-1',
      label: 'Anything Goes',
      file: 'x',
      defaultGain: 1,
      channels: 2,
      order: 1,
      kind: 'voice',
    },
  ],
};
const choir = {
  schemaVersion: 1,
  id: 'oak-hills-3rd',
  name: 'Oak Hills 3rd Ward Choir',
  songs: ['candlelight-carol'],
  accessTokens: [{ sha256: 'a'.repeat(64), label: '2026 link', createdAt: '2026-11-08' }],
};

describe('manifest schemas (ADR-0005)', () => {
  it('accepts the ADR examples; part labels are free-form', () => {
    expect(songManifestSchema.parse(song).parts).toHaveLength(2);
    expect(choirManifestSchema.parse(choir).accessTokens).toHaveLength(1);
  });
  it('rejects unknown schemaVersion, bad ids, bad hashes, empty parts', () => {
    expect(songManifestSchema.safeParse({ ...song, schemaVersion: 2 }).success).toBe(false);
    expect(songManifestSchema.safeParse({ ...song, id: '../x' }).success).toBe(false);
    expect(songManifestSchema.safeParse({ ...song, parts: [] }).success).toBe(false);
    expect(
      choirManifestSchema.safeParse({
        ...choir,
        accessTokens: [{ sha256: 'zz', label: '', createdAt: '' }],
      }).success,
    ).toBe(false);
  });
});
