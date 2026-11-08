import type { PartSource, PracticeEngine } from '../engine-api';

export type EngineEvent = 'ended' | 'statechange' | 'error';

export interface EngineStats {
  decodeMs: number;
  fetchMs: number;
  sampleRate: number;
  parts: number;
  lengths: number[];
  /** Float32 bytes held for decoded audio (what the engine retains). */
  bufferBytes: number;
  baseLatency?: number;
  outputLatency?: number;
}

declare global {
  interface Navigator {
    audioSession?: { type: string };
  }
}

/** Shared state machine: loading, timeline model, events, iOS handling. Subclasses own the audio graph. */
export abstract class BaseEngine implements PracticeEngine {
  protected parts: PartSource[] = [];
  protected gains = new Map<string, number>();
  protected loop: { start: number; end: number } | null = null;
  protected rate = 1;
  protected anchorPos = 0; // media position at anchorT
  protected anchorT = 0; // ctx time at which anchorPos holds
  protected _playing = false;
  protected _duration = 0;
  protected listeners = new Map<EngineEvent, Set<(...a: unknown[]) => void>>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private silentEl: HTMLAudioElement | null = null;
  stats: EngineStats = {
    decodeMs: 0, fetchMs: 0, sampleRate: 0, parts: 0, lengths: [], bufferBytes: 0,
  };

  constructor(protected ctx: BaseAudioContext, protected ownsContext: boolean) {}

  get duration() { return this._duration; }
  get playing() { return this._playing; }

