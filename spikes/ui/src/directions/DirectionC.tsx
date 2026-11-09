import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Scrubber } from "@/components/Scrubber";
import { LoopControls, PlayButton, SkipButton } from "@/components/Transport";
import { SpeedControl } from "@/components/SpeedControl";
import { FocusPicker, ResetMix } from "@/components/FocusPicker";
import { PartRow } from "@/components/PartRow";
import type { PlayerModel } from "@/lib/usePlayer";

/** C — Simple: pick your part, press play. Everything else is tucked away. */
export function DirectionC({ p }: { p: PlayerModel }) {
  return (
    <div className="space-y-8 pb-2">
      <section aria-labelledby="yp">
        <h2 id="yp" className="mb-3 text-2xl font-semibold tracking-tight">Which part do you sing?</h2>
        <FocusPicker p={p} big />
      </section>

      <section className="space-y-5 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
        <Scrubber p={p} />
        <div className="flex items-center justify-center gap-6">
          <SkipButton p={p} dir={-1} />
          <PlayButton p={p} className="size-24 [&_svg]:size-11" />
          <SkipButton p={p} dir={1} />
        </div>
        <LoopControls p={p} />
      </section>

      <SpeedControl p={p} />

      <div className="flex gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-14 flex-1 rounded-2xl text-base">
              <SlidersHorizontal className="size-5" /> Mix
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl px-4 pb-8">
            <SheetHeader className="px-1 text-left">
              <SheetTitle className="text-xl">Mix</SheetTitle>
              <SheetDescription>Turn parts on or off and change how loud each one is.</SheetDescription>
            </SheetHeader>
            <div className="mb-2 flex justify-end"><ResetMix p={p} /></div>
            <ul>
              {p.parts.map((part) => <PartRow key={part.id} p={p} id={part.id} roomy />)}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
