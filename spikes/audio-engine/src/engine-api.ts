/**
 * Engine contract for the app. The UI team mocks this exact shape.
 * Do not change without telling the tech lead.
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
  setRate(rate: number): void; // 0.5..1.5, glitch-free while playing
  setPartGain(id: string, gain: number): void; // linear 0..2; 0 = silent (UI computes mute/solo/off)
  setLoop(range: { start: number; end: number } | null): void;
  on(event: 'ended' | 'statechange' | 'error', cb: (...a: unknown[]) => void): () => void;
  dispose(): void;
}
