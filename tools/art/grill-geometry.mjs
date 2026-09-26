/**
 * The painted-grill geometry standard (docs/04 §5.1, docs/22 §6.8) — one rule, derived.
 *
 * A grill's painted opening is not a stylistic choice. The game maps the food grid onto it:
 * `toGrillScreen` puts a slot at u ∈ [foodU] across the opening and a zone at v ∈ [0,1] down it,
 * and the sprite is scaled so the opening's bbox is `bedWidthOnScreen` wide. So the opening has
 * to be tall enough for `zoneCount` bands and wide enough for `slotsPerZone` items, at the size
 * the game actually draws food. Measure the art against that, and "a boca está pequena" stops
 * being an opinion.
 *
 * Everything here reads `shared/data` — `grill.json.art` (the standard) and
 * `churrasqueiras.json` (zones/slots per evolution). No constant is duplicated from the engine.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

export async function loadStandard(root = ROOT) {
  const [grill, churr] = await Promise.all([
    JSON.parse(await readFile(join(root, 'shared', 'data', 'grill.json'), 'utf8')),
    JSON.parse(await readFile(join(root, 'shared', 'data', 'churrasqueiras.json'), 'utf8')),
  ]);
  const art = grill.art;
  if (!art) throw new Error('grill.json has no `art` block — the perspective standard is missing');
  return { art, churrasqueiras: churr.churrasqueiras, root };
}

/** The grid one evolution promises: Z bands × S slots. */
export function capacity(standard, churrasqueiraId, evoLevel) {
  const ch = standard.churrasqueiras.find((c) => c.id === churrasqueiraId);
  if (!ch) throw new Error(`churrasqueira ${churrasqueiraId} is not in churrasqueiras.json`);
  const evo = ch.evolutions.find((e) => e.level === evoLevel) ?? ch.evolutions[0];
  return {
    // rótulo só para o relatório de medição — a tabela carrega chave de l10n, não texto
    id: ch.id, name: (evo.shortNameKey ?? '').split('.').slice(-2).join(' ') || ch.id, evo: evo.level, style: ch.visual?.style ?? '',
    zoneCount: evo.zoneCount, slotsPerZone: evo.slotsPerZone,
    capacity: evo.zoneCount * evo.slotsPerZone,
  };
}

/**
 * What the opening must be, in screen px, for one evolution.
 *
 * `bedW` is the width the engine scales the opening's bbox to; the slots live inside the u range,
 * so a grill with more slots gets a wider bed (that is the "paguei por mais grelha, quero mais
 * grelha" rule the art and the engine now share). The height is one band per zone.
 */
export function requiredMouth(art, cap) {
  const [u0, u1] = art.foodU;
  const food = art.foodFootprint;
  const usable = u1 - u0;                       // the part of the bed the slots live in
  const procCellW = (usable * art.proceduralBedWidth) / cap.slotsPerZone;
  const wantCellW = Math.max(procCellW, food.width);
  const bedW = Math.min(art.maxBedWidthOnScreen, Math.max(art.bedWidthOnScreen, Math.ceil((wantCellW * cap.slotsPerZone) / usable)));
  // One honest band per zone, and the band is measured with the *same* rounded number the gate
  // will demand (`minCellH`). Ceil-ing the total instead of the band let the guide ask 119 px of
  // mouth while the check wanted 2 × 60 = 120 px — an art piece could not win that, and a grader
  // that rejects exact compliance with its own instruction is not a grader.
  const minCellH = Math.ceil(food.height * art.cellSlackH);
  const mouthH = Math.max(cap.zoneCount * minCellH, minCellH, 1);
  const cellW = (usable * bedW) / cap.slotsPerZone;
  const cellH = mouthH / cap.zoneCount;
  return {
    // `cells` = a pintura mostra uma divisória por vaga, então cada célula tem de comportar o prato;
    // `open` = leito contínuo e o prato é colocado pelo motor na escala da vaga. Não é escape: é a
    // única leitura honesta de 59 px de célula contra 86 px de comida (docs/23 §5).
    bedKind: cap.slotsPerZone <= (art.paintedCellsMaxSlots ?? 3) ? 'cells' : 'open',
    bedW, mouthH: Math.min(mouthH, art.proceduralBedHeight),
    aspect: +(bedW / Math.min(mouthH, art.proceduralBedHeight)).toFixed(2),
    cellW: Math.round(cellW), cellH: Math.round(cellH),
    minCellW: Math.round(Math.min(procCellW, food.width)), minCellH,
    procCellW: Math.round(procCellW),
  };
}

