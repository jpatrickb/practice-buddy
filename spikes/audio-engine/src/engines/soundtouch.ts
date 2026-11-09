import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';
import { BaseEngine } from './base';

/**
 * ADR-0002 graph: source(part) -> GainNode(part) -> master -> ONE SoundTouchNode -> destination.
 * Tempo is driven by every source's playbackRate (all set at the same ctx time);
 * the single SoundTouch node on the master bus restores pitch (its README's recommended mode).
 */
export class SoundTouchEngine extends BaseEngine {
  private buffers: AudioBuffer[] = [];
  private partGains: GainNode[] = [];
  private master!: GainNode;
  private st: SoundTouchNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  underruns = 0;

  protected async onFetched(datas: ArrayBuffer[], step: () => void) {
    await SoundTouchNode.register(this.ctx, processorUrl);
    this.buffers = await this.decodeAll(datas, step);
    this.master = this.ctx.createGain();
    this.partGains = this.buffers.map((_, i) => {
      const g = this.ctx.createGain();
      g.gain.value = this.gains.get(this.parts[i].id) ?? 1;
      g.connect(this.master);
      return g;
    });
  }

  protected startSources(when: number, offset: number) {
    // Fresh stretcher per start/seek so its internal FIFO never leaks old audio.
    this.st = new SoundTouchNode({ context: this.ctx, outputChannelCount: 2 });
    this.st.playbackRate.value = this.rate;
    this.st.pitch.value = 1;
    this.st.addEventListener('metrics', (e) => {
      this.underruns = Math.max(this.underruns, (e as CustomEvent).detail.underrunCount);
    });
    this.master.connect(this.st);
    this.st.connect(this.ctx.destination);
    this.sources = this.buffers.map((buf, i) => {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = this.rate;
      this.applyLoopTo(s);
      s.connect(this.partGains[i]);
      s.start(when, offset);
      return s;
    });
  }

  protected stopSources() {
    for (const s of this.sources) { try { s.stop(); } catch { /* not started */ } s.disconnect(); }
    this.sources = [];
    if (this.st) { try { this.master.disconnect(this.st); } catch { /* */ } this.st.disconnect(); this.st = null; }
  }

  protected applyRate(rate: number, at: number) {
    for (const s of this.sources) s.playbackRate.setValueAtTime(rate, at);
    this.st?.playbackRate.setValueAtTime(rate, at);
  }

  protected applyGain(id: string, gain: number) {
    const i = this.parts.findIndex((p) => p.id === id);
    if (i >= 0) this.partGains[i].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
  }

  private applyLoopTo(s: AudioBufferSourceNode) {
    s.loop = !!this.loop;
    if (this.loop) { s.loopStart = this.loop.start; s.loopEnd = this.loop.end; }
  }
  protected applyLoop() { this.sources.forEach((s) => this.applyLoopTo(s)); }
}
