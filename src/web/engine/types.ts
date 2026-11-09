/**
 * The contract the UI codes against. WS-A's real engine (src/web/audio) implements this same interface.
 */
export interface PartSource {
  id: string;
  url: string;
  defaultGain: number;
}

export interface PracticeEngine {
  load(parts: PartSource[], onProgress?: (loaded: number, total: number) => void): Promise<void>;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  readonly duration: number;
  currentTime(): number;
  readonly playing: boolean;
  setRate(rate: number): void;
  /** Linear 0..2; the UI computes mute/solo/off into effective gain. */
  setPartGain(id: string, gain: number): void;
  setLoop(range: { start: number; end: number } | null): void;
  on(event: 'ended' | 'statechange' | 'error', cb: (...a: unknown[]) => void): () => void;
  dispose(): void;
}
