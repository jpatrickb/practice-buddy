import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/mixer";
import type { PlayerModel } from "@/lib/usePlayer";

/** Seek bar with elapsed/total and the A–B loop region drawn on the track. */
export function Scrubber({ p }: { p: PlayerModel }) {
  const { a, b } = p.loop;
  const pct = (t: number) => `${(t / p.duration) * 100}%`;
  return (
    <div>
      <div className="relative">
        {a !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-5 -translate-y-1/2 rounded-sm bg-primary/25 ring-1 ring-primary/60"
            style={{ left: pct(a), width: b !== null ? `calc(${pct(b)} - ${pct(a)})` : "2px" }}
          />
        )}
        <Slider
          aria-label="Song position"
          min={0}
          max={p.duration}
          step={0.5}
          value={[p.time]}
          onValueChange={([v]) => p.seek(v)}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-sm tabular-nums text-muted-foreground">
        <span aria-label="Elapsed">{formatTime(p.time)}</span>
        {(a !== null || b !== null) && (
          <span className="text-primary">
            Repeating {a !== null ? formatTime(a) : "…"} – {b !== null ? formatTime(b) : "…"}
          </span>
        )}
        <span aria-label="Total length">{formatTime(p.duration)}</span>
      </div>
    </div>
  );
}
