import { Headphones } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Scrubber } from "@/components/Scrubber";
import { LoopControls, TransportRow } from "@/components/Transport";
import { SpeedControl } from "@/components/SpeedControl";
import { FocusPicker, ResetMix } from "@/components/FocusPicker";
import type { PlayerModel } from "@/lib/usePlayer";
import { cn } from "@/lib/utils";

/** A — Cards: generous, one card per part, everything labelled in words. */
export function DirectionA({ p }: { p: PlayerModel }) {
  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-5">
        <Scrubber p={p} />
        <TransportRow p={p} />
        <LoopControls p={p} />
      </Card>

      <Card className="p-5">
        <SpeedControl p={p} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Your part</h2>
        <FocusPicker p={p} />
      </Card>

      <section aria-labelledby="mix-h" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="mix-h" className="text-lg font-semibold">Mix</h2>
          <ResetMix p={p} />
        </div>
        <ul className="space-y-3">
          {p.parts.map((part) => {
            const m = p.mix[part.id];
            const silent = p.gains[part.id] === 0;
            const isMine = p.focusOn && p.myPart === part.id;
            return (
              <li key={part.id}>
                <Card className={cn("space-y-3 p-4", isMine && "ring-2 ring-primary", silent && "opacity-70")}>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={m.on}
                      onCheckedChange={(v) => p.setOn(part.id, v)}
                      aria-label={`${part.label} on or off`}
                      className="h-8 w-14 [&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-6"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-semibold">{part.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {isMine ? "Your part" : m.on ? (silent ? "Muted by Solo" : "Playing") : "Off"}
                      </div>
                    </div>
                    <Toggle
                      pressed={m.solo}
                      onPressedChange={(v) => p.setSolo(part.id, v)}
                      aria-label={`Hear only ${part.label}`}
                      variant="outline"
                      className="h-11 gap-2 rounded-xl px-4 text-base data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      <Headphones className="size-5" /> Only
                    </Toggle>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-14 text-sm text-muted-foreground">Volume</span>
                    <Slider
                      aria-label={`${part.label} volume`}
                      min={0} max={1} step={0.05}
                      value={[m.volume]}
                      onValueChange={([v]) => p.setVolume(part.id, v)}
                      disabled={!m.on}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
