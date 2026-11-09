import { Card } from "@/components/ui/card";
import { Scrubber } from "@/components/Scrubber";
import { LoopControls, TransportRow } from "@/components/Transport";
import { SpeedControl } from "@/components/SpeedControl";
import { FocusPicker, ResetMix } from "@/components/FocusPicker";
import { PartRow } from "@/components/PartRow";
import type { PlayerModel } from "@/lib/usePlayer";

/** B — Console: dense single-line rows so every part fits on one screen. */
export function DirectionB({ p }: { p: PlayerModel }) {
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Scrubber p={p} />
        <TransportRow p={p} />
      </div>

      <Card className="p-2 py-3">
        <div className="mb-1 flex items-center justify-between px-3">
          <h2 className="text-lg font-semibold">Mix</h2>
          <ResetMix p={p} />
        </div>
        <ul>
          {p.parts.map((part) => (
            <PartRow key={part.id} p={p} id={part.id} />
          ))}
        </ul>
        <div className="mt-2 border-t px-3 pt-3">
          <h3 className="mb-2 text-base font-semibold">Your part</h3>
          <FocusPicker p={p} />
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <SpeedControl p={p} />
        <LoopControls p={p} />
      </Card>
    </div>
  );
}
