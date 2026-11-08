import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Music2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeMenu } from "@/components/ThemeMenu";
import { Footer } from "@/components/Footer";
import { CHOIR, SONGS, type SongManifest } from "@/data/songs";
import { formatTime } from "@/lib/mixer";
import { usePlayer } from "@/lib/usePlayer";
import { load, save } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { DirectionA } from "@/directions/DirectionA";
import { DirectionB } from "@/directions/DirectionB";
import { DirectionC } from "@/directions/DirectionC";

const DIRECTIONS = [
  { id: "a", name: "A · Cards", C: DirectionA },
  { id: "b", name: "B · Console", C: DirectionB },
  { id: "c", name: "C · Simple", C: DirectionC },
] as const;
type DirId = (typeof DIRECTIONS)[number]["id"];

function useHash() {
  const [h, setH] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const f = () => setH(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return h;
}

function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 pb-4">
      <header className="flex items-start justify-between py-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Choir practice</p>
          <h1 className="text-3xl font-bold tracking-tight">{CHOIR.name}</h1>
        </div>
        <ThemeMenu />
      </header>
      <h2 className="mb-3 text-lg font-semibold">Songs</h2>
      <ul className="space-y-3">
        {SONGS.map((s) => (
          <li key={s.id}>
            <a href={`#/song/${s.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
              <Card className="gap-3 p-5 transition-colors hover:bg-accent">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Music2 className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold leading-tight">{s.title}</div>
                    <div className="text-base text-muted-foreground">{s.credits}</div>
                  </div>
                  <div className="text-base tabular-nums text-muted-foreground">{formatTime(s.durationSec)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Parts">
                  {[...s.parts].sort((a, b) => a.order - b.order).map((p) => (
                    <span key={p.id} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{p.label}</span>
                  ))}
                </div>
              </Card>
            </a>
          </li>
        ))}
      </ul>
      <Footer />
    </main>
  );
}

function Player({ song, dir }: { song: SongManifest; dir: DirId }) {
  const p = usePlayer(song);
  const Dir = DIRECTIONS.find((d) => d.id === dir)!.C;
  return (
    <main className="mx-auto max-w-xl px-4 pb-4">
      <header className="flex items-center gap-1 py-3">
        <Button asChild variant="ghost" className="-ml-2 h-11 rounded-full px-3 text-base">
          <a href="#/"><ArrowLeft className="size-5" /> Songs</a>
        </Button>
        <div className="flex-1" />
        <ThemeMenu />
      </header>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{song.title}</h1>
        <p className="text-base text-muted-foreground">{song.credits}</p>
      </div>
      {!p.ready ? <p className="py-10 text-center text-muted-foreground">Getting your song ready…</p> : <Dir p={p} />}
      <Footer />
    </main>
  );
}

/** Dev-only: switch between visual directions. Stripped from production builds. */
function DevSwitcher({ dir, setDir }: { dir: DirId; setDir: (d: DirId) => void }) {
  return (
    <nav
      aria-label="Design direction (dev only)"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex gap-1 rounded-full border bg-popover/95 p-1 shadow-lg backdrop-blur">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDir(d.id)}
            aria-pressed={dir === d.id}
            className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", dir === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {d.name}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  const hash = useHash();
  const [dir, setDirState] = useState<DirId>(() => {
    const q = new URLSearchParams(window.location.search).get("d");
    return (DIRECTIONS.some((d) => d.id === q) ? q : load<DirId>("pb.dev.direction", "a")) as DirId;
  });
  const setDir = (d: DirId) => { setDirState(d); save("pb.dev.direction", d); };
  const songId = useMemo(() => /^\/song\/(.+)$/.exec(hash)?.[1], [hash]);
  const song = SONGS.find((s) => s.id === songId);
  return (
    <>
      <div className="pb-24">{song ? <Player key={song.id} song={song} dir={dir} /> : <Home />}</div>
      {import.meta.env.DEV && <DevSwitcher dir={dir} setDir={setDir} />}
    </>
  );
}