/**
 * What a piece of grill art actually gives the player, measured on the painted opening.
 * `mouth` is the detector's output: { bbox: [x,y,w,h], tiltDeg }.
 */
export function measuredMouth(art, sprite, cap) {
  const [u0, u1] = art.foodU;
  const food = art.foodFootprint;
  const [, , mw, mh] = sprite.hole.bbox;
  const need = requiredMouth(art, cap);
  // The scale below must be the *engine's* scale, so the bed width is read from the promise, not
  // recomputed with a slack of its own: measuring at 395 px while the game scales to 408 px made
  // the report optimistic by 3 %, and an optimistic grader is worse than a strict one.
  const bedW = need.bedW;
  const s = bedW / mw;                      // the engine's scale: opening bbox → bedW px wide
  const mouthHScreen = mh * s;
  const tooTall = mouthHScreen > art.proceduralBedHeight + 0.5;
  const cellW = (u1 - u0) * bedW / cap.slotsPerZone;
  const cellH = mouthHScreen / cap.zoneCount;
  return {
    bedW: Math.round(bedW), mouthW: Math.round(mw), mouthH: Math.round(mh),
    mouthHScreen: Math.round(mouthHScreen), areaFrac: sprite.hole.areaFrac,
    tiltDeg: sprite.hole.tiltDeg ?? 0,
    cellW: Math.round(cellW), cellH: Math.round(cellH),
    aspect: +(mw / mh).toFixed(2),
    need,
    tooTall: mouthHScreen > art.proceduralBedHeight + 0.5,
    // Half a pixel of tolerance: the numbers above are ceil-ed twice (once into the guide, once
    // into the threshold), so art that obeys the guide exactly can land 0.4 px short. A gate that
    // rejects compliance is noise; real failures here are 10 px and up.
    bedKind: need.bedKind,
    plateFits: cellW >= food.width - 0.5,
    ok: cellW >= need.minCellW - 0.5 && cellH >= need.minCellH - 0.5 && !tooTall
      && Math.abs(sprite.hole.tiltDeg ?? 0) <= art.maxTiltDeg
      // Leito de células: a divisória pintada é uma promessa ao jogador, então o prato tem de caber
      // nela. Leito aberto: a promessa é só a faixa por fileira, e a escala da comida é do motor.
      && (need.bedKind !== 'cells' || cellW >= food.width - 0.5),
    why: [
      cellW < need.minCellW ? `vaga de ${Math.round(cellW)} px < o mínimo ${need.minCellW} px (fallback dá ${need.procCellW})` : '',
      need.bedKind === 'cells' && cellW < food.width - 0.5
        ? `leito de células com ${cap.slotsPerZone} vagas de ${Math.round(cellW)} px < prato de ${food.width} px — ou pinta leito aberto, ou o grid desce para ≤ ${art.paintedCellsMaxSlots}` : '',
      cellH < need.minCellH ? `faixa de ${Math.round(cellH)} px < ${need.minCellH} px (comida de ${food.height} px)` : '',
      // A boca quadrada passa na régua de comida e mesmo assim estraga a tela: ao escalar a boca
      // para `bedW`, a grelha pintada fica mais alta que o leito procedural que ela substitui.
      // É por isso que a razão da boca — não só a área — é parte do padrão.
      tooTall ? `boca de ${Math.round(mouthHScreen)} px de altura na tela > leito procedural ${art.proceduralBedHeight} px (boca quadrada demais; a razão pedida é ${need.aspect}:1)` : '',
      Math.abs(sprite.hole.tiltDeg ?? 0) > art.maxTiltDeg
        ? `topo inclinado ${sprite.hole.tiltDeg}° (máx ${art.maxTiltDeg}°)` : '',
    ].filter(Boolean).join('; '),
  };
}

