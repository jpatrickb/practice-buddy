import { Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { PlayerModel } from "@/lib/usePlayer";

/** Compact one-line mixer row: [on] Name [Only] ——volume—— */
export function PartRow({ p, id, roomy = false }: { p: PlayerModel; id: string; roomy?: boolean }) {
  const part = p.parts.find((x) => x.id === id)!;
  const m = p.mix[id];
  const mine = p.focusOn && p.myPart === id;
  return (
    <li className={cn("grid grid-cols-[2.75rem_5.5rem_1fr_3.5rem] items-center gap-x-2 rounded-xl px-2", roomy ? "min-h-16" : "min-h-14", mine && "bg-accent")}>
      <Toggle
        pressed={m.on}
        onPressedChange={(v) => p.setOn(id, v)}
        aria-label={`${part.label} ${m.on ? "on" : "off"}`}
        className="size-11 rounded-full p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        {m.on ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
      </Toggle>
      <span className={cn("truncate text-base font-semibold", !m.on && "text-muted-foreground line-through")}>{part.label}</span>
      <Slider
        aria-label={`${part.label} volume`}
        min={0} max={1} step={0.05}
        value={[m.volume]}
        onValueChange={([v]) => p.setVolume(id, v)}
        disabled={!m.on}
        className="px-1"
      />
      <Toggle
        pressed={m.solo}
        onPressedChange={(v) => p.setSolo(id, v)}
        aria-label={`Hear only ${part.label}`}
        variant="outline"
        className="h-11 min-w-0 rounded-xl px-0 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        Only
      </Toggle>
    </li>
  );
}
