import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/Panel';
import { isAccompaniment } from '@/lib/mixer';
import { cn } from '@/lib/utils';
import type { PlayerModel } from '@/player/usePlayer';

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-[60px] items-center justify-between gap-4 border-t py-1.5',
        disabled && 'opacity-55',
      )}
    >
      <span className="grid">
        <span className="font-bold">{label}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

/** "Which part do you sing?": a shortcut that sets the mixer (that part on, other voices off). */
export function PartPicker({ p, colors }: { p: PlayerModel; colors: Record<string, string> }) {
  const choices = [...p.parts.filter((x) => !isAccompaniment(x)), ...p.accompaniment];
  const accLabel = p.accompaniment.map((x) => x.label).join(' & ');
  return (
    <Panel title="Which part do you sing?">
      <div role="group" aria-label="Which part do you sing?" className="flex flex-wrap gap-2">
        {choices.map((part) => {
          const picked = p.myPart === part.id;
          return (
            <button
              key={part.id}
              type="button"
              aria-pressed={picked}
              onClick={() => p.choosePart(picked ? null : part.id)}
              style={{ '--pc': colors[part.id] } as React.CSSProperties}
              className={cn(
                'inline-flex min-h-[46px] items-center gap-2 rounded-full border-[1.5px] px-[18px] font-bold transition-[transform,background] active:scale-95',
                picked
                  ? 'border-transparent bg-[var(--pc)] text-[#0a0c12]'
                  : 'border-border bg-card-strong',
              )}
            >
              <span
                aria-hidden
                className={cn('size-2.5 rounded-full', picked ? 'bg-[#0a0c12]' : 'bg-[var(--pc)]')}
              />
              {part.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 mb-1 text-[0.9375rem] text-muted-foreground" aria-live="polite">
        {p.myPart
          ? 'Your part is on and the other voices are off. Add any part back below.'
          : 'Pick your part and the other voices turn off.'}
      </p>
      {p.accompaniment.length > 0 && (
        <SwitchRow
          label={accLabel}
          hint="Accompaniment"
          checked={p.accompanimentOn}
          onChange={p.setAccompanimentOn}
        />
      )}
      <SwitchRow
        label="Everyone, my part louder"
        hint={p.myPart ? 'Plays all parts; the others are quieter' : 'Pick your part first'}
        checked={p.louder}
        disabled={!p.myPart}
        onChange={p.setLouderOn}
      />
    </Panel>
  );
}
