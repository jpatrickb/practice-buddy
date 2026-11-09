import type { PartSource, PracticeEngine } from "./types";

type Ev = "ended" | "statechange" | "error";

/**
 * Timer-driven fake. No audio is produced. Position advances with wall-clock time
 * scaled by the playback rate, honours A–B looping, and emits the same events a real engine would.
 */
export class MockEngine implements PracticeEngine {
  duration: number;
  playing = false;
  readonly gains = new Map<string, number>();
  rate = 1;
  private pos = 0;
  private startedAt = 0; // performance.now() when last (re)anchored
  private loop: { start: number; end: number } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Record<Ev, Set<(...a: unknown[]) => void>> = {
    ended: new Set(), statechange: new Set(), error: new Set(),
  };

  constructor(duration: number, private now: () => number = () => performance.now()) {
    this.duration = duration;
  }

  async load(parts: PartSource[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
    parts.forEach((p) => this.gains.set(p.id, p.defaultGain));
    for (let i = 1; i <= parts.length; i++) {
      await new Promise((r) => setTimeout(r, 40));
      onProgress?.(i, parts.length);
    }
  }

  currentTime(): number {
    if (!this.playing) return this.pos;
    return this.compute();
  }

  private compute(): number {
    let t = this.pos + ((this.now() - this.startedAt) / 1000) * this.rate;
    if (this.loop && this.pos < this.loop.end && t >= this.loop.end) {
      const len = this.loop.end - this.loop.start;
      t = this.loop.start + ((t - this.loop.start) % len);
    }
    return Math.min(t, this.duration);
  }

  private anchor(t: number) {
    this.pos = t;
    this.startedAt = this.now();
  }

  play() {
    if (this.playing) return;
    if (this.pos >= this.duration) this.pos = 0;
    this.anchor(this.pos);
    this.playing = true;
    this.timer = setInterval(() => this.tick(), 100);
    this.emit("statechange");
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.compute();
    this.playing = false;
    this.stopTimer();
    this.emit("statechange");
  }

  private tick() {
    const t = this.compute();
    if (t >= this.duration) {
      this.pos = this.duration;
      this.playing = false;
      this.stopTimer();
      this.emit("statechange");
      this.emit("ended");
      return;
    }
    // re-anchor each tick: keeps loop wrap correct
    this.anchor(t);
  }

  seek(sec: number) {
    const t = Math.min(Math.max(0, sec), this.duration);
    this.anchor(t);
    if (!this.playing) this.emit("statechange");
  }

  setRate(rate: number) {
    if (this.playing) this.anchor(this.compute());
    this.rate = Math.min(1.5, Math.max(0.5, rate));
  }

  setPartGain(id: string, gain: number) {
    this.gains.set(id, Math.min(2, Math.max(0, gain)));
  }

  setLoop(range: { start: number; end: number } | null) {
    this.loop = range && range.end > range.start ? range : null;
  }

  on(event: Ev, cb: (...a: unknown[]) => void) {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private emit(e: Ev, ...a: unknown[]) {
    this.listeners[e].forEach((cb) => cb(...a));
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stopTimer();
    this.playing = false;
    Object.values(this.listeners).forEach((s) => s.clear());
  }
}
