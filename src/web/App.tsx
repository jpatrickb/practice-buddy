import { useEffect, useState } from 'react';
import { choirsResponseSchema, type ChoirsResponse } from '../shared';

type State =
  | { status: 'loading' }
  | { status: 'no-access' }
  | { status: 'error' }
  | { status: 'ready'; data: ChoirsResponse };

/** Placeholder: lists songs per choir. The real UI replaces this (WS-B / Phase 2). */
export function App() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/choirs')
      .then(async (res) => {
        if (res.status === 401) return setState({ status: 'no-access' });
        if (!res.ok) return setState({ status: 'error' });
        setState({ status: 'ready', data: choirsResponseSchema.parse(await res.json()) });
      })
      .catch(() => setState({ status: 'error' }));
  }, []);

  if (state.status === 'loading') return <p>Loading…</p>;
  if (state.status === 'no-access')
    return (
      <main>
        <h1>Practice Buddy</h1>
        <p>Open the link your choir director sent you to get started.</p>
      </main>
    );
  if (state.status === 'error') return <p>Something went wrong. Please try again.</p>;

  return (
    <main>
      <h1>Practice Buddy</h1>
      {state.data.choirs.map((choir) => (
        <section key={choir.id}>
          <h2>{choir.name}</h2>
          <ul>
            {choir.songs.map((song) => (
              <li key={song.id}>
                {song.title}
                {song.credits ? ` — ${song.credits}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <footer>
        <small>For private choir practice only. Please don’t share.</small>
      </footer>
    </main>
  );
}
