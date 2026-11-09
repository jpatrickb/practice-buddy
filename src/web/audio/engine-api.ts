/**
 * Engine contract shared with the UI (and its mocks). Keep this shape stable.
 * `load` has one optional third parameter (LoadOptions); everything else is unchanged.
 */
export interface PartSource {
  id: string;
  url: string;
  defaultGain: number;
}

/** Song-level facts from the manifest (ADR-0003 amendment). */
export interface LoadOptions {
  /** Exact song length in samples at `sampleRate` (manifest `durationSamples`). Preferred. */
  durationSamples?: number;
  /** Master sample rate that `durationSamples` is expressed in (manifest `sampleRate`). Default 44100. */
  sampleRate?: number;
  /** Fallback if `durationSamples` is absent (manifest `durationSec`). */
  durationSec?: number;
}

export interface PracticeEngine {
  load(
    parts: PartSource[],
    onProgress?: (loaded: number, total: number) => void,
    opts?: LoadOptions,
  ): Promise<void>;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  readonly duration: number;
  currentTime(): number;
  readonly playing: boolean;
  setRate(rate: number): void; // 0.5..1.5, glitch-free while playing
  setPartGain(id: string, gain: number): void; // linear 0..2; 0 = silent (UI computes mute/solo/off)
  setLoop(range: { start: number; end: number } | null): void;
  on(event: 'ended' | 'statechange' | 'error', cb: (...a: unknown[]) => void): () => void;
  dispose(): void;
}
