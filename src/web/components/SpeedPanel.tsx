import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Panel } from '@/components/Panel';
import { speedLabel } from '@/lib/format';
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from '@/lib/mixer';
import type { PlayerModel } from '@/player/usePlayer';

export function SpeedPanel({ p }: { p: PlayerModel }) {
  return (
    <Panel
      title="Speed"
      action={
        <div className="flex items-center gap-3">
          <span className="text-[1.375rem] font-extrabold tabular-nums" aria-live="polite">
            {speedLabel(p.rate)}
          </span>
          <Button onClick={() => p.setRate(1)} disabled={p.rate === 1}>
            Normal
          </Button>
        </div>
      }
    >
      <Slider
        notch
        aria-label="Speed"
        aria-valuetext={speedLabel(p.rate)}
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={[p.rate]}
        onValueChange={([v]) => p.setRate(v ?? 1)}
      />
      <div className="-mt-1 flex justify-between text-sm text-muted-foreground">
        <span>Slower</span>
        <span>Faster</span>
      </div>
    </Panel>
  );
}
