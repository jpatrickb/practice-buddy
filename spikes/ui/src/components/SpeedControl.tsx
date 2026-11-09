import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from "@/lib/mixer";
import type { PlayerModel } from "@/lib/usePlayer";

export const speedLabel = (r: number) => `${r.toFixed(2).replace(/0$/, "")}×`;

export function SpeedControl({ p }: { p: PlayerModel }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-base font-semibold">Speed</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums" aria-live="polite">
            {speedLabel(p.rate)}
          </span>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => p.setRate(1)} disabled={p.rate === 1}>
            Normal
          </Button>
        </div>
      </div>
      <Slider
        aria-label="Speed"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={[p.rate]}
        onValueChange={([v]) => p.setRate(v)}
      />
      <div className="mt-1 flex justify-between text-sm text-muted-foreground">
        <span>Slower</span>
        <span>Faster</span>
      </div>
    </div>
  );
}
