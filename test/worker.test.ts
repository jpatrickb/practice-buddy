import { beforeEach, describe, expect, it } from 'vitest';
import { clearManifestCache } from '../src/worker/manifests';
import { sha256Hex } from '../src/worker/crypto';
import {
  AUDIO_BYTES,
  env,
  TOKEN_A,
  TOKEN_B,
  choir,
  cookieFrom,
  get,
  prefix,
  put,
  redeem,
  seed,
  signedCookie,
} from './helpers';

const now = () => Math.floor(Date.now() / 1000);

beforeEach(async () => {
  clearManifestCache();
  await seed();
});

describe('link redemption', () => {
  it('valid token sets a hardened cookie and redirects to /', async () => {
    const { res } = await redeem('alpha', TOKEN_A);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    const sc = res.headers.get('Set-Cookie')!;
    expect(sc).toMatch(/^__Host-pb_grants=/);
    for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', `Max-Age=${365 * 86400}`])
      expect(sc).toContain(a);
    expect(sc).not.toContain(TOKEN_A);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('invalid token -> friendly page, no cookie', async () => {
    const res = await get('/c/alpha/wrongtokenwrongtoken1234');
    expect(res.status).toBe(404);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(await res.text()).toContain('Ask your choir director for a new one');
  });

  it('token for another choir, unknown choir, malformed token and bad ids are rejected', async () => {
    for (const p of [
      `/c/alpha/${TOKEN_B}`,
      `/c/nochoir/${TOKEN_A}`,
      '/c/alpha/short',
      `/c/..%2Falpha/${TOKEN_A}`,
      `/c/ALPHA/${TOKEN_A}`,
    ]) {
      const res = await get(p);
      expect(res.status, p).toBe(404);
      expect(res.headers.get('Set-Cookie')).toBeNull();
    }
  });

  it('revoked token (removed from manifest) cannot be redeemed', async () => {
    await put('manifests/choirs/alpha.json', await choir('alpha', ['song-one'], [TOKEN_B]));
    expect((await get(`/c/alpha/${TOKEN_A}`)).status).toBe(404);
  });

  it('multiple active tokens all work (rotation)', async () => {
    await put(
      'manifests/choirs/alpha.json',
      await choir('alpha', ['song-one'], [TOKEN_A, TOKEN_B]),
    );
    expect((await get(`/c/alpha/${TOKEN_A}`)).status).toBe(302);
    expect((await get(`/c/alpha/${TOKEN_B}`)).status).toBe(302);
  });

  it('merges grants for several choirs in one cookie', async () => {
    const a = await redeem('alpha', TOKEN_A);
    const b = await redeem('beta', TOKEN_B, a.cookie);
    const list = await (await get('/api/choirs', b.cookie)).json<{ choirs: { id: string }[] }>();
    expect(list.choirs.map((c) => c.id).sort()).toEqual(['alpha', 'beta']);
  });

  it('re-redeeming the same choir does not duplicate its grant', async () => {
    const a = await redeem('alpha', TOKEN_A);
    const again = await redeem('alpha', TOKEN_A, a.cookie);
    const list = await (await get('/api/choirs', again.cookie)).json<{ choirs: unknown[] }>();
    expect(list.choirs).toHaveLength(1);
  });
});

describe('/api/choirs and /api/songs', () => {
  it('requires a grant', async () => {
    expect((await get('/api/choirs')).status).toBe(401);
    expect((await get('/api/songs/song-one')).status).toBe(401);
  });

  it('lists granted choir songs as summaries without secrets', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    const res = await get('/api/choirs', cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const text = await res.text();
    expect(text).not.toContain('sha256');
    expect(JSON.parse(text).choirs[0].songs).toEqual([
      { id: 'song-one', title: 'Song song-one', credits: 'Test', durationSec: 10, partCount: 1 },
    ]);
  });

  it('serves a song in a granted choir, 404s one that is not', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/api/songs/song-one', cookie)).status).toBe(200);
    expect((await get('/api/songs/song-two', cookie)).status).toBe(404); // other choir
    expect((await get('/api/songs/song-three', cookie)).status).toBe(404); // in no choir
    expect((await get('/api/songs/..%2Fsong-one', cookie)).status).toBe(404);
  });

  it('a manifest that fails Zod validation is treated as absent', async () => {
    await put('manifests/songs/song-one.json', { schemaVersion: 2, id: 'song-one' });
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/api/songs/song-one', cookie)).status).toBe(404);
  });
});

describe('cookie integrity', () => {
  it('tampered payload is rejected', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    const [name, val] = cookie.split('=') as [string, string];
    const [p, m] = val.split('.') as [string, string];
    const forged = btoa(
      JSON.stringify({
        v: 1,
        grants: [{ choirId: 'beta', tokenHashPrefix: await prefix(TOKEN_B), exp: now() + 1e6 }],
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(forged).not.toBe(p);
    expect((await get('/api/choirs', `${name}=${forged}.${m}`)).status).toBe(401);
  });

  it('tampered/garbage signature and malformed cookies are rejected', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/api/choirs', cookie.slice(0, -2) + 'AA')).status).toBe(401);
    for (const c of [
      '__Host-pb_grants=',
      '__Host-pb_grants=abc',
      '__Host-pb_grants=a.b.c',
      '__Host-pb_grants=!!.!!',
      'junk',
    ])
      expect((await get('/api/choirs', c)).status, c).toBe(401);
  });

  it('cookie signed with a different key is rejected', async () => {
    const { signPayload } = await import('../src/worker/crypto');
    const v = await signPayload(
      JSON.stringify({
        v: 1,
        grants: [{ choirId: 'alpha', tokenHashPrefix: await prefix(TOKEN_A), exp: now() + 1e6 }],
      }),
      'some-other-key-some-other-key-some-other',
    );
    expect((await get('/api/choirs', `__Host-pb_grants=${v}`)).status).toBe(401);
  });

  it('expired grant is rejected; valid signed grant is accepted', async () => {
    const p = await prefix(TOKEN_A);
    const expired = await signedCookie([{ choirId: 'alpha', tokenHashPrefix: p, exp: now() - 10 }]);
    expect((await get('/api/choirs', expired)).status).toBe(401);
    const ok = await signedCookie([{ choirId: 'alpha', tokenHashPrefix: p, exp: now() + 1000 }]);
    expect((await get('/api/choirs', ok)).status).toBe(200);
  });

  it('grant with wrong token-hash prefix is rejected', async () => {
    const c = await signedCookie([
      { choirId: 'alpha', tokenHashPrefix: await prefix(TOKEN_B), exp: now() + 1000 },
    ]);
    expect((await get('/api/choirs', c)).status).toBe(401);
  });

  it('malformed grants in a validly signed cookie are ignored, good ones kept', async () => {
    const c = await signedCookie([
      { choirId: '../x', tokenHashPrefix: 'zz', exp: now() + 1000 },
      'nonsense',
      { choirId: 'alpha', tokenHashPrefix: await prefix(TOKEN_A), exp: now() + 1000 },
    ]);
    expect((await get('/api/choirs', c)).status).toBe(200);
  });
});

describe('revocation', () => {
  it('removing the token from the manifest kills an existing cookie', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/api/choirs', cookie)).status).toBe(200);
    await put('manifests/choirs/alpha.json', await choir('alpha', ['song-one'], [TOKEN_B]));
    for (const p of ['/api/choirs', '/api/songs/song-one', '/audio/song-one/alto.abc123.m4a'])
      expect((await get(p, cookie)).status, p).not.toBe(200);
  });

  it('rotation: old cookie survives while its token is still active', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    await put(
      'manifests/choirs/alpha.json',
      await choir('alpha', ['song-one'], [TOKEN_A, TOKEN_B]),
    );
    expect((await get('/api/choirs', cookie)).status).toBe(200);
  });

  it('deleting the choir manifest revokes everything', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    await env.CONTENT.delete('manifests/choirs/alpha.json');
    expect((await get('/api/choirs', cookie)).status).toBe(401);
  });

  it('manifests are cached within the TTL and refetched after clearing', async () => {
    const { app } = await import('../src/worker/app');
    const e = { ...env, MANIFEST_TTL_SECONDS: '60' } as typeof env;
    const { cookie } = await redeem('alpha', TOKEN_A);
    const call = () =>
      app.fetch(new Request('https://x.test/api/choirs', { headers: { Cookie: cookie } }), e);
    expect((await call()).status).toBe(200);
    await put('manifests/choirs/alpha.json', await choir('alpha', ['song-one'], [TOKEN_B]));
    expect((await call()).status).toBe(200); // stale-by-design within TTL
    clearManifestCache();
    expect((await call()).status).toBe(401);
  });
});

