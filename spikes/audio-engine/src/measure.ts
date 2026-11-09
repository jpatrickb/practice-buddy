import { createEngine, type StretcherKind } from './engines';

export interface DriftResult {
  stretcher: StretcherKind; rate: number;
  clicksA: number; clicksB: number;
  latencyMs: number;       // median output offset vs ideal (constant, harmless)
  driftMsPerMin: { A: number; B: number }; // slope of (detected - ideal) per part, ms per minute of song
  maxDevMs: { A: number; B: number };      // max deviation from the part's own fit line
  interPartSkewMs: number; // median(A offset) - median(B offset): must be ~0
  renderSec: number;
}

/** Find the energy-peak near `center` (seconds) in channel data. */
function peakNear(x: Float32Array, sr: number, center: number, halfWin: number): { t: number; v: number } {
  const a = Math.max(0, Math.floor((center - halfWin) * sr)), b = Math.min(x.length, Math.ceil((center + halfWin) * sr));
  let bi = -1, bv = 0;
  for (let i = a; i < b; i++) { const v = Math.abs(x[i]); if (v > bv) { bv = v; bi = i; } }
  return { t: bi / sr, v: bv };
}
const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1] ?? 0; };
function fit(xs: number[], ys: number[]) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxy / sxx, icpt = my - slope * mx;
  return { slope, icpt, maxDev: Math.max(...xs.map((x, i) => Math.abs(ys[i] - (icpt + slope * x)))) };
}

/**
 * Render the full song offline through the real engine and measure where each click lands.
 * Part "click" has clicks at odd seconds, "click2" at even seconds (see make-fixtures.sh).
 * seconds: how much of the song to render (default all).
 */
export async function offlineDriftTest(
  stretcher: StretcherKind, urls: { id: string; url: string }[], rate: number,
  opt: { sampleRate?: number; seconds?: number } = {},
): Promise<DriftResult> {
  const sr = opt.sampleRate ?? 44100;
  const song = 9404805 / 44100;
  const secs = Math.min(opt.seconds ?? song, song);
  const outLen = Math.ceil((secs / rate + 2) * sr);
  const ctx = new OfflineAudioContext(2, outLen, sr);
  const eng = createEngine({ stretcher, context: ctx, sampleRate: sr });
  await eng.load(urls.map((u) => ({ ...u, defaultGain: 1 })));
  eng.setRate(rate);
  eng.play();
  const t0 = performance.now();
  const out = await ctx.startRendering();
  const x = out.getChannelData(0);
  const play0 = 0.08; // engine schedules start 80 ms after ctx time 0
  // ideal output time of media time m: play0 + m / rate
  const res: Record<'A' | 'B', { m: number; off: number }[]> = { A: [], B: [] };
  let L = 0;
  // coarse latency from first click of part A (media 1.0 s)
  const first = peakNear(x, sr, play0 + 1 / rate + 0.15, 0.3);
  L = first.t - (play0 + 1 / rate);
  for (let m = 1; m < secs - 1; m += 1) {
    const part = m % 2 === 1 ? 'A' : 'B';
    const ideal = play0 + m / rate;
    const p = peakNear(x, sr, ideal + L, Math.min(0.12, 0.4 / rate));
    if (p.v < 0.05) continue;
    res[part].push({ m, off: p.t - ideal });
    if (res[part].length % 8 === 0) L = median(res[part].slice(-8).map((r) => r.off));
  }
  const stat = (r: { m: number; off: number }[]) => fit(r.map((e) => e.m / 60), r.map((e) => e.off * 1000));
  const fa = stat(res.A), fb = stat(res.B);
  const medA = median(res.A.map((r) => r.off)) * 1000, medB = median(res.B.map((r) => r.off)) * 1000;
  eng.dispose();
  return {
    stretcher, rate, clicksA: res.A.length, clicksB: res.B.length,
    latencyMs: (medA + medB) / 2,
    driftMsPerMin: { A: fa.slope, B: fb.slope },
    maxDevMs: { A: fa.maxDev, B: fb.maxDev },
    interPartSkewMs: medA - medB,
    renderSec: (performance.now() - t0) / 1000,
  };
}

export interface GlitchResult {
  stretcher: StretcherKind; steps: string; pitchHz: { min: number; max: number };
  gapWindows: number; jumpCount: number; maxJump: number; jumpTimes: number[];
}

/** Sine220 rendered while rate is changed mid-play (1 -> 0.5 -> 1.5 -> 0.75). Checks gaps, discontinuities, pitch. */
export async function offlineRateChangeTest(
  stretcher: StretcherKind, sineUrl: string, opt: { sampleRate?: number } = {},
): Promise<GlitchResult> {
  const sr = opt.sampleRate ?? 44100;
  const schedule: [number, number][] = [[3, 0.5], [8, 1.5], [12, 0.75], [16, 1.0]];
  const total = 20;
  const ctx = new OfflineAudioContext(2, total * sr, sr);
  const eng = createEngine({ stretcher, context: ctx, sampleRate: sr });
  await eng.load([{ id: 's', url: sineUrl, defaultGain: 1 }]);
  eng.play();
  for (const [t, r] of schedule) {
    (ctx as OfflineAudioContext).suspend(t).then(() => { eng.setRate(r); void (ctx as OfflineAudioContext).resume(); });
  }
  const out = await ctx.startRendering();
  const x = out.getChannelData(0);
  eng.dispose();
  // analyse from 0.5 s to end: windows of 20 ms
  const w = Math.round(0.02 * sr);
  const rms: number[] = [], hz: number[] = [];
  for (let s = Math.round(0.5 * sr); s + w < x.length; s += w) {
    let e = 0, zc = 0;
    for (let i = s; i < s + w; i++) { e += x[i] * x[i]; if (x[i - 1] < 0 && x[i] >= 0) zc++; }
    rms.push(Math.sqrt(e / w)); hz.push(zc / 0.02);
  }
  const med = median(rms);
  const gapWindows = rms.filter((r) => r < med * 0.5).length;
  // sine max slope = A*2*pi*f/sr
  const maxSlope = 0.2 * 2 * Math.PI * 220 / sr;
  let jumpCount = 0, maxJump = 0; const jumpTimes: number[] = [];
  for (let i = Math.round(0.5 * sr); i < x.length; i++) {
    const d = Math.abs(x[i] - x[i - 1]); if (d > maxJump) maxJump = d; if (d > maxSlope * 3) { jumpCount++; const t = Math.round((i / sr) * 10) / 10; if (!jumpTimes.includes(t)) jumpTimes.push(t); }
  }
  const hzOK = hz.filter((_, i) => rms[i] > med * 0.5);
  return {
    stretcher, steps: schedule.map(([t, r]) => `${t}s→${r}x`).join(' '),
    pitchHz: { min: Math.min(...hzOK), max: Math.max(...hzOK) },
    gapWindows, jumpCount, maxJump, jumpTimes,
  };
}

/** Decode-offset probe: where does the first click land after decodeAudioData, and how long is the buffer. */
export async function decodeProbe(url: string, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(1, 44100, sampleRate);
  const ab = await (await fetch(url)).arrayBuffer();
  const b = await ctx.decodeAudioData(ab);
  const x = b.getChannelData(0);
  const clicks: number[] = [];
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 0.3) { clicks.push(i); i += sampleRate / 2; if (clicks.length >= 3) break; }
  return { url, length: b.length, sampleRate: b.sampleRate, channels: b.numberOfChannels, firstClicks: clicks };
}
