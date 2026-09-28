/**
 * "Escola da Brasa" — geometry and drawing for the lesson deck (docs/05-UX_FLOW.md §4).
 *
 * The FTUE teaches three gestures by doing; this deck explains the rest of the
 * turn in words the player can re-read: heat rows, patience, combo, the two
 * refills and what XP is for. Content lives in `shared/data/tutorial.json`
 * (`school.lessons`), so adding a lesson never touches this file.
 *
 * Pure drawing + rects, like cooking-ui.ts: `main.ts` owns the state and the
 * payout, this module owns the pixels. Canvas is the fixed 420×780 portrait.
 */
import type { SchoolIcon } from '../../tools/sim-core/src/tutorial.ts';
import type { Rect } from './ftue.ts';
import { wrapWords } from './ftue.ts';
import {
  C, DISPLAY, UI, avatar, coinIcon, flameIcon, font, glass, outlinedText, panel, premiumButton,
  roundRectPath, starIcon
} from './theme.ts';

const W = 420;

/** Card that holds one lesson. Everything else is measured from it. */
export const SCHOOL_CARD: Rect = { x: 22, y: 118, w: W - 44, h: 396, r: 26 };
/** Previous lesson. Ghost (and inert) on the first card. */
export const SCHOOL_BACK: Rect = { x: 22, y: 574, w: 104, h: 60, r: 18 };
/** Next lesson / claim the reward / close — the one button that always moves forward. */
export const SCHOOL_NEXT: Rect = { x: 138, y: 574, w: W - 160, h: 60, r: 18 };
/** Same row as SCHOOL_NEXT, but full width: the reward card has nothing to go back to. */
export const SCHOOL_WIDE: Rect = { x: 22, y: 574, w: W - 44, h: 60, r: 18 };
/** Jumps to the last card (the reward), for players who do not want to read. */
export const SCHOOL_SKIP: Rect = { x: 120, y: 652, w: 180, h: 48, r: 16 };
/** Centre of the progress dots. */
export const SCHOOL_DOTS = { x: W / 2, y: 542 };

export function schoolTargets(): Rect[] {
  return [SCHOOL_BACK, SCHOOL_NEXT, SCHOOL_SKIP];
}

