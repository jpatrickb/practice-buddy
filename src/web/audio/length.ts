/** Song-length handling (ADR-0003 amendment): the manifest, not the decoder, decides the length. */
import type { LoadOptions } from './engine-api';

/** Target length in samples at the context rate, or null if the manifest gave no usable length. */
export function targetSamples(opts: LoadOptions | undefined, ctxRate: number): number | null {
  if (!opts) return null;
  const masterRate = opts.sampleRate && opts.sampleRate > 0 ? opts.sampleRate : 44100;
  const sec =
    opts.durationSamples && opts.durationSamples > 0
      ? opts.durationSamples / masterRate
      : opts.durationSec && opts.durationSec > 0
        ? opts.durationSec
        : null;
  return sec == null ? null : Math.round(sec * ctxRate);
}

/**
 * Copy `src` into a Float32Array of exactly `len` samples: trims decoder tail padding (WebKit adds some)
 * and zero-pads a short file. Never shifts the start, so parts stay aligned.
 */
export function fitToLength(src: Float32Array, len: number): Float32Array {
  const out = new Float32Array(len);
  out.set(len >= src.length ? src : src.subarray(0, len));
  return out;
}
