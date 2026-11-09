import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { fetchSong } from '@/api/client';
import { useRemote } from '@/api/useRemote';
import { Cover } from '@/components/Cover';
import { Footer } from '@/components/Footer';
import { MixPanel } from '@/components/MixPanel';
import { Panel } from '@/components/Panel';
import { PartPicker } from '@/components/PartPicker';
import { Failed, Loading } from '@/components/Screens';
import { Shell, useBackdrop } from '@/components/Shell';
import { SpeedPanel } from '@/components/SpeedPanel';
import { LoopControls, Scrubber, TransportRow } from '@/components/Transport';
import { Button } from '@/components/ui/button';
import { usingMockEngine } from '@/engine';
import { coverArt } from '@/lib/cover';
import { partColors } from '@/lib/partColors';
import { usePlayer } from '@/player/usePlayer';
import type { SongManifest } from '../../shared';

function LoadingPanel({ loaded, total }: { loaded: number; total: number }) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <Panel>
      <p role="status" className="font-bold">
        Getting your song ready…
      </p>
      <p className="mb-3 text-sm text-muted-foreground">
        {loaded} of {total} parts
      </p>
      <div
        role="progressbar"
        aria-label="Loading the song"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={loaded}
        className="h-2.5 overflow-hidden rounded-full bg-track"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7b84ff] to-[#c26bff] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Panel>
  );
}

function PlayerScreen({ song, retry }: { song: SongManifest; retry: () => void }) {
  const p = usePlayer(song);
  const art = coverArt(song.title);
  useBackdrop({ h1: art.h1, h2: art.h2 });
  const colors = partColors(song.parts);

  return (
    <Shell>
      <main className="mx-auto max-w-[640px] px-4 pt-4 pb-12 lg:max-w-[1000px]">
        <div className="mb-3 flex min-h-11 items-center justify-between">
          <Button asChild variant="ghost" size="compact" className="-ml-2 pr-3 pl-1.5">
            <Link to="/">
              <ChevronLeft className="size-6" /> Songs
            </Link>
          </Button>
          <span className="text-[0.8125rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Practice Buddy
          </span>
        </div>
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-9">
          <div className="grid justify-items-center gap-0.5 pb-3 text-center lg:sticky lg:top-6">
            <div className="mb-4">
              <Cover title={song.title} size="min(70vw, 340px)" radius="7%" showTitle />
            </div>
            <h1 className="text-[clamp(1.75rem,8vw,2.25rem)] leading-tight font-extrabold tracking-tight">
              {song.title}
            </h1>
            {song.credits && <p className="text-muted-foreground">{song.credits}</p>}
            {usingMockEngine && (
              <p
                role="note"
                className="mt-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
              >
                Preview: sound isn’t connected yet
              </p>
            )}
          </div>
          <div className="grid gap-3.5">
            {p.load.status === 'loading' && (
              <LoadingPanel loaded={p.load.loaded} total={p.load.total} />
            )}
            {p.load.status === 'error' && (
              <Panel>
                <p className="font-bold">We couldn’t load the audio.</p>
                <p className="mb-3 text-muted-foreground">Check your connection and try again.</p>
                <Button variant="default" onClick={retry}>
                  Try again
                </Button>
              </Panel>
            )}
            {p.ready && (
              <>
                <Panel>
                  <Scrubber p={p} />
                  <TransportRow p={p} />
                  <LoopControls p={p} />
                </Panel>
                <SpeedPanel p={p} />
                <PartPicker p={p} colors={colors} />
                <MixPanel p={p} colors={colors} />
              </>
            )}
          </div>
        </div>
        <Footer />
      </main>
    </Shell>
  );
}

export function PlayerPage() {
  const { songId = '' } = useParams();
  const [attempt, setAttempt] = useState(0);
  const remote = useRemote(() => fetchSong(songId), songId, attempt);
  const retry = () => setAttempt((n) => n + 1);

  if (remote.status === 'loading') return <Loading what="Loading…" />;
  if (remote.status === 'error') return <Failed reason={remote.reason} retry={retry} />;
  return <PlayerScreen key={`${remote.data.id}:${attempt}`} song={remote.data} retry={retry} />;
}
