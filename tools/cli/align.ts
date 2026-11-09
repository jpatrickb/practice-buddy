import { UserError } from './errors';

export interface PartProbe {
  id: string;
  sampleRate: number;
  /** Length in samples per channel. */
  samples: number;
}

export interface Alignment {
  sampleRate: number;
  /** Every encoded part is padded/trimmed to exactly this many samples. */
  targetSamples: number;
  warnings: string[];
}

/**
 * ADR-0003: all parts must share a sample rate and (nearly) the same length.
 * A tail difference under 1 s is padded with silence to the longest part (with a warning);
 * anything bigger means the cycle region was different and the export must be redone.
 */
export function decideAlignment(parts: PartProbe[]): Alignment {
  if (parts.length === 0) throw new UserError('The song has no parts.');
  const rates = new Set(parts.map((p) => p.sampleRate));
  if (rates.size > 1) {
    const list = parts.map((p) => `  ${p.id}: ${p.sampleRate} Hz`).join('\n');
    throw new UserError(
      `The parts have different sample rates:\n${list}\nRe-export them all from GarageBand with the same project settings.`,
    );
  }
  const sampleRate = parts[0]!.sampleRate;
  const max = Math.max(...parts.map((p) => p.samples));
  const min = Math.min(...parts.map((p) => p.samples));
  if (max - min >= sampleRate) {
    const list = parts
      .map((p) => `  ${p.id}: ${(p.samples / sampleRate).toFixed(2)} s (${p.samples} samples)`)
      .join('\n');
    throw new UserError(
      `The parts are not the same length (they differ by ${((max - min) / sampleRate).toFixed(1)} s):\n${list}\n` +
        'Turn the cycle region on in GarageBand and export every part again, so they all have the same length.',
    );
  }
  const warnings: string[] = [];
  for (const p of parts) {
    if (p.samples < max)
      warnings.push(
        `${p.id} is ${((max - p.samples) / sampleRate).toFixed(3)} s shorter than the longest part; silence added at the end.`,
      );
  }
  return { sampleRate, targetSamples: max, warnings };
}
