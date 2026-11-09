import { isAccompaniment } from './mixer';

const VOICE_COLORS = 8;

/** CSS color per part: voices by their order in the song, accompaniment always neutral. */
export function partColors(
  parts: { id: string; kind: string; order: number }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const p of [...parts].sort((a, b) => a.order - b.order)) {
    out[p.id] = isAccompaniment(p) ? 'var(--accompaniment)' : `var(--part-${n++ % VOICE_COLORS})`;
  }
  return out;
}
