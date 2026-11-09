import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PlayerModel } from "@/lib/usePlayer";

function Row({ id, label, hint, checked, disabled, onChange }: {
  id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={cn("flex min-h-12 items-center justify-between gap-3", disabled && "opacity-60")}>
      <span className="min-w-0">
        <span className="block text-base font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <span className="grid h-11 w-14 shrink-0 place-items-center">
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className="origin-center scale-[1.6]" />
      </span>
    </label>
  );
}

/**
 * "Your part" shortcut. Choosing a part sets the mixer (that part on, other voices off).
 * Voices first, then accompaniment, in manifest order. Tap the chosen chip again to clear the choice.
 */
export function FocusPicker({ p, big = false }: { p: PlayerModel; big?: boolean }) {
  const choices = [...p.parts.filter((x) => x.kind === "voice"), ...p.parts.filter((x) => x.kind !== "voice")];
  return (
    <div>
      <div role="radiogroup" aria-label="Your part" className="flex flex-wrap gap-2">
        {choices.map((part) => {
          const sel = p.myPart === part.id;
          return (
            <button
              key={part.id}
              role="radio"
              aria-checked={sel}
              onClick={() => p.chooseMyPart(sel ? null : part.id)}
              className={cn(
                "rounded-full border px-4 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                big ? "min-h-14 px-6 text-lg" : "min-h-11 text-base",
                sel ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {part.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {p.myPart ? "Your part is on and the other voices are off. Add any part back in the mix." : "Pick your part and the other voices turn off."}
      </p>
      <div className="mt-2 divide-y">
        {p.accompanimentLabel && (
          <Row id="acc" label={p.accompanimentLabel} hint="Accompaniment" checked={p.accompanimentOn} onChange={p.setAccompanimentOn} />
        )}
        <Row
          id="louder"
          label="Everyone, my part louder"
          hint={p.myPart ? "Plays all parts; the others are quieter" : "Pick your part first"}
          checked={p.louder}
          disabled={!p.myPart}
          onChange={p.setLouder}
        />
      </div>
    </div>
  );
}

export function ResetMix({ p, className }: { p: PlayerModel; className?: string }) {
  return (
    <Button variant="outline" className={cn("h-11 rounded-xl", className)} onClick={p.resetAll} disabled={p.mixIsDefault}>
      Reset mix
    </Button>
  );
}
