import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayerModel } from "@/lib/usePlayer";

export function PlayButton({ p, className }: { p: PlayerModel; className?: string }) {
  return (
    <Button
      size="icon-lg"
      onClick={p.toggle}
      disabled={!p.ready}
      aria-label={p.playing ? "Pause" : "Play"}
      className={cn("size-16 rounded-full shadow-md [&_svg]:size-8", className)}
    >
      {p.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-0.5" />}
    </Button>
  );
}

export function SkipButton({ p, dir }: { p: PlayerModel; dir: -1 | 1 }) {
  const Icon = dir < 0 ? RotateCcw : RotateCw;
  return (
    <Button
      variant="secondary"
      onClick={() => p.skip(dir * 10)}
      aria-label={dir < 0 ? "Back 10 seconds" : "Forward 10 seconds"}
      className="h-14 min-w-14 flex-col gap-0 rounded-2xl px-3 text-xs"
    >
      <Icon className="size-5" />
      <span className="font-semibold">{dir < 0 ? "−10 s" : "+10 s"}</span>
    </Button>
  );
}

export function TransportRow({ p }: { p: PlayerModel }) {
  return (
    <div className="flex items-center justify-center gap-5">
      <SkipButton p={p} dir={-1} />
      <PlayButton p={p} />
      <SkipButton p={p} dir={1} />
    </div>
  );
}

/** Repeat a section: Start here / End here / Clear. */
export function LoopControls({ p }: { p: PlayerModel }) {
  const { a, b } = p.loop;
  const active = a !== null || b !== null;
  return (
    <div role="group" aria-label="Repeat a section" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">Repeat section</span>
      <Button variant={a !== null ? "default" : "outline"} className="h-11 rounded-xl" onClick={p.setLoopA}>
        Start here
      </Button>
      <Button variant={b !== null ? "default" : "outline"} className="h-11 rounded-xl" onClick={p.setLoopB}>
        End here
      </Button>
      <Button variant="ghost" className="h-11 rounded-xl" onClick={p.clearLoop} disabled={!active}>
        Clear
      </Button>
    </div>
  );
}
