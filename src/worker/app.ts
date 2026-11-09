import { Hono } from 'hono';
import { idSchema, type ChoirsResponse, type ChoirManifest } from '../shared';
import { grantedChoirs, matchActiveToken } from './access';
import { keyBelongsToSong, safeAudioKey, streamAudio } from './audio';
import { sha256Hex } from './crypto';
import type { Env } from './env';
import {
  buildSetCookie,
  mergeGrant,
  readGrants,
  GRANT_TTL_SECONDS,
  TOKEN_HASH_PREFIX_LEN,
} from './grants';
import { loadChoir, loadSong } from './manifests';
import { invalidLinkPage, serverErrorPage } from './pages';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export const app = new Hono<{ Bindings: Env }>();

// Everything: noindex. (Static assets get the same via public/_headers.)
app.use('*', async (c, next) => {
  await next();
  // rebuild so headers are mutable even for fetched (immutable) responses
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set('X-Robots-Tag', 'noindex, nofollow');
});

// Misconfiguration guard: never sign/verify with a missing or weak key.
app.use('*', async (c, next) => {
  const k = c.env.COOKIE_SIGNING_KEY;
  if (typeof k !== 'string' || k.length < 32) {
    console.error('COOKIE_SIGNING_KEY missing or shorter than 32 chars');
    return c.html(serverErrorPage(), 500);
  }
  await next();
});

app.get('/robots.txt', (c) =>
  c.text('User-agent: *\nDisallow: /\n', 200, { 'Cache-Control': 'public, max-age=3600' }),
);

// Redeem a choir link.
app.get('/c/:choirId/:token', async (c) => {
  const { choirId, token } = c.req.param();
  const invalid = () =>
    c.html(invalidLinkPage(), 404, {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
  if (!idSchema.safeParse(choirId).success || !TOKEN_RE.test(token)) return invalid();

  const choir = await loadChoir(c.env, choirId);
  const hash = await sha256Hex(token);
  if (!choir || choir.id !== choirId || !matchActiveToken(choir, hash)) return invalid();

  const now = Math.floor(Date.now() / 1000);
  const existing = await readGrants(c.req.header('Cookie') ?? null, c.env.COOKIE_SIGNING_KEY, now);
  const grants = mergeGrant(existing, {
    choirId,
    tokenHashPrefix: hash.slice(0, TOKEN_HASH_PREFIX_LEN),
    exp: now + GRANT_TTL_SECONDS,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': await buildSetCookie(grants, c.env.COOKIE_SIGNING_KEY),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
});

const noAccess = (c: { json: (b: unknown, s: 401) => Response }) =>
  c.json({ error: 'no_access' }, 401);

app.use('/api/*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'private, no-store');
});

app.get('/api/choirs', async (c) => {
  const choirs = await grantedChoirs(c.env, c.req.header('Cookie') ?? null);
  if (choirs.length === 0) return noAccess(c);
  const body: ChoirsResponse = {
    choirs: await Promise.all(
      choirs.map(async (choir) => {
        const songs = await Promise.all(choir.songs.map((id) => loadSong(c.env, id)));
        return {
          id: choir.id,
          name: choir.name,
          songs: songs.flatMap((s) =>
            s
              ? [
                  {
                    id: s.id,
                    title: s.title,
                    credits: s.credits,
                    durationSec: s.durationSec,
                    partCount: s.parts.length,
                  },
                ]
              : [],
          ),
        };
      }),
    ),
  };
  return c.json(body);
});

const inAnyChoir = (choirs: ChoirManifest[], songId: string) =>
  choirs.some((ch) => ch.songs.includes(songId));

app.get('/api/songs/:songId', async (c) => {
  const songId = c.req.param('songId');
  if (!idSchema.safeParse(songId).success) return c.json({ error: 'not_found' }, 404);
  const choirs = await grantedChoirs(c.env, c.req.header('Cookie') ?? null);
  if (choirs.length === 0) return noAccess(c);
  if (!inAnyChoir(choirs, songId)) return c.json({ error: 'not_found' }, 404);
  const song = await loadSong(c.env, songId);
  if (!song || song.id !== songId) return c.json({ error: 'not_found' }, 404);
  return c.json(song);
});

app.on(['GET', 'HEAD'], '/audio/*', async (c) => {
  const parsed = safeAudioKey(new URL(c.req.url).pathname);
  if (!parsed) return c.text('Not found', 404);
  const choirs = await grantedChoirs(c.env, c.req.header('Cookie') ?? null);
  // 404 (not 403) for both "no grant" and "not your song" so existence isn't revealed.
  if (!inAnyChoir(choirs, parsed.songId)) return c.text('Not found', 404);
  if (!(await keyBelongsToSong(c.env, parsed.songId, parsed.key))) return c.text('Not found', 404);
  return streamAudio(c.env, c.req.raw, parsed.key);
});

// Anything else: static assets (SPA) when bound; otherwise 404.
app.all('*', (c) => (c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text('Not found', 404)));

app.onError((err, c) => {
  console.error(err);
  return c.html(serverErrorPage(), 500);
});
