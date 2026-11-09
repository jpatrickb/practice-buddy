import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PauseIcon, PlayIcon, Skip10 } from '@/components/icons';
import { formatTime } from '@/lib/format';
import type { PlayerModel } from '@/player/usePlayer';

const GRADIENT = 'linear-gradient(90deg,#7b84ff,#c26bff)';

/** Seek bar with elapsed/total and the A–B repeat region drawn on the track. */
export function Scrubber({ p }: { p: PlayerModel }) {
  const { a, b } = p.loop;
  const at = (t: number) => `calc(14px + ${t / p.duration} * (100% - 28px))`;
  return (
    <div>
      <div className="relative">
        {a !== null && (
          <span
            aria-hidden
            data-testid="loop-band"
            className="pointer-events-none absolute top-1/2 z-0 h-[22px] -translate-y-1/2 rounded-lg border-[1.5px] border-primary bg-primary/30"
            style={{
              left: at(a),
              width: b !== null ? `calc(${(b - a) / p.duration} * (100% - 28px) + 2px)` : '2px',
            }}
          />
        )}
        <Slider
          aria-label="Song position"
          aria-valuetext={`${formatTime(p.time)} of ${formatTime(p.duration)}`}
          min={0}
          max={p.duration}
          step={0.5}
          value={[Math.min(p.time, p.duration)]}
          onValueChange={([v]) => p.seek(v ?? 0)}
          trackClass="h-2.5"
          fill={GRADIENT}
          glow="#9a7bff"
        />
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[0.9375rem] tabular-nums text-muted-foreground">
        <span aria-label="Elapsed">{formatTime(p.time)}</span>
        {(a !== null || b !== null) && (
          <span className="font-bold text-[#8d97ff]" data-testid="loop-text">
            Repeating {a !== null ? formatTime(a) : '…'} – {b !== null ? formatTime(b) : '…'}
          </span>
        )}
        <span aria-label="Total length">{formatTime(p.duration)}</span>
      </div>
    </div>
  );
}

export function TransportRow({ p }: { p: PlayerModel }) {
  return (
    <div className="my-7 flex items-center justify-center gap-5">
      <Button
        variant="glass"
        size="icon"
        aria-label="Back 10 seconds"
        className="size-[60px]"
        onClick={() => p.skip(-10)}
      >
        <Skip10 dir="back" className="size-[30px]" />
      </Button>
      <button
        type="button"
        onClick={p.toggle}
        data-playing={p.playing}
        aria-label={p.playing ? 'Pause' : 'Play'}
        className="play-btn grid size-[84px] place-items-center rounded-full transition-transform active:scale-95"
      >
        {p.playing ? (
          <PauseIcon className="size-10" />
        ) : (
          <PlayIcon className="size-10 translate-x-0.5" />
        )}
      </button>
      <Button
        variant="glass"
        size="icon"
        aria-label="Forward 10 seconds"
        className="size-[60px]"
        onClick={() => p.skip(10)}
      >
        <Skip10 dir="forward" className="size-[30px]" />
      </Button>
    </div>
  );
}

/** Repeat a section: "Repeat section" label on its own row, three equal buttons below. */
export function LoopControls({ p }: { p: PlayerModel }) {
  const { a, b } = p.loop;
  return (
    <div role="group" aria-label="Repeat a section" className="mt-3 grid grid-cols-3 gap-2">
      <span className="col-span-3 text-[0.9375rem] font-semibold text-muted-foreground">
        Repeat section
      </span>
      <Button variant={a !== null ? 'default' : 'outline'} size="compact" onClick={p.setLoopA}>
        Start here
      </Button>
      <Button variant={b !== null ? 'default' : 'outline'} size="compact" onClick={p.setLoopB}>
        End here
      </Button>
      <Button
        variant="outline"
        size="compact"
        onClick={p.clearLoop}
        disabled={a === null && b === null}
      >
        Clear
      </Button>
    </div>
  );
}
