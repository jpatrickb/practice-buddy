import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlayerModel } from "@/lib/usePlayer";

/** "Your part" chips. Choosing one turns Focus on; remembered per song. */
export function FocusPicker({ p, big = false }: { p: PlayerModel; big?: boolean }) {
  const choices = p.parts.filter((x) => x.kind === "voice");
  return (
    <div>
      <div role="radiogroup" aria-label="Your part" className="flex flex-wrap gap-2">
        {choices.map((part) => {
          const sel = p.focusOn && p.myPart === part.id;
          return (
            <button
              key={part.id}
              role="radio"
              aria-checked={sel}
              onClick={() => (sel ? p.setFocusOn(false) : p.chooseMyPart(part.id))}
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
        {p.focusOn && p.myPart
          ? `Your part is louder. The others are quieter.`
          : "Pick your part to hear it louder than the rest."}
      </p>
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
