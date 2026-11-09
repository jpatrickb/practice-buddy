/** Pure mixer maths. No React, no audio. Engine gain range is linear 0..2. */

export interface PartInfo { id: string; kind: string; defaultGain: number }

export interface PartMixState {
  on: boolean;
  /** Linear gain 0..MAX_GAIN. Starts at the part's manifest defaultGain. */
  gain: number;
}

export const MAX_GAIN = 2;
/**
 * "Everyone, my part louder": the picked part stays at its own level and every other part is
 * lowered to this fraction. We lower rather than raise so the sum cannot clip any worse than the default mix.
 */
export const OTHERS_DUCK = 0.55;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const defaultMix = (parts: PartInfo[]): Record<string, PartMixState> =>
  Object.fromEntries(parts.map((p) => [p.id, { on: true, gain: p.defaultGain }]));

/** The mixer is the truth: effective gain = on ? gain : 0, optionally ducking everything but the picked part. */
export function effectiveGains(
  mix: Record<string, PartMixState>,
  opts: { myPart: string | null; louder: boolean },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, m] of Object.entries(mix)) {
    const duck = opts.louder && opts.myPart !== null && id !== opts.myPart ? OTHERS_DUCK : 1;
    out[id] = m.on ? clamp(m.gain * duck, 0, MAX_GAIN) : 0;
  }
  return out;
}

/**
 * "Which part do you sing?" shortcut: the picked part goes ON; all other voice parts go OFF.
 * Picking an accompaniment part instead hears just that part (all voices and other accompaniment OFF).
 * Accompaniment is untouched when a voice is picked. Volumes are not changed.
 */
export function pickPart(
  parts: PartInfo[],
  mix: Record<string, PartMixState>,
  id: string,
): Record<string, PartMixState> {
  const picked = parts.find((p) => p.id === id);
  if (!picked) return mix;
  const out: Record<string, PartMixState> = {};
  for (const p of parts) {
    const cur = mix[p.id];
    if (p.id === id) out[p.id] = { ...cur, on: true };
    else if (picked.kind === "voice") out[p.id] = p.kind === "voice" ? { ...cur, on: false } : cur;
    else out[p.id] = { ...cur, on: false };
  }
  return out;
}

/** Switch every accompaniment part on or off together. */
export function setAccompaniment(
  parts: PartInfo[],
  mix: Record<string, PartMixState>,
  on: boolean,
): Record<string, PartMixState> {
  const out = { ...mix };
  for (const p of parts) if (p.kind === "accompaniment") out[p.id] = { ...out[p.id], on };
  return out;
}

export const isDefaultMix = (parts: PartInfo[], mix: Record<string, PartMixState>) =>
  parts.every((p) => mix[p.id].on && mix[p.id].gain === p.defaultGain);

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.5;
export const SPEED_STEP = 0.05;
const SNAP = 0.03;

/** Round to the 0.05 grid, clamp, and snap to exactly 1.0 when close. */
export function snapSpeed(raw: number): number {
  if (Math.abs(raw - 1) <= SNAP + 1e-9) return 1;
  const stepped = Math.round(raw / SPEED_STEP) * SPEED_STEP;
  const c = clamp(stepped, SPEED_MIN, SPEED_MAX);
  const r = Math.round(c * 100) / 100;
  return r;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
