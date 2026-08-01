import { useMemo } from "react";
import type { FieldGuideEntry } from "@/lib/fieldGuide";
import { matchPocketBirdSpecies } from "@/lib/pocketBird/matchSpecies";
import { getPocketBirdWalkFrame } from "@/lib/pocketBird/render";
import { PocketBirdRenderer } from "@/components/PocketBirdRenderer";

interface ColonyPixelBirdProps {
  entry: FieldGuideEntry;
  size: number;
  walkPhase?: number;
}

/** Colony bird using Pocket Bird MPL-2.0 pixel sprites. */
export function ColonyPixelBird({
  entry,
  size,
  walkPhase = 0,
}: ColonyPixelBirdProps) {
  const speciesId = useMemo(() => matchPocketBirdSpecies(entry), [entry]);
  const pixels = useMemo(
    () => getPocketBirdWalkFrame(speciesId, walkPhase),
    [speciesId, walkPhase],
  );

  return <PocketBirdRenderer pixels={pixels} size={size} />;
}