/** Every approved (or pending) grill in the manifest, measured against its own promise. */
export async function report(standard, { only = null } = {}) {
  const { art, root } = standard;
  const manifest = JSON.parse(await readFile(join(root, 'Assets', 'Art', 'sprites.manifest.json'), 'utf8'));
  const rows = [];
  for (const [name, e] of Object.entries(manifest.sprites)) {
    const m = name.match(/^spr_grill_(.+)_evo(\d+)$/);
    if (!m || !e.hole) continue;
    const [_, id, lvl] = m;
    if (only && !only.includes(id)) continue;
    const cap = capacity(standard, id, +lvl);
    rows.push({ name, cap, need: requiredMouth(art, cap), got: measuredMouth(art, e, cap) });
  }
  // the ladder itself: capacity must grow with the progression, and the art must not invert it
  const ladder = standard.churrasqueiras.flatMap((c) =>
    c.evolutions.map((e) => ({ id: c.id, evo: e.level, cap: e.zoneCount * e.slotsPerZone })));
  return { rows, ladder, art };
}

// ── conforming a painted opening to the standard ────────────────────────────
// A diffusion model does not measure pixels: three prompt rounds for a ~2:1 opening returned
// 1.31:1, 1.85:1, 2.24:1, 2.77:1 and 2.88:1. Chasing the number in prose is not a plan, but the
// opening is *empty space* — the geometry the game reads — so the pipeline finishes it: scale the
// art vertically until the opening holds its bands, and scale the recorded hole with it.
// See tools/art/conform-mouth.mjs (the CLI) and process-sprites.mjs (on the way in).

export const CONFORM_LIMIT = 0.7; // ±70 %: past that the object stops being the object — regenerate

/**
 * The vertical factor that puts a painted mouth inside the standard, or null when it is already.
 * `f > 1` = the bands are too shallow for the zones (food would overlap between rows);
 * `f < 1` = the mouth is so tall the grill outdraws the procedural bed it replaced.
 */
export function conformFactor(art, sprite, cap, { limit = CONFORM_LIMIT } = {}) {
  const got = measuredMouth(art, sprite, cap);
  const ceil = art.proceduralBedHeight;
  const floorH = cap.zoneCount * got.need.minCellH;
  if (got.ok || (got.mouthHScreen >= Math.min(ceil, Math.max(floorH, 1)) - 0.5 && got.mouthHScreen <= ceil + 0.5)) return null;
  const target = got.mouthHScreen > ceil ? ceil : floorH;
  const f = target / got.mouthHScreen;
  if (Math.abs(f - 1) > limit) {
    return { error: `conformaria por ×${f.toFixed(2)} (> ${(1 + limit).toFixed(1)}×): a boca está longe demais do pedido — regenere, não esprema` };
  }
  return {
    f, target, got,
    why: got.mouthHScreen > ceil ? 'boca alta demais para a tela' : 'faixa de brasa rasa demais para a comida',
  };
}

/** The hole is data the engine reads, so the conform moves it with the pixels. */
export function scaleHole(hole, f) {
  const tilt = ((hole.tiltDeg ?? 0) * Math.PI) / 180;
  return {
    ...hole,
    bbox: [hole.bbox[0], Math.round(hole.bbox[1] * f), hole.bbox[2], Math.round(hole.bbox[3] * f)],
    quad: hole.quad ? hole.quad.map(([x, y]) => [x, Math.round(y * f)]) : hole.quad,
    tiltDeg: +((Math.atan(Math.tan(tilt) * f) * 180) / Math.PI).toFixed(1),
  };
}
