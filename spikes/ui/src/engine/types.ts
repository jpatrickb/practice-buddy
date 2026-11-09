export interface PartSource { id: string; url: string; defaultGain: number }

export interface PracticeEngine {
  load(parts: PartSource[], onProgress?: (loaded: number, total: number) => void): Promise<void>;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  readonly duration: number;
  currentTime(): number;
  readonly playing: boolean;
  setRate(rate: number): void;
  setPartGain(id: string, gain: number): void; // linear 0..2; UI computes mute/solo/off into effective gain
  setLoop(range: { start: number; end: number } | null): void;
  on(event: "ended" | "statechange" | "error", cb: (...a: unknown[]) => void): () => void;
  dispose(): void;
}
