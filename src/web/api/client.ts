import type { ZodType } from 'zod';
import { choirsResponseSchema, songManifestSchema } from '../../shared';

/** Why a request failed, in terms the UI cares about. */
export type ApiFailure = 'no_access' | 'not_found' | 'failed';

export class ApiError extends Error {
  constructor(readonly reason: ApiFailure) {
    super(reason);
  }
}

async function getJson<T>(url: string, schema: ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('failed');
  }
  if (res.status === 401) throw new ApiError('no_access');
  if (res.status === 404) throw new ApiError('not_found');
  if (!res.ok) throw new ApiError('failed');
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ApiError('failed');
  return parsed.data;
}

export const fetchChoirs = () => getJson('/api/choirs', choirsResponseSchema);
export const fetchSong = (id: string) =>
  getJson(`/api/songs/${encodeURIComponent(id)}`, songManifestSchema);
