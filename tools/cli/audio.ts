import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { promisify } from 'node:util';
import { UserError } from './errors';

const exec = promisify(execFile);

export const LOSSLESS_EXT = new Set(['.aif', '.aiff', '.wav', '.flac']);
export const AUDIO_EXT = new Set([
  ...LOSSLESS_EXT,
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wma',
]);

export const isLossless = (file: string) => LOSSLESS_EXT.has(extname(file).toLowerCase());

export async function ensureTools(): Promise<void> {
  for (const tool of ['ffmpeg', 'ffprobe']) {
    try {
      await exec(tool, ['-version']);
    } catch {
      throw new UserError(`${tool} is not installed. Install it with:\n  brew install ffmpeg`);
    }
  }
}

export interface Probe {
  sampleRate: number;
  channels: number;
  samples: number;
}

export async function probe(file: string, lossless: boolean): Promise<Probe> {
  let info: { streams?: { sample_rate?: string; channels?: number; duration_ts?: number }[] };
  try {
    const { stdout } = await exec('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=sample_rate,channels,duration_ts',
      '-of',
      'json',
      file,
    ]);
    info = JSON.parse(stdout);
  } catch {
    throw new UserError(`Could not read ${file} as audio. Is the file complete and not corrupted?`);
  }
  const s = info.streams?.[0];
  if (!s?.sample_rate || !s.channels) throw new UserError(`${file} has no audio in it.`);
  const sampleRate = Number(s.sample_rate);
  // For PCM files duration_ts is the exact sample count. Lossy files can't be trusted: count by decoding.
  const samples = lossless && s.duration_ts ? s.duration_ts : await countSamples(file);
  return { sampleRate, channels: s.channels, samples };
}

function countSamples(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', [
      '-v',
      'error',
      '-i',
      file,
      '-map',
      '0:a:0',
      '-f',
      'f32le',
      '-ac',
      '1',
      '-',
    ]);
    let bytes = 0;
    p.stdout.on('data', (d: Buffer) => (bytes += d.length));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve(bytes / 4) : reject(new UserError(`Could not decode ${file}.`)),
    );
  });
}

/**
 * AAC-LC .m4a, mono 96 kbps or stereo 128 kbps, exactly `targetSamples` long at `sampleRate`.
 * Bit-exact flags and stripped metadata make the output deterministic, so the content hash
 * (and therefore the filename) is stable across runs. That is what makes uploads idempotent.
 */
export async function encodePart(opts: {
  input: string;
  output: string;
  channels: 1 | 2;
  sampleRate: number;
  targetSamples: number;
}): Promise<void> {
  const { input, output, channels, sampleRate, targetSamples } = opts;
  try {
    await exec('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      String(channels),
      '-ar',
      String(sampleRate),
      '-af',
      `atrim=end_sample=${targetSamples},apad=whole_len=${targetSamples}`,
      '-c:a',
      'aac',
      '-b:a',
      channels === 1 ? '96k' : '128k',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '-movflags',
      '+faststart',
      output,
    ]);
  } catch (e) {
    throw new UserError(
      `ffmpeg failed encoding ${input}:\n${(e as { stderr?: string }).stderr ?? e}`,
    );
  }
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}
