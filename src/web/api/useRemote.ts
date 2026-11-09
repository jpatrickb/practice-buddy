import { useEffect, useState } from 'react';
import { ApiError, type ApiFailure } from './client';

export type Remote<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; reason: ApiFailure };

/** Load something once per `key`; bump `attempt` to retry. */
export function useRemote<T>(load: () => Promise<T>, key: string, attempt: number): Remote<T> {
  const [state, setState] = useState<{ key: string; attempt: number; result: Remote<T> } | null>(
    null,
  );

  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, attempt, result: { status: 'ready', data } }),
      (e: unknown) =>
        live &&
        setState({
          key,
          attempt,
          result: { status: 'error', reason: e instanceof ApiError ? e.reason : 'failed' },
        }),
    );
    return () => {
      live = false;
    };
    // `load` is recreated every render; `key`/`attempt` identify the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return state && state.key === key && state.attempt === attempt
    ? state.result
    : { status: 'loading' };
}
