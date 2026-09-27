/** Authoring-layout math recovered from #7/#8; NOT the runtime renderer.
 * Paired against requiredMouth in grill-geometry.mjs by grill-art.test.ts. */
export interface GrillArtStandard {
  bedWidthOnScreen: number;
  maxBedWidthOnScreen: number;
  foodU: [number, number];
  cellSlackW: number;
  cellSlackH: number;
  foodFootprint: { width: number; height: number };
  proceduralBedWidth: number;
  proceduralBedHeight: number;
  maxTiltDeg: number;
}

export interface GrillCap {
  zoneCount: number;
  slotsPerZone: number;
}

/** Width, in design px, that the painted opening is scaled to for one evolution's grid. */
export function grillBedWidthOnScreen(art: GrillArtStandard, cap: GrillCap): number {
  const usable = art.foodU[1] - art.foodU[0];
  const slots = Math.max(1, cap.slotsPerZone);
  // Never worse than the procedural fallback: a painted grill that shrinks the player's workspace
  // is a downgrade dressed as an upgrade.
  const procCellW = (usable * art.proceduralBedWidth) / slots;
  const wantCellW = Math.max(procCellW, art.foodFootprint.width);
  return Math.min(
    art.maxBedWidthOnScreen,
    Math.max(art.bedWidthOnScreen, Math.ceil((wantCellW * slots) / usable)),
  );
}

/** The minimum height one heat band must have, so a piece of food never leans on its neighbour. */
export function grillBandHeightOnScreen(art: GrillArtStandard): number {
  return Math.ceil(art.foodFootprint.height * art.cellSlackH);
}
