import { BaseEngine } from './base';

/**
 * Fallback for comparison: one <audio preservesPitch> per part (routed through the context for gain >1
 * and iOS) plus a drift-correction loop that nudges playbackRate / hard-seeks followers to the leader.
 */
export class MediaEngine extends BaseEngine {
  private els: HTMLAudioElement[] = [];
  private gainNodes: GainNode[] = [];
  maxDriftMs = 0;

  protected async onFetched(_d: ArrayBuffer[], step: () => void) {
    const t0 = performance.now();
    await Promise.all(this.parts.map(async (p, i) => {
      const el = new Audio();
      el.preload = 'auto';
      (el as unknown as { preservesPitch: boolean }).preservesPitch = true;
      el.src = p.url;
      await new Promise<void>((res, rej) => {
        el.addEventListener('loadedmetadata', () => res(), { once: true });
        el.addEventListener('error', () => rej(new Error(`media ${p.id}`)), { once: true });
      });
      const g = this.ctx.createGain();
      g.gain.value = this.gains.get(p.id) ?? 1;
      (this.ctx as AudioContext).createMediaElementSource(el).connect(g).connect(this.ctx.destination);
      this.els[i] = el; this.gainNodes[i] = g; step();
    }));
    this.stats.decodeMs = performance.now() - t0;
    this._duration = Math.max(...this.els.map((e) => e.duration));
    this.stats.bufferBytes = 0; // streamed by the browser
  }

  protected startSources(_when: number, offset: number) {
    for (const el of this.els) { el.currentTime = offset; el.playbackRate = this.rate; void el.play(); }
    this.anchorT = this.ctx.currentTime; // elements start "now"; no scheduled start available
  }
  protected stopSources() { this.els.forEach((e) => e.pause()); }
  protected applyRate(rate: number) { this.els.forEach((e) => (e.playbackRate = rate)); }
  protected applyGain(id: string, gain: number) {
    const i = this.parts.findIndex((p) => p.id === id);
    if (i >= 0) this.gainNodes[i].gain.value = gain;
  }
  protected applyLoop() {}
  override currentTime() { return this._playing ? Math.min(this.els[0].currentTime, this._duration) : this.anchorPos; }

  protected override onTick() {
    const lead = this.els[0];
    const l = this.loop;
    if (l && lead.currentTime >= l.end) { this.seek(l.start); return; }
    for (let i = 1; i < this.els.length; i++) {
      const d = this.els[i].currentTime - lead.currentTime; // + = follower ahead
      this.maxDriftMs = Math.max(this.maxDriftMs, Math.abs(d) * 1000);
      if (Math.abs(d) > 0.15) this.els[i].currentTime = lead.currentTime;
      else if (Math.abs(d) > 0.01) this.els[i].playbackRate = this.rate * (1 - Math.sign(d) * 0.03);
      else this.els[i].playbackRate = this.rate;
    }
  }
  protected onDispose() { this.els.forEach((e) => { e.pause(); e.src = ''; }); }
}
