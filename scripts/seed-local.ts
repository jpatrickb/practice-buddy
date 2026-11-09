/**
 * Local dev seed: fake 3-part song (ffmpeg sine stems) + fake choir + known dev token,
 * loaded into LOCAL R2 (miniflare state in .wrangler/state). Touches no real Cloudflare account.
 * Usage: pnpm seed   (requires ffmpeg)
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { choirManifestSchema, songManifestSchema } from '../src/shared/schemas';

const BUCKET = 'practice-buddy-content';
const DEV_CHOIR = 'dev-choir';
const DEV_TOKEN = 'dev-token-dev-token-dev-token-0'; // public, local-only, never valid in production
const SONG_ID = 'fake-song';
const DURATION = 20;
const SAMPLE_RATE = 44100;
const PARTS = [
  { id: 'low', label: 'Low voices', hz: 220, kind: 'voice' },
  { id: 'mid', label: 'Middle voices', hz: 330, kind: 'voice' },
  { id: 'accompaniment', label: 'Piano', hz: 440, kind: 'accompaniment' },
];

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: 'pipe' });
const wranglerPut = (key: string, file: string, contentType: string) =>
  run('pnpm', [
    'exec',
    'wrangler',
    'r2',
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--local',
    '--file',
    file,
    '--content-type',
    contentType,
  ]);

try {
  run('ffmpeg', ['-version']);
} catch {
  console.error('ffmpeg is required (brew install ffmpeg)');
  process.exit(1);
}

// .dev.vars with a random signing key, only if absent.
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `COOKIE_SIGNING_KEY=${randomBytes(32).toString('hex')}\n`);
  console.log('Created .dev.vars with a random COOKIE_SIGNING_KEY');
}

const tmp = mkdtempSync(join(tmpdir(), 'pb-seed-'));
try {
  const parts = PARTS.map((p, order) => {
    const out = join(tmp, `${p.id}.m4a`);
    run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${p.hz}:sample_rate=${SAMPLE_RATE}:duration=${DURATION}`,
      '-ac',
      '1',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      out,
    ]);
    const hash = sha256(readFileSync(out)).slice(0, 12);
    const file = `audio/${SONG_ID}/${p.id}.${hash}.m4a`;
    return {
      out,
      manifest: {
        id: p.id,
        label: p.label,
        file,
        defaultGain: 1,
        channels: 1 as const,
        order,
        kind: p.kind,
      },
    };
  });

  const song = songManifestSchema.parse({
    schemaVersion: 1,
    id: SONG_ID,
    title: 'Fake Song (sine waves)',
    credits: 'Generated locally',
    durationSec: DURATION,
    sampleRate: SAMPLE_RATE,
    parts: parts.map((p) => p.manifest),
  });
  const choir = choirManifestSchema.parse({
    schemaVersion: 1,
    id: DEV_CHOIR,
    name: 'Dev Choir',
    songs: [SONG_ID],
    accessTokens: [
      {
        sha256: sha256(DEV_TOKEN),
        label: 'local dev',
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ],
  });

  mkdirSync(tmp, { recursive: true });
  for (const p of parts) wranglerPut(p.manifest.file, p.out, 'audio/mp4');
  const songFile = join(tmp, 'song.json');
  const choirFile = join(tmp, 'choir.json');
  writeFileSync(songFile, JSON.stringify(song, null, 2));
  writeFileSync(choirFile, JSON.stringify(choir, null, 2));
  wranglerPut(`manifests/songs/${SONG_ID}.json`, songFile, 'application/json');
  wranglerPut(`manifests/choirs/${DEV_CHOIR}.json`, choirFile, 'application/json');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(
  `\nSeeded local R2 (${BUCKET}) with a fake 3-part song.\nStart the app:  pnpm dev\nThen open:      http://localhost:5173/c/${DEV_CHOIR}/${DEV_TOKEN}\n`,
);
