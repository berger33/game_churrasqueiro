// Escola da Brasa — the lesson deck that follows the guided turn (docs/05-UX_FLOW.md §4).
// The FTUE teaches three gestures by doing; the deck is what makes the player
// understand the *rest* of the turn, and it is the first XP payout of the game.
import { describe, expect, it } from 'vitest';
import { loadDatabase, readJson } from '../load-data.ts';
import { xpForLevel } from '../../sim-core/src/data.ts';
import { SCHOOL_ICONS, lessonForStep, type TutorialTable } from '../../sim-core/src/tutorial.ts';
import {
  SCHOOL_BACK, SCHOOL_CARD, SCHOOL_DOTS, SCHOOL_NEXT, SCHOOL_SKIP, SCHOOL_WIDE, schoolEntryRect
} from '../../../prototype/src/school-ui.ts';
import l10n from '../../../shared/l10n/pt-BR.json' with { type: 'json' };

const W = 420, H = 780;
const db = loadDatabase();
const table = readJson('tutorial.json') as TutorialTable;
const school = table.school;
const strings = l10n as Record<string, string>;

describe('the deck explains every action, not just the three guided gestures', () => {
  it('covers the whole turn: placing, flipping, serving, combo, refills and XP', () => {
    const ids = school.lessons.map(l => l.id);
    expect(ids).toEqual(['brasa', 'ponto', 'servir', 'combo', 'reposicao', 'progresso']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of school.lessons) expect(SCHOOL_ICONS).toContain(l.icon);
  });

  it('pins one lesson to each play step of the script, so the card and the hand agree', () => {
    const playSteps = table.steps.filter(s => s.screen === 'play').map(s => s.id);
    for (const l of school.lessons) {
      if (!l.step) continue;
      expect(playSteps).toContain(l.step);
      expect(lessonForStep(table, l.step)?.id).toBe(l.id);
      // The full body never fits the in-turn banner: those lessons carry a short line.
      expect(l.shortKey).toBeTruthy();
    }
    expect(lessonForStep(table, 'upgrade')).toBeNull();
    expect(lessonForStep(table, null)).toBeNull();
    // The two lessons nothing points at are the ones the guided turn cannot show.
    expect(school.lessons.filter(l => !l.step).map(l => l.id)).toEqual(['reposicao', 'progresso']);
  });

  it('is written in pt-BR, with a title/body/short for every card', () => {
    const keys = [school.titleKey, school.openKey, 'ui.school.next', 'ui.school.back', 'ui.school.claim',
      'ui.school.close', 'ui.school.progress', 'ui.school.reward', 'ui.school.levelUp', 'ui.school.unlocked',
      'ui.school.noUnlock', 'ui.school.entrySub'];
    for (const l of school.lessons) keys.push(l.titleKey, l.bodyKey, ...(l.shortKey ? [l.shortKey] : []));
    for (const k of keys) expect(strings[k], `missing pt-BR string ${k}`).toBeTruthy();
    // Body copy has to survive the 5-line card; the banner line has to survive two.
    for (const l of school.lessons) {
      expect(strings[l.titleKey]!.length).toBeLessThanOrEqual(40);
      expect(strings[l.bodyKey]!.length).toBeLessThanOrEqual(210);
      if (l.shortKey) expect(strings[l.shortKey]!.length).toBeLessThanOrEqual(60);
    }
    expect(strings['ui.school.claim']).toContain('{xp}');
    expect(strings['ui.school.unlocked']).toContain('{name}');
  });
});

describe('finishing the deck actually opens something new to cook', () => {
  const { a, exponent, minPerLevel } = db.economy.xp.formula;

  it('pays enough XP to reach level 2 from a fresh install', () => {
    expect(school.rewardXp).toBeGreaterThanOrEqual(xpForLevel(1, a, exponent, minPerLevel));
    // …and not so much that it skips straight past level 2's content.
    expect(school.rewardXp).toBeLessThan(
      xpForLevel(1, a, exponent, minPerLevel) + xpForLevel(2, a, exponent, minPerLevel)
    );
  });

  it('unlocks a second cut at that level, in the FTUE restaurant', () => {
    const ftueRestaurant = 0;
    const atLevel1 = db.ingredients.items.filter(i => i.unlock.level <= 1 && i.unlock.restaurantIndex <= ftueRestaurant);
    const atLevel2 = db.ingredients.items.filter(i => i.unlock.level <= 2 && i.unlock.restaurantIndex <= ftueRestaurant);
    expect(atLevel2.length).toBeGreaterThan(atLevel1.length);
    // The deck names what it unlocked, so that ingredient needs a translated name.
    for (const i of atLevel2.filter(x => !atLevel1.includes(x))) expect(strings[i.nameKey]).toBeTruthy();
  });
});

describe('deck geometry stays inside the canvas and inside the thumb zone', () => {
  const rects = { SCHOOL_CARD, SCHOOL_BACK, SCHOOL_NEXT, SCHOOL_WIDE, SCHOOL_SKIP };

  it('keeps every rect on screen', () => {
    for (const [name, r] of Object.entries(rects)) {
      expect(r.x, name).toBeGreaterThanOrEqual(0);
      expect(r.y, name).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, name).toBeLessThanOrEqual(W);
      expect(r.y + r.h, name).toBeLessThanOrEqual(H);
    }
    expect(SCHOOL_CARD.y + SCHOOL_CARD.h).toBeLessThan(SCHOOL_DOTS.y);
    expect(SCHOOL_DOTS.y).toBeLessThan(SCHOOL_NEXT.y);
  });

  it('gives every button a >=48px target and no overlap', () => {
    for (const [name, r] of Object.entries(rects)) {
      if (name === 'SCHOOL_CARD') continue;
      expect(Math.min(r.w, r.h), name).toBeGreaterThanOrEqual(48);
    }
    expect(SCHOOL_BACK.x + SCHOOL_BACK.w).toBeLessThan(SCHOOL_NEXT.x);
    expect(SCHOOL_NEXT.y + SCHOOL_NEXT.h).toBeLessThanOrEqual(SCHOOL_SKIP.y);
    // The reward card swaps both buttons for one wide button on the same row.
    expect(SCHOOL_WIDE.y).toBe(SCHOOL_NEXT.y);
    expect(SCHOOL_WIDE.x).toBeLessThanOrEqual(SCHOOL_BACK.x);
    expect(SCHOOL_WIDE.x + SCHOOL_WIDE.w).toBeGreaterThanOrEqual(SCHOOL_NEXT.x + SCHOOL_NEXT.w);
  });

  it('puts the forward button in the lower half — this deck is tapped one-handed', () => {
    expect(SCHOOL_NEXT.y).toBeGreaterThan(H / 2);
    expect(SCHOOL_WIDE.y).toBeGreaterThan(H / 2);
  });

  it('keeps the Home entry clear of the daily strip and the play card', () => {
    const wide = schoolEntryRect(false);
    expect(wide.y).toBeGreaterThanOrEqual(196);          // daily strip ends at 196
    expect(wide.y + wide.h).toBeLessThanOrEqual(272);    // play card starts at 272
    expect(Math.min(wide.w, wide.h)).toBeGreaterThanOrEqual(48);
    // With the late-game income strip on screen it shrinks, but stays tappable.
    const compact = schoolEntryRect(true);
    expect(Math.min(compact.w, compact.h)).toBeGreaterThanOrEqual(44);
    expect(compact.x + compact.w).toBeLessThanOrEqual(W - 12);
  });
});