  // ---- loading -----------------------------------------------------------
  async load(parts: PartSource[], onProgress?: (l: number, t: number) => void): Promise<void> {
    try {
      this.parts = parts;
      this.gains = new Map(parts.map((p) => [p.id, p.defaultGain]));
      let loaded = 0;
      const t0 = performance.now();
      const datas = await Promise.all(parts.map(async (p) => {
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(`Fetch ${p.id}: HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        onProgress?.(++loaded, parts.length * 2);
        return ab;
      }));
      this.stats.fetchMs = performance.now() - t0;
      await this.onFetched(datas, () => onProgress?.(++loaded, parts.length * 2));
      this.stats.sampleRate = this.ctx.sampleRate;
      this.stats.parts = parts.length;
      const ac = this.ctx as AudioContext;
      this.stats.baseLatency = ac.baseLatency;
      this.stats.outputLatency = ac.outputLatency;
      this.poll = setInterval(() => this.tick(), 50);
    } catch (e) {
      this.emit('error', e);
      throw e;
    }
  }

  /** Subclass: decode/prepare. Must set _duration and stats.decodeMs/lengths/bufferBytes. */
  protected abstract onFetched(datas: ArrayBuffer[], step: () => void): Promise<void>;

  protected async decodeAll(datas: ArrayBuffer[], step: () => void): Promise<AudioBuffer[]> {
    const t0 = performance.now();
    const bufs: AudioBuffer[] = [];
    // Sequential decode keeps peak memory lower than Promise.all on phones.
    for (const d of datas) { bufs.push(await this.ctx.decodeAudioData(d)); step(); }
    this.stats.decodeMs = performance.now() - t0;
    this.stats.lengths = bufs.map((b) => b.length);
    this.stats.bufferBytes = bufs.reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0);
    this._duration = Math.max(...bufs.map((b) => b.duration));
    return bufs;
  }

  // ---- timeline ----------------------------------------------------------
  currentTime(): number {
    if (!this._playing) return this.anchorPos;
    const dt = Math.max(0, this.ctx.currentTime - this.anchorT);
    let p = this.anchorPos + dt * this.rate;
    const l = this.loop;
    if (l && p >= l.end && this.anchorPos < l.end) p = l.start + ((p - l.start) % (l.end - l.start));
    return Math.min(p, this._duration);
  }

  /** Position at ctx time t, with the current segment model. */
  protected posAt(t: number): number {
    const save = this.ctx.currentTime;
    void save;
    const dt = Math.max(0, t - this.anchorT);
    let p = this.anchorPos + dt * this.rate;
    const l = this.loop;
    if (l && p >= l.end && this.anchorPos < l.end) p = l.start + ((p - l.start) % (l.end - l.start));
    return Math.min(p, this._duration);
  }

  play(): void {
    if (this._playing) return;
    this.enterPlaybackSession();
    if (this.ctx.state !== 'running' && 'resume' in this.ctx) void (this.ctx as AudioContext).resume();
    if (this.anchorPos >= this._duration - 0.05) this.anchorPos = 0;
    const l = this.loop;
    if (l && (this.anchorPos >= l.end)) this.anchorPos = l.start;
    this.anchorT = this.ctx.currentTime + 0.08;
    this._playing = true;
    this.startSources(this.anchorT, this.anchorPos);
    this.emit('statechange');
  }

  pause(): void {
    if (!this._playing) return;
    this.anchorPos = this.currentTime();
    this._playing = false;
    this.stopSources();
    this.silentEl?.pause();
    this.emit('statechange');
  }

  seek(sec: number): void {
    sec = Math.max(0, Math.min(sec, this._duration));
    if (!this._playing) { this.anchorPos = sec; this.emit('statechange'); return; }
    this.stopSources();
    this.anchorPos = sec;
    this.anchorT = this.ctx.currentTime + 0.06;
    this.startSources(this.anchorT, sec);
  }

  setRate(rate: number): void {
    rate = Math.max(0.5, Math.min(1.5, rate));
    if (!this._playing) { this.rate = rate; this.applyRate(rate, this.ctx.currentTime); return; }
    // Change takes effect at t; re-anchor so the timeline model stays continuous.
    const t = this.ctx.currentTime + 0.03;
    const pos = this.posAt(t);
    this.anchorPos = pos; this.anchorT = t; this.rate = rate;
    this.applyRate(rate, t);
  }

  setPartGain(id: string, gain: number): void {
    gain = Math.max(0, Math.min(2, gain));
    this.gains.set(id, gain);
    this.applyGain(id, gain);
  }

  setLoop(range: { start: number; end: number } | null): void {
    if (range && !(range.end > range.start)) range = null;
    this.loop = range ? { start: Math.max(0, range.start), end: Math.min(range.end, this._duration) } : null;
    if (this._playing) {
      const pos = this.currentTime();
      if (this.loop && pos >= this.loop.end) { this.seek(this.loop.start); return; }
      // re-anchor so the loop-wrap formula starts from a known in-range point
      this.anchorPos = pos; this.anchorT = this.ctx.currentTime;
    }
    this.applyLoop();
  }

  on(event: EngineEvent, cb: (...a: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }
  protected emit(event: EngineEvent, ...a: unknown[]) { this.listeners.get(event)?.forEach((cb) => cb(...a)); }

  dispose(): void {
    if (this.poll) clearInterval(this.poll);
    if (this._playing) { this._playing = false; this.stopSources(); }
    this.silentEl?.pause();
    this.onDispose();
    if (this.ownsContext) void (this.ctx as AudioContext).close();
    this.listeners.clear();
  }

  private tick() {
    if (!this._playing) return;
    if (!this.loop && this.currentTime() >= this._duration - 0.02) {
      this.stopSources();
      this._playing = false;
      this.anchorPos = this._duration;
      this.emit('statechange');
      this.emit('ended');
    }
    this.onTick();
  }

  // ---- iOS: silent switch ------------------------------------------------
  private enterPlaybackSession() {
    if (typeof navigator === 'undefined') return;
    if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch { /* ignore */ } return; }
    // Fallback for older iOS: a looping silent <audio> element moves the page to the "playback" category.
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && typeof document !== 'undefined') {
      if (!this.silentEl) {
        const hdr = new Uint8Array([82,73,70,70,38,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,68,172,0,0,136,88,1,0,2,0,16,0,100,97,116,97,2,0,0,0,0,0]);
        const el = new Audio(URL.createObjectURL(new Blob([hdr], { type: 'audio/wav' })));
        el.loop = true; this.silentEl = el;
      }
      void this.silentEl.play().catch(() => {});
    }
  }

  // ---- subclass hooks ----------------------------------------------------
  protected abstract startSources(when: number, offset: number): void;
  protected abstract stopSources(): void;
  protected abstract applyRate(rate: number, at: number): void;
  protected abstract applyGain(id: string, gain: number): void;
  protected abstract applyLoop(): void;
  protected onTick(): void {}
  protected onDispose(): void {}
}
