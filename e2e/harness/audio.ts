import { createEngine, type PracticeEngine } from '../../src/web/audio';

declare global {
  interface Window {
    harness: {
      engine: PracticeEngine | null;
      events: string[];
      load(songId: string): Promise<{ duration: number; progress: [number, number][] }>;
    };
  }
}

window.harness = {
  engine: null,
  events: [],
  async load(songId) {
    const res = await fetch(`/api/songs/${songId}`);
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const song = await res.json();
    const engine = createEngine();
    for (const ev of ['ended', 'statechange', 'error'] as const)
      engine.on(ev, () => window.harness.events.push(ev));
    const progress: [number, number][] = [];
    await engine.load(
      song.parts.map((p: { id: string; file: string; defaultGain: number }) => ({
        id: p.id,
        url: `/${p.file}`,
        defaultGain: p.defaultGain,
      })),
      (l, t) => progress.push([l, t]),
      {
        durationSamples: song.durationSamples,
        sampleRate: song.sampleRate,
        durationSec: song.durationSec,
      },
    );
    window.harness.engine = engine;
    return { duration: engine.duration, progress };
  },
};
