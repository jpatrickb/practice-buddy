/** Pure mixer maths. No React, no audio. Engine gain range is linear 0..2. */

export interface PartMixState {
  on: boolean;
  /** 0..1 slider position, 1 = the part's normal level. */
  volume: number;
  solo: boolean;
}

export interface MixInput {
  parts: Record<string, PartMixState>;
  /** The part the user chose with "Focus my part", or null. */
  focusId: string | null;
  defaultGains: Record<string, number>;
}

export const MAX_GAIN = 2;
/** Focus: the user's part is boosted, everything else is lowered. */
export const FOCUS_BOOST = 1.5;
export const FOCUS_DUCK = 0.35;

export const defaultPartState = (): PartMixState => ({ on: true, volume: 1, solo: false });

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Effective linear gain per part.
 * - off => 0
 * - if any part is soloed, only soloed parts are heard (focus does not override solo)
 * - focus multiplies the chosen part by FOCUS_BOOST and every other audible part by FOCUS_DUCK
 * - result is defaultGain * volume * focusFactor, clamped to 0..MAX_GAIN
 */
export function effectiveGains(input: MixInput): Record<string, number> {
  const { parts, focusId, defaultGains } = input;
  const anySolo = Object.values(parts).some((p) => p.on && p.solo);
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(parts)) {
    if (!p.on || (anySolo && !p.solo)) {
      out[id] = 0;
      continue;
    }
    const base = (defaultGains[id] ?? 1) * clamp(p.volume, 0, 1);
    const focus = focusId === null ? 1 : id === focusId ? FOCUS_BOOST : FOCUS_DUCK;
    out[id] = clamp(base * focus, 0, MAX_GAIN);
  }
  return out;
}

export function resetMix(partIds: string[]): Record<string, PartMixState> {
  return Object.fromEntries(partIds.map((id) => [id, defaultPartState()]));
}

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
