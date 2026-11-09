import SignalsmithStretch from 'signalsmith-stretch';
import type { LoadOptions, PartSource, PracticeEngine } from './engine-api';
import { EngineError, friendly, httpError } from './errors';
import { enterPlaybackSession, leavePlaybackSession, resumeOnGesture } from './ios';
import { fitToLength, targetSamples } from './length';
import { clampRate, Timeline } from './timeline';

/** ADR-0002: decode at 24 kHz (≈123 MB for a 6-part song instead of 226 MB at 44.1 kHz). */
export const CONTEXT_SAMPLE_RATE = 24000;
const START_DELAY = 0.08; // seconds of lead so the worklet is ready when playback begins

interface StretchNode extends AudioNode {
  schedule(o: Record<string, unknown>): void;
  stop(when?: number): void;
  addBuffers(b: Float32Array[], transfer?: ArrayBuffer[]): Promise<number>;
  dropBuffers(): Promise<unknown>;
}
type StretchFactory = (ctx: BaseAudioContext, opts: unknown) => Promise<StretchNode>;
type EventName = 'ended' | 'statechange' | 'error';

export interface EngineOptions {
  /** Inject a context (tests / offline rendering). Default: a new 24 kHz AudioContext. */
  context?: BaseAudioContext;
}

class SignalsmithEngine implements PracticeEngine {
  private ctx: BaseAudioContext;
  private ownsCtx: boolean;
  private tl = new Timeline();
  private ids: string[] = [];
  private gains = new Map<string, number>();
  private gainNodes: GainNode[] = [];
  private node: StretchNode | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private listeners = new Map<EventName, Set<(...a: unknown[]) => void>>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private unbind: (() => void) | null = null;
  private disposed = false;
  private loaded = false;

  constructor(opts: EngineOptions = {}) {
    this.ownsCtx = !opts.context;
    this.ctx =
      opts.context ??
      new AudioContext({ sampleRate: CONTEXT_SAMPLE_RATE, latencyHint: 'playback' });
    if (this.ctx instanceof AudioContext) this.unbind = resumeOnGesture(this.ctx);
  }

  get duration() {
    return this.tl.duration;
  }
  get playing() {
    return this.tl.playing;
  }
  currentTime() {
    return this.tl.positionAt(this.ctx.currentTime);
  }

