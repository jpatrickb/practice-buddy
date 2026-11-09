import type { ZodType } from 'zod';
import {
  choirManifestKey,
  choirManifestSchema,
  songManifestKey,
  songManifestSchema,
  type ChoirManifest,
  type SongManifest,
} from '../shared';
import type { Env } from './env';

interface Entry<T> {
  expires: number;
  value: T | null;
}
const cache = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

export function clearManifestCache(): void {
  cache.clear();
}

function ttlMs(env: Env): number {
  const n = Number(env.MANIFEST_TTL_SECONDS ?? 60);
  return Number.isFinite(n) && n >= 0 ? n * 1000 : 60_000;
}

/** Read + Zod-validate a manifest from R2, cached in-isolate for ~60 s. Invalid/missing -> null. */
async function load<T>(env: Env, key: string, schema: ZodType<T>): Promise<T | null> {
  const ttl = ttlMs(env);
  const now = Date.now();
  const hit = cache.get(key) as Entry<T> | undefined;
  if (ttl > 0 && hit && hit.expires > now) return hit.value;

  let value: T | null = null;
  const obj = await env.CONTENT.get(key);
  if (obj) {
    try {
      const parsed = schema.safeParse(await obj.json());
      if (parsed.success) value = parsed.data;
      else console.warn(`manifest ${key} failed validation`);
    } catch {
      console.warn(`manifest ${key} is not valid JSON`);
    }
  }
  if (ttl > 0) {
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(key, { expires: now + ttl, value });
  }
  return value;
}

export const loadChoir = (env: Env, id: string): Promise<ChoirManifest | null> =>
  load(env, choirManifestKey(id), choirManifestSchema);

export const loadSong = (env: Env, id: string): Promise<SongManifest | null> =>
  load(env, songManifestKey(id), songManifestSchema);