describe('/audio', () => {
  const URL_ONE = '/audio/song-one/alto.abc123.m4a';

  it('streams for a granted song with correct headers', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    const res = await get(URL_ONE, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mp4');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO_BYTES);
  });

  it('requires a grant and a song in a granted choir', async () => {
    expect((await get(URL_ONE)).status).toBe(404);
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/audio/song-two/alto.abc123.m4a', cookie)).status).toBe(404);
    expect((await get('/audio/song-three/alto.abc123.m4a', cookie)).status).toBe(404);
  });

  it('only serves files named in the song manifest', async () => {
    await put('audio/song-one/stray.m4a', AUDIO_BYTES);
    const { cookie } = await redeem('alpha', TOKEN_A);
    expect((await get('/audio/song-one/stray.m4a', cookie)).status).toBe(404);
    expect((await get('/audio/song-one/missing.m4a', cookie)).status).toBe(404);
  });

  it('rejects path traversal and manifest access via /audio', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    for (const p of [
      '/audio/song-one/../song-two/alto.abc123.m4a',
      '/audio/song-one/%2e%2e/song-two/alto.abc123.m4a',
      '/audio/song-one/..%2fsong-two%2falto.abc123.m4a',
      '/audio/..%2fmanifests/choirs/alpha.json',
      '/audio/../manifests/choirs/alpha.json',
      '/audio/song-one//alto.abc123.m4a',
      '/audio/song-one/alto.abc123.m4a/',
      '/audio/song-one/%5Cx',
      '/audio/song-one/%00',
      '/audio/song-one/%zz',
      '/audio/',
      '/audio',
      '/audio/song-one',
      '/audio/manifests/choirs/alpha.json',
    ]) {
      const res = await get(p, cookie);
      expect(res.status, p).toBe(404);
      expect(await res.text(), p).not.toContain('accessTokens');
    }
  });

  it('supports Range requests: bounded, open-ended, suffix', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    let res = await get(URL_ONE, cookie, { Range: 'bytes=10-19' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 10-19/1000');
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO_BYTES.slice(10, 20));

    res = await get(URL_ONE, cookie, { Range: 'bytes=990-' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 990-999/1000');

    res = await get(URL_ONE, cookie, { Range: 'bytes=-5' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 995-999/1000');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO_BYTES.slice(995));
  });

  it('range requests still require access', async () => {
    expect((await get(URL_ONE, undefined, { Range: 'bytes=0-1' })).status).toBe(404);
  });

  it('unsatisfiable range -> 416', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    const res = await get(URL_ONE, cookie, { Range: 'bytes=5000-6000' });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */1000');
  });

  it('conditional request returns 304', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    const first = await get(URL_ONE, cookie);
    const etag = first.headers.get('ETag')!;
    await first.arrayBuffer();
    const res = await get(URL_ONE, cookie, { 'If-None-Match': etag });
    expect(res.status).toBe(304);
  });
});

describe('hygiene', () => {
  it('robots.txt disallows all; noindex everywhere incl. errors', async () => {
    const r = await get('/robots.txt');
    expect(await r.text()).toContain('Disallow: /');
    for (const p of ['/robots.txt', '/api/choirs', '/c/alpha/bad', '/audio/x', '/nope'])
      expect((await get(p)).headers.get('X-Robots-Tag'), p).toContain('noindex');
  });

  it('there is no raw R2 listing endpoint', async () => {
    const { cookie } = await redeem('alpha', TOKEN_A);
    for (const p of [
      '/audio',
      '/audio/',
      '/manifests/choirs/alpha.json',
      '/api/list',
      '/api/audio',
    ])
      expect((await get(p, cookie)).status, p).toBe(404);
  });

  it('refuses to run with a missing/weak signing key', async () => {
    const { app } = await import('../src/worker/app');
    const res = await app.fetch(new Request('https://x.test/api/choirs'), {
      ...env,
      COOKIE_SIGNING_KEY: 'short',
    } as typeof env);
    expect(res.status).toBe(500);
  });

  it('sha256 helper matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

it('cookieFrom helper sanity', async () => {
  const { res } = await redeem('alpha', TOKEN_A);
  expect(cookieFrom(res)).toMatch(/^__Host-pb_grants=[\w-]+\.[\w-]+$/);
});
