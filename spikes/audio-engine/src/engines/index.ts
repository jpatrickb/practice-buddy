import type { PracticeEngine } from '../engine-api';
import { BaseEngine } from './base';
import { MediaEngine } from './media';
import { SignalsmithEngine } from './signalsmith';
import { SoundTouchEngine } from './soundtouch';

export type StretcherKind = 'signalsmith' | 'soundtouch' | 'media';
export interface EngineOptions {
  stretcher: StretcherKind;
  /** Context sample rate; lower = less memory (decoder resamples). Default: device rate. */
  sampleRate?: number;
  /** Inject an OfflineAudioContext (used by the drift tests). */
  context?: BaseAudioContext;
}
export type SpikeEngine = PracticeEngine & BaseEngine;

export function createEngine(o: EngineOptions): SpikeEngine {
  const owns = !o.context;
  const ctx = o.context ?? new AudioContext({ latencyHint: 'playback', ...(o.sampleRate ? { sampleRate: o.sampleRate } : {}) });
  const E = { signalsmith: SignalsmithEngine, soundtouch: SoundTouchEngine, media: MediaEngine }[o.stretcher];
  return new E(ctx, owns);
}
export { BaseEngine };
