/**
 * The painted-grill bed — the one rule the art and the game share (docs/04-ART_STYLE.md §5.1,
 * docs/22-ARTE_2D_PLANO.md §6.8).
 *
 * A grill's painted opening is not decoration the engine has to work around: `toGrillScreen` maps
 * every food slot into the opening's rect, and `drawGrillSprite` scales the sprite so that rect is
 * `bedWidthOnScreen` wide. So the width the game scales to *is* the promise the art is measured
 * against, and it grows with the grid the player paid for: a 3×4 grill gets a wider bed than a
 * 1×2 tin drum, and both get the same per-slot food size. Same numbers as
 * `tools/art/grill-geometry.mjs` (the art gate), pinned against each other by
 * `tools/studio/test/grill-art-parity.test.ts` — if the two drift, an approved sprite stops holding
 * its slots and nobody notices until the player does.
 */

/** The `art` block of `shared/data/grill.json` (generated into GameData by `gen-csharp-types`). */
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
