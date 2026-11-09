import { idSchema } from '../shared';
import type { Env } from './env';
import { loadSong } from './manifests';

const TYPES: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg' };

/**
 * Turn the URL path (after /audio/) into an R2 key, or null if it looks unsafe.
 * The key must also match a part file in a granted song's manifest exactly, so this is
 * defence in depth rather than the only barrier.
 */
export function safeAudioKey(rawPath: string): { key: string; songId: string } | null {
  let p: string;
  try {
    p = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (!p.startsWith('/audio/')) return null;
  const key = p.slice(1);
  if (/[\\\0]/.test(key) || key.includes('//') || key.endsWith('/')) return null;
  const segs = key.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) return null;
  if (segs.length !== 3) return null; // audio/<songId>/<file>
  const songId = segs[1]!;
  if (!idSchema.safeParse(songId).success) return null;
  return { key, songId };
}

/** Is `key` one of the part files of `songId` (and is the song in an allowed list)? */
export async function keyBelongsToSong(env: Env, songId: string, key: string): Promise<boolean> {
  const song = await loadSong(env, songId);
  return !!song && song.parts.some((p) => p.file === key);
}

export async function streamAudio(env: Env, req: Request, key: string): Promise<Response> {
  let obj: R2Object | R2ObjectBody | null;
  try {
    obj = await env.CONTENT.get(key, { range: req.headers, onlyIf: req.headers });
  } catch {
    // unsatisfiable / malformed range
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { 'Content-Range': 'bytes */*' },
    });
  }
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const headers = new Headers();
  headers.set(
    'Content-Type',
    TYPES[ext] ?? obj.httpMetadata?.contentType ?? 'application/octet-stream',
  );
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', 'private, max-age=31536000, immutable');

  if (!('body' in obj)) return new Response(null, { status: 304, headers }); // precondition: not modified

  // R2 (and miniflare) may clamp an out-of-bounds start instead of failing; enforce RFC 9110 ourselves.
  const m = /^bytes=(\d+)-/.exec(req.headers.get('range') ?? '');
  if (m && Number(m[1]) >= obj.size) {
    await obj.body.cancel();
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${obj.size}` },
    });
  }

  let status = 200;
  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (r && req.headers.has('range')) {
    let start: number;
    let length: number;
    if (r.suffix !== undefined) {
      length = Math.min(r.suffix, obj.size);
      start = obj.size - length;
    } else {
      start = r.offset ?? 0;
      length = r.length ?? obj.size - start;
    }
    length = Math.min(length, obj.size - start);
    if (start >= obj.size || length <= 0) {
      await obj.body.cancel();
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${obj.size}` },
      });
    }
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${obj.size}`);
    headers.set('Content-Length', String(length));
    status = 206;
  } else {
    headers.set('Content-Length', String(obj.size));
  }
  return new Response(req.method === 'HEAD' ? null : obj.body, { status, headers });
}
