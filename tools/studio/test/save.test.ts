import { describe, expect, it } from 'vitest';
import {
  SAVE_SCHEMA_VERSION, crc32, defaultDaily, defaultProgress, defaultSettings,
  deserializeSave, detectClockTampering, migrate, newSave, resolveDailyClaim,
  serializeSave, stableStringify, unixDay
} from '../../sim-core/src/save.ts';
import { TutorialDirector, restoreTutorialState, type TutorialTable } from '../../sim-core/src/tutorial.ts';
import type { AnalyticsEvent } from '../../sim-core/src/analytics.ts';
import { readJson } from '../load-data.ts';

const NOW = 1_758_100_000;
const tutorialTable = readJson('tutorial.json') as TutorialTable;

/** An envelope exactly as an older build would have written it. */
function envelopeAt(version: number, payload: object): string {
  return JSON.stringify({ v: version, crc: crc32(stableStringify(payload)), payload });
}

describe('save serialisation', () => {
  it('round-trips a fresh save', () => {
    const s = newSave('install-1', NOW);
    const out = deserializeSave(serializeSave(s));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.save.installId).toBe('install-1');
      expect(out.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
      expect(out.save.player.level).toBe(1);
    }
  });

  it('round-trips a heavily mutated save', () => {
    const s = newSave('install-2', NOW);
    s.player.coins = 1_234_567;
    s.player.embers = 42;
    s.player.upgradeLevels = { grill_size: 8, gerente: 4 };
    s.progress.achievements = { first_perfect: 1, combo_10: 1 };
    s.progress.collection = { c_picanha: true };
    s.progress.mastery = { picanha: 12 };
    s.settings.musicVolume = 0.25;
    s.settings.qualityLevel = 'LOW';
    s.daily.streak = 9;

    const out = deserializeSave(serializeSave(s));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.save.player.coins).toBe(1_234_567);
      expect(out.save.player.upgradeLevels['grill_size']).toBe(8);
      expect(out.save.progress.mastery['picanha']).toBe(12);
      expect(out.save.settings.qualityLevel).toBe('LOW');
      expect(out.save.daily.streak).toBe(9);
    }
  });

  it('detects corruption', () => {
    const raw = serializeSave(newSave('install-3', NOW));
    const tampered = raw.replace('"coins":0', '"coins":999999');
    const out = deserializeSave(tampered);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('checksum_mismatch');
  });

  it('detects truncation', () => {
    const raw = serializeSave(newSave('install-4', NOW));
    const out = deserializeSave(raw.slice(0, Math.floor(raw.length / 2)));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('invalid_json');
  });

  it('rejects garbage and non-envelope payloads', () => {
    expect(deserializeSave('not json').ok).toBe(false);
    expect(deserializeSave('{"hello":1}').ok).toBe(false);
    expect(deserializeSave('{"v":1,"crc":0}').ok).toBe(false);
  });

  it('produces a checksum independent of key insertion order', () => {
    const a = stableStringify({ b: 1, a: 2, c: { y: [1, 2], x: 'z' } });
    const b = stableStringify({ a: 2, c: { x: 'z', y: [1, 2] }, b: 1 });
    expect(a).toBe(b);
    expect(crc32(a)).toBe(crc32(b));
  });

  it('has a stable, well-known CRC-32 value', () => {
    // IEEE CRC-32 of the ASCII string "123456789" is 0xCBF43926.
    expect(crc32('123456789')).toBe(0xcbf43926);
  });
});

describe('migration', () => {
  it('fills in missing blocks without throwing', () => {
    const broken = { schemaVersion: 0, savedAtUnixSec: NOW, deviceClockUnixSec: NOW, totalPlayTimeSec: 0, installId: 'x' } as never;
    const migrated = migrate(broken, 0);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.player).toBeDefined();
    expect(migrated.daily).toBeDefined();
    expect(migrated.settings).toBeDefined();
    expect(migrated.progress).toBeDefined();
  });

  it('preserves existing data through migration', () => {
    const s = newSave('install-5', NOW);
    s.player.coins = 999;
    const migrated = migrate(s, 1);
    expect(migrated.player.coins).toBe(999);
  });

  it('grants the starter grill to a pre-v2 save that had none', () => {
    const s = newSave('install-v1', NOW);
    const player = { ...s.player } as { churrasqueiraId?: string; churrasqueiraLevels?: Record<string, number> };
    delete player.churrasqueiraId;
    delete player.churrasqueiraLevels;
    s.player = player as typeof s.player;
    const migrated = migrate(s, 1);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.player.churrasqueiraId).toBe('lata_valente');
    expect(migrated.player.churrasqueiraLevels['lata_valente']).toBe(1);
  });
});

