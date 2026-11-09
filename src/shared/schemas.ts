import { z } from 'zod';

/** ids are used inside R2 keys and URLs: keep them boring. */
export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'invalid id');

export const partSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  file: z.string().min(1),
  defaultGain: z.number().min(0).max(4).default(1),
  channels: z.union([z.literal(1), z.literal(2)]).default(1),
  order: z.number().int(),
  kind: z.string().min(1),
});

export const songManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  title: z.string().min(1),
  credits: z.string().optional(),
  durationSec: z.number().positive(),
  /** Exact length at the master sample rate (ADR-0003 amendment); the engine uses this, not the decoded length. */
  durationSamples: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive(),
  parts: z.array(partSchema).min(1),
});

export const accessTokenSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars'),
  label: z.string(),
  createdAt: z.string(),
});

export const choirManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  name: z.string().min(1),
  songs: z.array(idSchema),
  accessTokens: z.array(accessTokenSchema),
});

export type Part = z.infer<typeof partSchema>;
export type SongManifest = z.infer<typeof songManifestSchema>;
export type ChoirManifest = z.infer<typeof choirManifestSchema>;
export type AccessToken = z.infer<typeof accessTokenSchema>;

/** API response shapes (what the SPA consumes). Never includes accessTokens. */
export const songSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  credits: z.string().optional(),
  durationSec: z.number(),
  partCount: z.number().int(),
});
export const choirsResponseSchema = z.object({
  choirs: z.array(z.object({ id: idSchema, name: z.string(), songs: z.array(songSummarySchema) })),
});
export type SongSummary = z.infer<typeof songSummarySchema>;
export type ChoirsResponse = z.infer<typeof choirsResponseSchema>;

/** R2 key layout (ADR-0005). */
export const songManifestKey = (songId: string) => `manifests/songs/${songId}.json`;
export const choirManifestKey = (choirId: string) => `manifests/choirs/${choirId}.json`;

/** CLI-maintained list of ids, because R2 listing is not available through wrangler. */
export const indexKey = 'manifests/index.json';
export const indexSchema = z.object({
  schemaVersion: z.literal(1),
  songs: z.array(idSchema),
  choirs: z.array(idSchema),
});
export type ContentIndex = z.infer<typeof indexSchema>;
