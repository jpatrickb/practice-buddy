/** Pure mixer maths. No React, no audio. Engine gain range is linear 0..2. */

export interface PartInfo {
  id: string;
  kind: string;
  defaultGain: number;
}

export interface PartMixState {
  on: boolean;
  /** Linear gain 0..MAX_GAIN. Starts at the part's manifest defaultGain. */
  gain: number;
}

export type Mix = Record<string, PartMixState>;

export const MAX_GAIN = 2;
/**
 * "Everyone, my part louder": the picked part stays at its own level and every other part is
 * lowered to this fraction. We lower rather than raise so the sum cannot clip worse than the default mix.
 */
export const OTHERS_DUCK = 0.55;

export const isAccompaniment = (p: { kind: string }) => p.kind === 'accompaniment';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Where a part's slider rests by default (its manifest gain, within the engine range). */
export const restingGain = (p: PartInfo) => clamp(p.defaultGain, 0, MAX_GAIN);

export const defaultMix = (parts: PartInfo[]): Mix =>
  Object.fromEntries(parts.map((p) => [p.id, { on: true, gain: restingGain(p) }]));

/** The mixer is the truth: effective gain = on ? gain : 0, optionally ducking everything but the picked part. */
export function effectiveGains(
  mix: Mix,
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
export function pickPart(parts: PartInfo[], mix: Mix, id: string): Mix {
  const picked = parts.find((p) => p.id === id);
  if (!picked) return mix;
  const out: Mix = {};
  for (const p of parts) {
    const cur = mix[p.id] ?? { on: true, gain: restingGain(p) };
    if (p.id === id) out[p.id] = { ...cur, on: true };
    else if (!isAccompaniment(picked)) out[p.id] = isAccompaniment(p) ? cur : { ...cur, on: false };
    else out[p.id] = { ...cur, on: false };
  }
  return out;
}

/** Switch every accompaniment part on or off together. */
export function setAccompaniment(parts: PartInfo[], mix: Mix, on: boolean): Mix {
  const out = { ...mix };
  for (const p of parts) {
    if (isAccompaniment(p)) out[p.id] = { ...(out[p.id] ?? { gain: restingGain(p) }), on };
  }
  return out;
}

export const isDefaultMix = (parts: PartInfo[], mix: Mix) =>
  parts.every((p) => {
    const m = mix[p.id];
    return m !== undefined && m.on && m.gain === restingGain(p);
  });

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.5;
export const SPEED_STEP = 0.05;
const SNAP = 0.03;

/** Round to the 0.05 grid, clamp, and snap to exactly 1.0 when close. */
export function snapSpeed(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  if (Math.abs(raw - 1) <= SNAP + 1e-9) return 1;
  const stepped = Math.round(raw / SPEED_STEP) * SPEED_STEP;
  return Math.round(clamp(stepped, SPEED_MIN, SPEED_MAX) * 100) / 100;
}