/** Vector emblems only — an emoji here renders as ☐ on low-end Android (docs/20 P0 #1). */
export function drawSchoolEmblem(ctx: CanvasRenderingContext2D, icon: SchoolIcon, cx: number, cy: number, r: number, t: number): void {
  ctx.save();
  // Warm disc behind every emblem, so the six cards share one silhouette.
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
  g.addColorStop(0, 'rgba(255,196,120,0.30)');
  g.addColorStop(1, 'rgba(40,24,14,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,160,0.45)'; ctx.lineWidth = 2; ctx.stroke();

  if (icon === 'bench') {
    // A cut of meat on the bench slab.
    ctx.fillStyle = C.madeiraPinho;
    roundRectPath(ctx, cx - r * 0.62, cy + r * 0.24, r * 1.24, r * 0.26, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRectPath(ctx, cx - r * 0.5, cy + r * 0.16, r, r * 0.12, 3); ctx.fill();
    // two cuts resting on the slab
    for (const [dx, w2, col] of [[-r * 0.26, r * 0.42, '#9E4430'], [r * 0.26, r * 0.42, '#7E3526']] as const) {
      ctx.fillStyle = col;
      roundRectPath(ctx, cx + dx - w2 / 2, cy - r * 0.34, w2, r * 0.5, r * 0.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,150,0.35)';
      roundRectPath(ctx, cx + dx - w2 / 2 + 2, cy - r * 0.28, w2 - 4, r * 0.12, 3); ctx.fill();
    }
  } else if (icon === 'flame') {
    flameIcon(ctx, cx, cy + 4, r * 0.62, true);
  } else if (icon === 'customer') {
    avatar(ctx, cx, cy, r * 0.6, '#C8733F', C.ouroLight);
  } else if (icon === 'coin') {
    coinIcon(ctx, cx, cy, r * 0.58);
    starIcon(ctx, cx + r * 0.62, cy - r * 0.6, 8, { filled: true, glow: true });
  } else if (icon === 'charcoal') {
    // Charcoal bed with a gauge under it — the same pair of refills the HUD shows.
    ctx.fillStyle = '#2B1D16';
    for (const [dx, dy, rr] of [[-14, -2, 10], [2, -6, 11], [14, 2, 9]] as const) {
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); ctx.fill();
    }
    const glow = 0.55 + 0.45 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,120,40,${0.35 + 0.35 * glow})`;
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
    roundRectPath(ctx, cx - 22, cy + 18, 44, 7, 3.5); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    roundRectPath(ctx, cx - 22, cy + 18, 44 * (0.35 + 0.25 * glow), 7, 3.5); ctx.fillStyle = C.chama; ctx.fill();
  } else {
    // xp
    starIcon(ctx, cx, cy - 4, r * 0.52, { filled: true, glow: true });
    ctx.font = font(13, 900, DISPLAY); ctx.textAlign = 'center'; ctx.fillStyle = C.ouroLight;
    ctx.fillText('XP', cx, cy + r * 0.62);
  }
  ctx.restore();
}

/** One lesson: emblem, title, body. Returns the card rect for hit-testing symmetry. */
export function drawSchoolCard(
  ctx: CanvasRenderingContext2D,
  o: { icon: SchoolIcon; title: string; body: string; t: number }
): Rect {
  const r = SCHOOL_CARD;
  panel(ctx, r.x, r.y, r.w, r.h, {
    r: r.r ?? 26, top: 'rgba(58,42,30,0.98)', bottom: 'rgba(24,16,10,0.98)',
    border: 'rgba(255,214,160,0.30)', borderWidth: 1.5, shadow: 22, innerGlow: true, glowTop: 'rgba(255,220,160,0.22)'
  });
  drawSchoolEmblem(ctx, o.icon, W / 2, r.y + 84, 50, o.t);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(21, 900, DISPLAY);
  const titleLines = wrapWords(ctx, o.title, r.w - 48);
  let y = r.y + 178;
  for (const line of titleLines) {
    outlinedText(ctx, line, W / 2, y, C.ouroLight, 21, { weight: 900, outline: 3 });
    y += 27;
  }
  // Hairline under the title, so the body reads as the explanation of it.
  ctx.strokeStyle = 'rgba(255,214,160,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(r.x + 46, y - 6); ctx.lineTo(r.x + r.w - 46, y - 6); ctx.stroke();

  ctx.font = font(15, 600, UI);
  ctx.fillStyle = 'rgba(244,231,211,0.88)';
  const bodyLines = wrapWords(ctx, o.body, r.w - 56);
  y += 22;
  for (const line of bodyLines) {
    ctx.fillText(line, W / 2, y);
    y += 24;
  }
  ctx.restore();
  return r;
}

/** Final card: what the deck just paid, and what that unlocked. */
export function drawSchoolReward(
  ctx: CanvasRenderingContext2D,
  o: { xpLine: string; levelLine: string | null; unlockLine: string; t: number }
): Rect {
  const r = SCHOOL_CARD;
  panel(ctx, r.x, r.y, r.w, r.h, {
    r: r.r ?? 26, top: 'rgba(74,54,24,0.98)', bottom: 'rgba(28,18,8,0.98)',
    border: C.ouro, borderWidth: 2, shadow: 24, innerGlow: true, glowTop: 'rgba(255,225,160,0.30)'
  });
  const cx = W / 2;
  const pulse = 0.5 + 0.5 * Math.sin(o.t * 4);
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.25 * pulse;
  ctx.fillStyle = 'rgba(255,196,90,0.5)';
  ctx.beginPath(); ctx.arc(cx, r.y + 96, 70 + 6 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  starIcon(ctx, cx, r.y + 96, 46, { filled: true, glow: true });

  ctx.save();
  ctx.textAlign = 'center';
  outlinedText(ctx, o.xpLine, cx, r.y + 202, C.ouroLight, 26, { weight: 900, outline: 3 });
  if (o.levelLine) {
    outlinedText(ctx, o.levelLine, cx, r.y + 244, C.perola, 20, { weight: 900, outline: 3 });
  }
  ctx.font = font(15, 600, UI);
  ctx.fillStyle = 'rgba(244,231,211,0.9)';
  let y = r.y + (o.levelLine ? 288 : 258);
  for (const line of wrapWords(ctx, o.unlockLine, r.w - 56)) {
    ctx.fillText(line, cx, y);
    y += 24;
  }
  ctx.restore();
  return r;
}

/** Title above the deck. */
export function drawSchoolTitle(ctx: CanvasRenderingContext2D, title: string, counter: string): void {
  outlinedText(ctx, title, W / 2, 74, C.perola, 22, { weight: 900, outline: 3 });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font(11, 700, UI);
  ctx.fillStyle = 'rgba(244,231,211,0.55)';
  ctx.fillText(counter, W / 2, 96);
  ctx.restore();
}

/** BACK / NEXT / SKIP. `final` gilds the forward button — that one pays. */
export function drawSchoolButtons(
  ctx: CanvasRenderingContext2D,
  o: { backLabel: string | null; nextLabel: string; skipLabel: string | null; canBack: boolean; final: boolean; t: number }
): void {
  if (o.backLabel !== null) {
    premiumButton(ctx, SCHOOL_BACK.x, SCHOOL_BACK.y, SCHOOL_BACK.w, SCHOOL_BACK.h, { variant: 'ghost', disabled: !o.canBack });
    ctx.save();
    ctx.globalAlpha = o.canBack ? 1 : 0.4;
    outlinedText(ctx, o.backLabel, SCHOOL_BACK.x + SCHOOL_BACK.w / 2, SCHOOL_BACK.y + 37, C.perola, 14, { weight: 900, outline: 2 });
    ctx.restore();
  }

  const next = o.backLabel === null ? SCHOOL_WIDE : SCHOOL_NEXT;
  const pulse = o.final ? 1 + 0.02 * Math.sin(o.t * 6) : 1;
  ctx.save();
  ctx.translate(next.x + next.w / 2, next.y + next.h / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-(next.x + next.w / 2), -(next.y + next.h / 2));
  premiumButton(ctx, next.x, next.y, next.w, next.h, { variant: o.final ? 'gold' : 'primary' });
  outlinedText(ctx, o.nextLabel, next.x + next.w / 2, next.y + 38, C.perola, 17, { weight: 900, outline: 3 });
  ctx.restore();

  if (o.skipLabel) {
    glass(ctx, SCHOOL_SKIP.x, SCHOOL_SKIP.y, SCHOOL_SKIP.w, SCHOOL_SKIP.h, { alpha: 0.14, border: 'rgba(255,214,160,0.35)' });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = font(13, 800, UI);
    ctx.fillStyle = 'rgba(244,231,211,0.75)';
    ctx.fillText(o.skipLabel, SCHOOL_SKIP.x + SCHOOL_SKIP.w / 2, SCHOOL_SKIP.y + 30);
    ctx.restore();
  }
}

/**
 * The contextual one-liner shown during a guided step, in the free band above
 * the grill (y 70..150). Drawn after the FTUE scrim so it stays readable.
 */
export function drawLessonBanner(
  ctx: CanvasRenderingContext2D,
  o: { icon: SchoolIcon; title: string; body: string; t: number }
): Rect {
  const rect: Rect = { x: 14, y: 72, w: W - 28, h: 60, r: 18 };
  ctx.save();
  panel(ctx, rect.x, rect.y, rect.w, rect.h, {
    r: 18, top: 'rgba(52,36,24,0.96)', bottom: 'rgba(22,14,9,0.96)',
    border: 'rgba(255,214,160,0.35)', borderWidth: 1.5, shadow: 14
  });
  drawSchoolEmblem(ctx, o.icon, rect.x + 34, rect.y + rect.h / 2, 21, o.t);
  ctx.textAlign = 'left';
  outlinedText(ctx, o.title, rect.x + 64, rect.y + 24, C.ouroLight, 14, { weight: 900, outline: 2, align: 'left' });
  ctx.font = font(11, 600, UI);
  ctx.fillStyle = 'rgba(244,231,211,0.82)';
  let y = rect.y + 40;
  for (const line of wrapWords(ctx, o.body, rect.w - 82).slice(0, 2)) {
    ctx.fillText(line, rect.x + 64, y);
    y += 14;
  }
  ctx.restore();
  return rect;
}

/**
 * Home entry that replays the deck. Wide pill in the free band under the daily
 * strip; when the late-game income strip takes that band it shrinks to a round
 * "?" tucked against the right edge.
 */
export function schoolEntryRect(incomeStripVisible: boolean): Rect {
  return incomeStripVisible
    ? { x: W - 62, y: 212, w: 46, h: 46, r: 23 }
    : { x: 12, y: 204, w: W - 24, h: 50, r: 18 };
}

export function drawSchoolEntry(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  o: { label: string; sub: string; badge: string | null; t: number }
): void {
  const compact = r.w < 80;
  panel(ctx, r.x, r.y, r.w, r.h, {
    r: r.r ?? 18, top: 'rgba(48,34,23,0.95)', bottom: 'rgba(22,15,10,0.95)',
    border: o.badge ? C.ouro : 'rgba(255,214,160,0.22)', borderWidth: o.badge ? 1.6 : 1, shadow: 10, innerGlow: true
  });
  ctx.save();
  if (compact) {
    ctx.textAlign = 'center';
    outlinedText(ctx, '?', r.x + r.w / 2, r.y + r.h / 2 + 8, C.ouroLight, 22, { weight: 900, outline: 3 });
  } else {
    const cx = r.x + 30;
    ctx.fillStyle = 'rgba(255,214,160,0.16)';
    ctx.beginPath(); ctx.arc(cx, r.y + r.h / 2, 16, 0, Math.PI * 2); ctx.fill();
    outlinedText(ctx, '?', cx, r.y + r.h / 2 + 7, C.ouroLight, 19, { weight: 900, outline: 2 });
    ctx.textAlign = 'left';
    ctx.font = font(13, 900, UI);
    ctx.fillStyle = C.perola;
    ctx.fillText(o.label, r.x + 56, r.y + 22);
    ctx.font = font(10, 600, UI);
    ctx.fillStyle = 'rgba(244,231,211,0.55)';
    ctx.fillText(o.sub, r.x + 56, r.y + 38);
    if (o.badge) {
      const bw = 78, bx = r.x + r.w - bw - 12, by = r.y + (r.h - 28) / 2;
      const pulse = 0.5 + 0.5 * Math.sin(o.t * 4);
      ctx.globalAlpha = 0.85 + 0.15 * pulse;
      roundRectPath(ctx, bx, by, bw, 28, 14);
      ctx.fillStyle = C.ouro; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = font(12, 900, UI);
      ctx.fillStyle = C.carvao;
      ctx.fillText(o.badge, bx + bw / 2, by + 19);
    }
  }
  ctx.restore();
}
