import { env as rawEnv } from 'cloudflare:workers';
import { app } from '../src/worker/app';
import type { Env } from '../src/worker/env';
import { sha256Hex, signPayload } from '../src/worker/crypto';
import { COOKIE_NAME } from '../src/worker/grants';

export const env = rawEnv as unknown as Env;
export const SECRET = env.COOKIE_SIGNING_KEY;
export const TOKEN_A = 'tokenAAAAAAAAAAAAAAAAAAAA';
export const TOKEN_B = 'tokenBBBBBBBBBBBBBBBBBBBB';
export const AUDIO_BYTES = new Uint8Array(1000).map((_, i) => i % 251);

const bucket = () => env.CONTENT;

export function song(id: string, partFiles: string[] = [`audio/${id}/alto.abc123.m4a`]) {
  return {
    schemaVersion: 1,
    id,
    title: `Song ${id}`,
    credits: 'Test',
    durationSec: 10,
    sampleRate: 44100,
    parts: partFiles.map((file, i) => ({
      id: `p${i}`,
      label: `Part ${i}`,
      file,
      defaultGain: 1,
      channels: 1,
      order: i,
      kind: 'voice',
    })),
  };
}

export async function choir(id: string, songs: string[], tokens: string[]) {
  return {
    schemaVersion: 1,
    id,
    name: `Choir ${id}`,
    songs,
    accessTokens: await Promise.all(
      tokens.map(async (t) => ({
        sha256: await sha256Hex(t),
        label: 'test',
        createdAt: '2026-01-01',
      })),
    ),
  };
}

export async function put(key: string, body: unknown) {
  await bucket().put(
    key,
    typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body),
  );
}

/** Fixture: choir "alpha" (song-one, token A), choir "beta" (song-two, token B); song-three in no choir. */
export async function seed() {
  await put('manifests/songs/song-one.json', song('song-one'));
  await put('manifests/songs/song-two.json', song('song-two'));
  await put('manifests/songs/song-three.json', song('song-three'));
  await put('manifests/choirs/alpha.json', await choir('alpha', ['song-one'], [TOKEN_A]));
  await put('manifests/choirs/beta.json', await choir('beta', ['song-two'], [TOKEN_B]));
  for (const s of ['song-one', 'song-two', 'song-three'])
    await put(`audio/${s}/alto.abc123.m4a`, AUDIO_BYTES);
}

export const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  app.fetch(
    new Request(`https://practice.test${path}`, {
      redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
    }),
    env,
  );

/** `name=value` from a Set-Cookie header, reusable as a Cookie header. */
export function cookieFrom(res: Response): string {
  return (res.headers.get('Set-Cookie') ?? '').split(';')[0]!;
}

export async function redeem(choirId: string, token: string, existing?: string) {
  const res = await get(`/c/${choirId}/${token}`, existing);
  return { res, cookie: cookieFrom(res) };
}

/** Forge a correctly signed cookie with arbitrary grants. */
export async function signedCookie(grants: unknown[]) {
  return `${COOKIE_NAME}=${await signPayload(JSON.stringify({ v: 1, grants }), SECRET)}`;
}
export const prefix = async (t: string) => (await sha256Hex(t)).slice(0, 16);