  async load(
    parts: PartSource[],
    onProgress?: (loaded: number, total: number) => void,
    opts?: LoadOptions,
  ): Promise<void> {
    try {
      if (typeof AudioWorkletNode === 'undefined' || !this.ctx.audioWorklet)
        throw new EngineError(
          'unsupported',
          'Your browser cannot play this song. Try a recent version of Safari or Chrome, on a secure (https) connection.',
        );
      if (parts.length === 0) throw new EngineError('unknown', 'This song has no parts.');
      this.ids = parts.map((p) => p.id);
      this.gains = new Map(parts.map((p) => [p.id, p.defaultGain]));
      const total = parts.length * 2; // one step per fetch, one per decode
      let done = 0;
      const step = () => onProgress?.(++done, total);
      onProgress?.(0, total);

      // Fetch all parts in parallel (same-origin: the grant cookie goes along).
      const fetched = parts.map(async (p) => {
        const res = await fetch(p.url, { credentials: 'same-origin' });
        if (!res.ok) throw httpError(res.status);
        const data = await res.arrayBuffer();
        step();
        return data;
      });
      // Decode one at a time, in order, as each arrives: lowest peak memory on phones.
      const target = targetSamples(opts, this.ctx.sampleRate);
      const decoded: Float32Array[] = [];
      for (const pending of fetched) {
        const data = await pending;
        if (this.disposed) return;
        const buf = await this.ctx.decodeAudioData(data);
        decoded.push(buf.getChannelData(0).slice()); // copy out, then let the AudioBuffer go
        step();
      }
      // A rejected sibling fetch must not be left unhandled.
      await Promise.all(fetched);
      if (this.disposed) return;

      // Song length: manifest first (WebKit leaves extra AAC tail samples), else the shortest part.
      const len = target ?? Math.min(...decoded.map((d) => d.length));
      const chans = decoded.map((d) => fitToLength(d, len));
      decoded.length = 0;

      const create = SignalsmithStretch as unknown as StretchFactory;
      const n = chans.length;
      this.node = await create(this.ctx, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [n],
        channelCount: n,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      });
      if (this.disposed) return;
      await this.node.addBuffers(
        chans,
        chans.map((c) => c.buffer as ArrayBuffer),
      ); // transferred, not copied

      // ChannelSplitter -> Gain_i -> master -> soft limiter -> destination
      const split = this.ctx.createChannelSplitter(n);
      this.node.connect(split);
      this.master = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.25;
      this.master.connect(this.limiter).connect(this.ctx.destination);
      this.gainNodes = parts.map((p, i) => {
        const g = this.ctx.createGain();
        g.gain.value = this.gains.get(p.id) ?? 1;
        split.connect(g, i);
        g.connect(this.master!);
        return g;
      });

      this.tl = new Timeline(len / this.ctx.sampleRate);
      this.loaded = true;
      this.poll = setInterval(() => this.tick(), 50);
      this.emit('statechange');
    } catch (e) {
      if (this.disposed) return;
      const err = friendly(e);
      this.emit('error', err);
      throw err;
    }
  }

  play() {
    if (!this.loaded || this.tl.playing) return;
    enterPlaybackSession();
    if (this.ctx instanceof AudioContext && this.ctx.state !== 'running') void this.ctx.resume();
    let pos = this.tl.positionAt(0); // paused: stored position
    if (pos >= this.tl.duration - 0.05) pos = 0;
    const l = this.tl.loop;
    if (l && pos >= l.end) pos = l.start;
    const t = this.ctx.currentTime + START_DELAY;
    this.tl.start(pos, t);
    this.schedule(t, pos);
    this.emit('statechange');
  }

  pause() {
    if (!this.loaded || !this.tl.playing) return;
    this.tl.pause(this.ctx.currentTime);
    this.node?.stop();
    leavePlaybackSession();
    this.emit('statechange');
  }

  seek(sec: number) {
    if (!this.loaded) return;
    if (!this.tl.playing) {
      this.tl.seek(sec, this.ctx.currentTime);
      this.emit('statechange');
      return;
    }
    const t = this.ctx.currentTime + 0.05;
    this.tl.seek(sec, t);
    this.schedule(t, this.tl.positionAt(t));
  }

  setRate(rate: number) {
    if (!this.loaded) return;
    const r = clampRate(rate);
    if (!this.tl.playing) {
      this.tl.rate = r;
      return;
    }
    const t = this.ctx.currentTime + 0.03;
    const pos = this.tl.setRate(r, t); // position stays continuous across the change
    this.schedule(t, pos);
  }

  setPartGain(id: string, gain: number) {
    const g = Math.min(2, Math.max(0, Number.isFinite(gain) ? gain : 0));
    this.gains.set(id, g);
    const i = this.ids.indexOf(id);
    // short time constant: no zipper noise
    if (i >= 0) this.gainNodes[i]?.gain.setTargetAtTime(g, this.ctx.currentTime, 0.01);
  }

  setLoop(range: { start: number; end: number } | null) {
    if (!this.loaded) return;
    const t = this.ctx.currentTime + 0.02;
    const { pos } = this.tl.setLoop(range, t);
    if (this.tl.playing) this.schedule(t, pos);
  }

  on(event: EventName, cb: (...a: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.poll) clearInterval(this.poll);
    this.unbind?.();
    leavePlaybackSession();
    try {
      this.node?.stop();
      void this.node?.dropBuffers(); // free the audio held inside the worklet
      this.node?.disconnect();
      this.gainNodes.forEach((g) => g.disconnect());
      this.master?.disconnect();
      this.limiter?.disconnect();
    } catch {
      /* already torn down */
    }
    this.node = this.master = this.limiter = null;
    this.gainNodes = [];
    if (this.ownsCtx) void (this.ctx as AudioContext).close().catch(() => undefined);
    this.listeners.clear();
    this.loaded = false;
  }

  // ---- internals ---------------------------------------------------------
  private schedule(at: number, pos: number) {
    const l = this.tl.loop;
    this.node?.schedule({
      output: at,
      input: pos,
      rate: this.tl.rate,
      active: true,
      loopStart: l ? l.start : 0,
      loopEnd: l ? l.end : 0, // equal values disable looping
    });
  }

  private tick() {
    if (this.tl.hasEnded(this.ctx.currentTime)) {
      this.node?.stop();
      this.tl.pause(this.ctx.currentTime);
      this.tl.seek(this.tl.duration, this.ctx.currentTime);
      leavePlaybackSession();
      this.emit('statechange');
      this.emit('ended');
    }
  }

  private emit(event: EventName, ...a: unknown[]) {
    this.listeners.get(event)?.forEach((cb) => cb(...a));
  }
}

export function createEngine(opts?: EngineOptions): PracticeEngine {
  return new SignalsmithEngine(opts);
}
