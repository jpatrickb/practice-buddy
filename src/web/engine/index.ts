import { createEngine as createRealEngine, EngineError } from '../audio';
import { MockEngine } from './mock';
import type { PracticeEngine } from './types';

export { EngineError };
export type { LoadOptions, PartSource, PracticeEngine } from './types';

/** Dev/test flag: build or run with VITE_MOCK_ENGINE=1 to use the silent timer-driven mock. */
export const usingMockEngine = import.meta.env.VITE_MOCK_ENGINE === '1';

export function createEngine(hint: { durationSec: number }): PracticeEngine {
  return usingMockEngine ? new MockEngine(hint.durationSec) : createRealEngine();
}

/** A message that is safe to show to a non-technical user. */
export function friendlyMessage(e: unknown): string {
  return e instanceof EngineError
    ? e.userMessage
    : 'Something went wrong with the audio. Please try again.';
}