describe('FTUE state (v3, docs/05-UX_FLOW.md §4)', () => {
  it('a fresh save has no FTUE record yet, so the first launch starts at step 1', () => {
    const s = newSave('ftue-1', NOW);
    expect(s.progress.tutorial).toBeNull();
    expect(s.progress.ftueDone).toBe(false);
    const state = restoreTutorialState(tutorialTable, s.progress.tutorial, s.progress.ftueDone);
    expect(state.step).toBe(1);
    expect(state.started).toBe(false);
  });

  it('carries the director across a save and load: the run resumes and never re-sends a step', () => {
    const first: AnalyticsEvent[] = [];
    const d1 = new TutorialDirector(tutorialTable, null, (e) => first.push(e));
    d1.start();
    d1.tick(3);
    d1.report('placed');
    d1.miss();
    d1.tick(4);
    d1.report('flipped');

    const s = newSave('ftue-2', NOW);
    s.progress.tutorial = d1.state;
    s.progress.ftueDone = d1.done;
    const loaded = deserializeSave(serializeSave(s));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save.progress.tutorial).toEqual(d1.state);

    const again: AnalyticsEvent[] = [];
    const d2 = new TutorialDirector(
      tutorialTable,
      restoreTutorialState(tutorialTable, loaded.save.progress.tutorial, loaded.save.progress.ftueDone),
      (e) => again.push(e)
    );
    expect(d2.current?.id).toBe('serve');
    expect(d2.state.misses).toBe(1);
    expect(d2.elapsedMs).toBe(7000);
    d2.start(); // idempotent: tutorial_start went out before the save
    d2.report('served');
    expect(again.map((e) => e.name)).toEqual(['tutorial_step']);
    expect(again[0]!.params).toEqual({ step: 'serve', step_index: 3, elapsed_ms: 7000 });
  });

  it('a pre-v3 save is a returning player: the FTUE counts as done', () => {
    const v2 = newSave('ftue-3', NOW) as unknown as { schemaVersion: number; progress: Record<string, unknown> };
    v2.schemaVersion = 2;
    delete v2.progress['tutorial'];
    delete v2.progress['ftueDone'];
    const out = deserializeSave(envelopeAt(2, v2));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(out.save.progress.ftueDone).toBe(true);
    expect(out.save.progress.tutorial).toBeNull();
    const events: AnalyticsEvent[] = [];
    const d = new TutorialDirector(
      tutorialTable,
      restoreTutorialState(tutorialTable, out.save.progress.tutorial, out.save.progress.ftueDone),
      (e) => events.push(e)
    );
    expect(d.done).toBe(true);
    d.start();
    expect(events).toEqual([]);
  });

  it('a v3 save with the FTUE fields missing or mangled still loads, as a fresh run', () => {
    const v3 = newSave('ftue-4', NOW) as unknown as { progress: Record<string, unknown> };
    delete v3.progress['tutorial'];
    v3.progress['ftueDone'] = 'yes';
    const out = deserializeSave(envelopeAt(3, v3));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.save.progress.tutorial).toBeNull();
    expect(out.save.progress.ftueDone).toBe(false);
  });

  it('migration does not mutate the save it was given', () => {
    const s = newSave('ftue-5', NOW);
    const before = JSON.stringify(s.progress);
    migrate(s, 2);
    expect(JSON.stringify(s.progress)).toBe(before);
  });
});

describe('clock tampering', () => {
  it('flags a backwards clock jump', () => {
    const s = newSave('install-6', NOW);
    expect(detectClockTampering(s, NOW - 3600).tampered).toBe(true);
  });

  it('tolerates small drift and forward time', () => {
    const s = newSave('install-7', NOW);
    expect(detectClockTampering(s, NOW - 30).tampered).toBe(false);
    expect(detectClockTampering(s, NOW + 86400).tampered).toBe(false);
  });
});

describe('daily streak', () => {
  const day = 86400;

  it('starts at streak 1 on the first claim', () => {
    const s = newSave('a', NOW);
    const r = resolveDailyClaim(s, NOW, 7, 1);
    expect(r.canClaim).toBe(true);
    expect(r.streak).toBe(1);
  });

  it('cannot be claimed twice on the same day', () => {
    const s = newSave('a', NOW);
    s.daily.lastClaimUnixDay = unixDay(NOW);
    expect(resolveDailyClaim(s, NOW, 7, 1).canClaim).toBe(false);
  });

  it('advances on consecutive days', () => {
    const s = newSave('a', NOW);
    s.daily.lastClaimUnixDay = unixDay(NOW) - 1;
    s.daily.streak = 5;
    s.daily.lastClaimDayIndex = 4;
    const r = resolveDailyClaim(s, NOW, 7, 1);
    expect(r.streak).toBe(6);
    expect(r.dayIndex).toBe(5);
  });

  it('does NOT reset on a single missed day (grace, spec §28)', () => {
    const s = newSave('a', NOW);
    s.daily.lastClaimUnixDay = unixDay(NOW) - 2; // missed one day
    s.daily.streak = 5;
    const r = resolveDailyClaim(s, NOW, 7, 1);
    expect(r.streak).toBe(6);
  });

  it('resets after the grace period is exceeded', () => {
    const s = newSave('a', NOW);
    s.daily.lastClaimUnixDay = unixDay(NOW) - 5;
    s.daily.streak = 5;
    expect(resolveDailyClaim(s, NOW, 7, 1).streak).toBe(1);
  });

  it('wraps the 7-day cycle', () => {
    const s = newSave('a', NOW);
    s.daily.lastClaimUnixDay = unixDay(NOW) - 1;
    s.daily.lastClaimDayIndex = 6;
    expect(resolveDailyClaim(s, NOW, 7, 1).dayIndex).toBe(0);
  });
});

describe('defaults', () => {
  it('ship with safe values', () => {
    const s = defaultSettings();
    expect(s.musicVolume).toBeGreaterThan(0);
    expect(s.sfxVolume).toBeGreaterThan(0);
    expect(s.locale).toBe('pt-BR');
    expect(defaultDaily().streak).toBe(0);
    expect(defaultProgress().pass.claimedFree).toEqual([]);
    expect(defaultProgress().tutorial).toBeNull();
    expect(defaultProgress().ftueDone).toBe(false);
  });
});
