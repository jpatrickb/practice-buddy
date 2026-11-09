import { MockEngine } from './mock';
import type { PracticeEngine } from './types';

export type { PartSource, PracticeEngine } from './types';

/**
 * Engine factory.
 * TODO(WS-A): when src/web/audio lands, import its `createEngine` here and make it the default:
 *   import { createEngine as createRealEngine } from '../audio';
 * The mock stays available for e2e/dev via VITE_MOCK_ENGINE=1.
 */
const createRealEngine: (() => PracticeEngine) | null = null;

export const usingMockEngine =
  createRealEngine === null || import.meta.env.VITE_MOCK_ENGINE === '1';

export function createEngine(hint: { durationSec: number }): PracticeEngine {
  if (!usingMockEngine && createRealEngine) return createRealEngine();
  return new MockEngine(hint.durationSec);
}
