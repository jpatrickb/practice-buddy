import { useState } from 'react';
import { Link } from 'react-router';
import { fetchChoirs } from '@/api/client';
import { useRemote } from '@/api/useRemote';
import { Cover } from '@/components/Cover';
import { Footer } from '@/components/Footer';
import { Failed, Loading } from '@/components/Screens';
import { Shell, useBackdrop } from '@/components/Shell';
import { formatTime } from '@/lib/format';
import type { ChoirsResponse } from '../../shared';

function SongCard({ song }: { song: ChoirsResponse['choirs'][number]['songs'][number] }) {
  return (
    <li>
      <Link
        to={`/songs/${song.id}`}
        className="glass flex items-center gap-3.5 rounded-panel p-3 transition-transform active:scale-[0.98]"
      >
        <Cover title={song.title} size="84px" radius="22%" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="text-[1.1875rem] leading-tight font-extrabold tracking-tight">
            {song.title}
          </b>
          {song.credits && <span className="text-muted-foreground">{song.credits}</span>}
          <span className="mt-1 text-sm text-muted-foreground">
            {song.partCount} {song.partCount === 1 ? 'part' : 'parts'}
          </span>
        </span>
        <span className="pr-2 font-semibold tabular-nums text-muted-foreground">
          {formatTime(song.durationSec)}
        </span>
      </Link>
    </li>
  );
}

export function Home() {
  const [attempt, setAttempt] = useState(0);
  const remote = useRemote(fetchChoirs, 'choirs', attempt);
  useBackdrop(null);

  if (remote.status === 'loading') return <Loading what="Loading your songs…" />;
  if (remote.status === 'error')
    return <Failed reason={remote.reason} retry={() => setAttempt((n) => n + 1)} />;

  const { choirs } = remote.data;
  const single = choirs.length === 1 ? choirs[0] : undefined;
  return (
    <Shell>
      <main className="mx-auto max-w-[640px] px-4 pt-10 pb-12">
        <header className="mb-6 text-center">
          <p className="text-[0.8125rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Choir practice
          </p>
          <h1 className="mt-1.5 bg-gradient-to-r from-white to-[#b9c0ff] bg-clip-text text-[clamp(2rem,9vw,2.75rem)] leading-[1.05] font-extrabold tracking-tight text-transparent">
            {single ? single.name : 'Practice Buddy'}
          </h1>
        </header>
        {choirs.map((choir) => (
          <section key={choir.id} aria-label={choir.name} className="mb-8">
            {!single && (
              <h2 className="mb-3 text-center text-xl font-extrabold tracking-tight">
                {choir.name}
              </h2>
            )}
            {choir.songs.length === 0 ? (
              <p className="text-center text-muted-foreground">No songs here yet.</p>
            ) : (
              <ul className="grid gap-3">
                {choir.songs.map((s) => (
                  <SongCard key={`${choir.id}/${s.id}`} song={s} />
                ))}
              </ul>
            )}
          </section>
        ))}
        <Footer />
      </main>
    </Shell>
  );
}
