import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Scrubber } from "@/components/Scrubber";
import { LoopControls, TransportRow } from "@/components/Transport";
import { SpeedControl } from "@/components/SpeedControl";
import { FocusPicker, ResetMix } from "@/components/FocusPicker";
import type { PlayerModel } from "@/lib/usePlayer";
import { MAX_GAIN } from "@/lib/mixer";
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
            const silent = !m.on;
            const isMine = p.myPart === part.id;
            return (
              <li key={part.id}>
                <Card className={cn("space-y-3 p-4", isMine && "ring-2 ring-primary", silent && "opacity-70")}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-14 shrink-0 place-items-center">
                      <Switch
                        checked={m.on}
                        onCheckedChange={(v) => p.setOn(part.id, v)}
                        aria-label={`${part.label} on or off`}
                        className="origin-center scale-[1.6]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-semibold">{part.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {isMine ? "Your part" : m.on ? "Playing" : "Off"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-14 text-sm text-muted-foreground">Volume</span>
                    <Slider
                      aria-label={`${part.label} volume`}
                      min={0} max={MAX_GAIN} step={0.05}
                      value={[m.gain]}
                      onValueChange={([v]) => p.setGain(part.id, v)}
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
