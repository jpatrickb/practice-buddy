export type EngineErrorCode = 'network' | 'no-access' | 'decode' | 'unsupported' | 'unknown';

/** Error with a message that is safe to show a non-technical user. */
export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    public userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = 'EngineError';
  }
}

export function friendly(e: unknown): EngineError {
  if (e instanceof EngineError) return e;
  const cause = e;
  const name = e instanceof Error ? e.name : '';
  if (name === 'EncodingError' || name === 'NotSupportedError' || name === 'DataCloneError')
    return new EngineError('decode', 'This song could not be played on your device.', { cause });
  if (e instanceof TypeError)
    return new EngineError(
      'network',
      'Could not load the song. Check your connection and try again.',
      { cause },
    );
  return new EngineError('unknown', 'Something went wrong with the audio. Please try again.', {
    cause,
  });
}

export function httpError(status: number): EngineError {
  if (status === 401 || status === 403 || status === 404)
    return new EngineError(
      'no-access',
      'This song is not available. Open the link your choir director sent you again.',
    );
  return new EngineError(
    'network',
    'Could not load the song. Check your connection and try again.',
  );
}
