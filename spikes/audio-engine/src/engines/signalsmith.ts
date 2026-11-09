import SignalsmithStretch from 'signalsmith-stretch';
import { BaseEngine } from './base';

interface StretchNode extends AudioNode {
  schedule(o: Record<string, unknown>): void;
  stop(when?: number): void;
  addBuffers(b: Float32Array[], transfer?: ArrayBuffer[]): Promise<number>;
  inputTime: number;
}

/**
 * ONE Signalsmith node holds all N parts as N channels of a single input timeline and stretches
 * them in one call (one set of timing state -> parts cannot drift). Per-part GainNodes sit AFTER
 * the stretcher (ChannelSplitter -> GainNode_i -> master -> destination), which keeps gains live
 * without re-mixing the stretcher's input. Deviation from ADR-0002 graph order, same guarantee.
 * Decoded AudioBuffers are discarded after their samples are transferred into the worklet.
 */
export class SignalsmithEngine extends BaseEngine {
  private node!: StretchNode;
  private partGains: GainNode[] = [];

  protected async onFetched(datas: ArrayBuffer[], step: () => void) {
    const bufs = await this.decodeAll(datas, step);
    const n = bufs.length;
    const len = Math.max(...bufs.map((b) => b.length));
    // transfer (no copy) one Float32Array per part; pad short parts with silence
    const chans = bufs.map((b) => {
      const a = new Float32Array(len);
      a.set(b.getChannelData(0));
      return a;
    });
    bufs.length = 0;
    this.node = (await (SignalsmithStretch as unknown as (c: BaseAudioContext, o: unknown) => Promise<StretchNode>)(this.ctx, {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [n],
      channelCount: n, channelCountMode: 'explicit', channelInterpretation: 'discrete',
    }));
    await this.node.addBuffers(chans, chans.map((c) => c.buffer));
    this.stats.bufferBytes = n * len * 4;
    const split = this.ctx.createChannelSplitter(n);
    this.node.connect(split);
    const master = this.ctx.createGain();
    master.connect(this.ctx.destination);
    this.partGains = chans.map((_, i) => {
      const g = this.ctx.createGain();
      g.gain.value = this.gains.get(this.parts[i].id) ?? 1;
      split.connect(g, i);
      g.connect(master);
      return g;
    });
  }

  private sched(output: number, input: number) {
    const l = this.loop;
    this.node.schedule({
      output, input, rate: this.rate, active: true,
      loopStart: l ? l.start : 0, loopEnd: l ? l.end : 0,
    });
  }

  protected startSources(when: number, offset: number) { this.sched(when, offset); }
  protected stopSources() { this.node.stop(); }
  protected applyRate(_r: number, at: number) {
    if (!this._playing) return;
    this.sched(at, this.anchorPos);
  }
  protected applyGain(id: string, gain: number) {
    const i = this.parts.findIndex((p) => p.id === id);
    if (i >= 0) this.partGains[i].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
  }
  protected applyLoop() {
    if (this._playing) this.sched(this.ctx.currentTime + 0.02, this.posAt(this.ctx.currentTime + 0.02));
  }
  protected onDispose() { try { this.node.stop(); this.node.disconnect(); } catch { /* */ } }
}
