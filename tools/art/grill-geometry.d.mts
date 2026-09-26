/**
 * Types for the art-geometry module, which is plain `.mjs` because the art pipeline runs with bare
 * `node` (no build step) while `tsc --noEmit` still has to be able to grade it. Keep this in sync
 * with `grill-geometry.mjs`; `tools/studio/test/grill-art.test.ts` pins the behaviour, this file
 * only pins the shapes.
 */
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
  camera?: Record<string, unknown>;
  _comment?: string;
}

export interface GrillCap {
  id?: string;
  name?: string;
  evo?: number;
  style?: string;
  zoneCount: number;
  slotsPerZone: number;
}

export interface MouthPromise {
  bedW: number;
  mouthH: number;
  aspect: number;
  cellW: number;
  cellH: number;
  minCellW: number;
  minCellH: number;
  procCellW: number;
}

export interface MouthMeasurement {
  bedW: number;
  mouthW: number;
  mouthH: number;
  mouthHScreen: number;
  areaFrac: number;
  tiltDeg: number;
  cellW: number;
  cellH: number;
  aspect: number;
  need: MouthPromise;
  tooTall: boolean;
  ok: boolean;
  why: string;
}

export interface Standard {
  art: GrillArtStandard;
  churrasqueiras: {
    id: string;
    visual?: { style?: string };
    evolutions: { level: number; zoneCount: number; slotsPerZone: number; shortName?: string }[];
  }[];
  root: string;
}

export function loadStandard(root?: string): Promise<Standard>;
export function capacity(standard: Standard, churrasqueiraId: string, evoLevel: number): GrillCap;
export function requiredMouth(art: GrillArtStandard, cap: GrillCap): MouthPromise;
export function measuredMouth(
  art: GrillArtStandard,
  sprite: { w?: number; h?: number; hole: { bbox: number[]; quad?: number[][]; tiltDeg?: number; areaFrac?: number } },
  cap: GrillCap,
): MouthMeasurement;
export const CONFORM_LIMIT: number;
export function conformFactor(
  art: GrillArtStandard,
  sprite: { hole: { bbox: number[]; quad?: number[][]; tiltDeg?: number } },
  cap: GrillCap,
  opts?: { limit?: number },
): { f: number; target: number; got: MouthMeasurement; why: string } | { error: string } | null;
export function scaleHole<T extends { bbox: number[]; quad?: number[][]; tiltDeg?: number }>(hole: T, f: number): T;
export function report(
  standard: Standard,
  opts?: { only?: string[] | null },
): Promise<{
  rows: { name: string; cap: GrillCap; need: MouthPromise; got: MouthMeasurement }[];
  ladder: { id: string; evo: number; cap: number }[];
  art: GrillArtStandard;
}>;
