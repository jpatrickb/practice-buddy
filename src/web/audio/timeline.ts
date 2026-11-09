/**
 * Pure playback-clock model. The audio thread plays; this class answers "where in the song are we?"
 * from the AudioContext clock, the speed, and the loop. No Web Audio in here so it is unit-testable.
 */
export interface LoopRange {
  start: number;
  end: number;
}

export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;
export const clampRate = (r: number) =>
  Number.isFinite(r) ? Math.min(MAX_RATE, Math.max(MIN_RATE, r)) : 1;

export class Timeline {
  rate = 1;
  loop: LoopRange | null = null;
  playing = false;
  private anchorPos = 0; // song position at anchorT
  private anchorT = 0; // context time at which anchorPos holds

  constructor(public duration = 0) {}

  /** Song position (seconds) at context time `t`. */
  positionAt(t: number): number {
    if (!this.playing) return this.anchorPos;
    const dt = Math.max(0, t - this.anchorT);
    let p = this.anchorPos + dt * this.rate;
    const l = this.loop;
    if (l && p >= l.end && this.anchorPos < l.end)
      p = l.start + ((p - l.start) % (l.end - l.start));
    return Math.min(p, this.duration);
  }

  /** Playing from `pos`, starting at context time `t`. */
  start(pos: number, t: number) {
    this.anchorPos = this.clampPos(pos);
    this.anchorT = t;
    this.playing = true;
  }

  pause(t: number) {
    this.anchorPos = this.positionAt(t);
    this.playing = false;
  }

  seek(pos: number, t: number) {
    this.anchorPos = this.clampPos(pos);
    this.anchorT = t;
  }

  /** Speed changes at context time `t`; the position stays continuous. Returns the position at `t`. */
  setRate(rate: number, t: number): number {
    const pos = this.positionAt(t);
    this.anchorPos = pos;
    this.anchorT = Math.max(t, this.anchorT);
    this.rate = clampRate(rate);
    return pos;
  }

  /**
   * Set or clear the loop. If playback is already past the loop end the playhead jumps to the loop start.
   * Returns the position the audio should continue from at `t` (differs from the old one only after a jump).
   */
  setLoop(range: LoopRange | null, t: number): { pos: number; jumped: boolean } {
    const pos = this.positionAt(t);
    const r =
      range && range.end > range.start
        ? { start: Math.max(0, range.start), end: Math.min(range.end, this.duration) }
        : null;
    this.loop = r && r.end > r.start ? r : null;
    const jumped = !!this.loop && pos >= this.loop.end;
    this.anchorPos = jumped ? this.loop!.start : pos;
    this.anchorT = t;
    return { pos: this.anchorPos, jumped };
  }

  /** True when a non-looping playback has reached the end. */
  hasEnded(t: number, epsilon = 0.02): boolean {
    return this.playing && !this.loop && this.positionAt(t) >= this.duration - epsilon;
  }

  private clampPos(p: number) {
    return Math.min(this.duration, Math.max(0, Number.isFinite(p) ? p : 0));
  }
}
