import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Panel } from '@/components/Panel';
import { MAX_GAIN, isAccompaniment } from '@/lib/mixer';
import { cn } from '@/lib/utils';
import type { PlayerModel } from '@/player/usePlayer';

export function MixPanel({ p, colors }: { p: PlayerModel; colors: Record<string, string> }) {
  return (
    <Panel
      title="Mix"
      action={
        <Button onClick={p.resetMix} disabled={p.mixIsDefault}>
          Reset mix
        </Button>
      }
    >
      <ul className="grid gap-2">
        {p.parts.map((part) => {
          const m = p.mix[part.id] ?? { on: true, gain: 1 };
          const audible = (p.gains[part.id] ?? 0) > 0;
          const mine = p.myPart === part.id;
          const sub = !m.on
            ? 'Off'
            : mine
              ? 'Your part'
              : p.louder && p.myPart
                ? 'Quieter'
                : isAccompaniment(part)
                  ? 'Backing'
                  : 'Playing';
          return (
            <li
              key={part.id}
              style={{ '--pc': colors[part.id] } as React.CSSProperties}
              className={cn(
                'grid grid-cols-[44px_96px_1fr_18px] items-center gap-x-2 rounded-[20px] border bg-card py-2 pr-3 pl-2.5 shadow-[0_10px_26px_rgb(0_0_0/0.3)] transition-opacity',
                !m.on && 'opacity-55',
              )}
            >
              <button
                type="button"
                role="switch"
                aria-checked={m.on}
                aria-label={part.label}
                onClick={() => p.setOn(part.id, !m.on)}
                className={cn(
                  'grid size-11 place-items-center rounded-full border-2 transition-[transform,background,box-shadow] active:scale-95',
                  m.on
                    ? 'border-transparent bg-[var(--pc)] text-[#0a0c12] shadow-[0_0_18px_color-mix(in_srgb,var(--pc)_55%,transparent)]'
                    : 'border-border text-muted-foreground',
                )}
              >
                {m.on ? <Volume2 className="size-[22px]" /> : <VolumeX className="size-[22px]" />}
              </button>
              <div className="grid min-w-0">
                <b
                  className={cn('leading-tight [overflow-wrap:anywhere]', !m.on && 'line-through')}
                >
                  {part.label}
                </b>
                <small className="text-sm leading-tight text-muted-foreground">{sub}</small>
              </div>
              <Slider
                notch={m.on}
                aria-label={`${part.label} volume`}
                aria-valuetext={`${Math.round(m.gain * 100)}%`}
                min={0}
                max={MAX_GAIN}
                step={0.05}
                value={[m.gain]}
                disabled={!m.on}
                fill="var(--pc)"
                trackClass="h-2"
                onValueChange={([v]) => p.setGain(part.id, v ?? 1)}
              />
              <span
                aria-hidden
                data-live={p.playing && audible}
                className="meter flex h-[18px] items-end justify-end gap-px"
              >
                <i />
                <i />
                <i />
                <i />
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
