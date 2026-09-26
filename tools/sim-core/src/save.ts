import type { PlayerState } from './economy.ts';
import { DEFAULT_CHARCOAL_TYPE, newPlayerState, STARTER_CHURRASQUEIRA_ID } from './economy.ts';
import type { TutorialState } from './tutorial.ts';

/**
 * Save system (spec §57 / §58).
 *
 * - Versioned envelope with a checksum so a corrupted or truncated file is
 *   detected instead of silently resetting the player.
 * - Two slots are written alternately (`a`/`b`) and the newest valid one wins,
 *   which survives a crash mid-write.
 * - `deviceClockUnixSec` is stored so backward clock changes can be detected
 *   and offline earnings clamped instead of being farmed.
 */

/**
 * v1 → v2: the equipped churrasqueira (`player.churrasqueiraId` / `churrasqueiraLevels`).
 * v2 → v3: the FTUE (`progress.tutorial` / `progress.ftueDone`, docs/05-UX_FLOW.md §4).
 * v3 → v4: the charcoal type (`player.charcoalType`, docs/23-PROGRESSAO_10_BRASAS.md).
 *   Ausente vira `comum`, que reproduz o jogo anterior bit a bit, então save antigo
 *   não muda de ritmo ao abrir no cliente novo.
 */
export const SAVE_SCHEMA_VERSION = 4;

export interface DailyState {
  streak: number;
  lastClaimDayIndex: number;
  lastClaimUnixDay: number;
  missionsRerolledToday: number;
  lastMissionResetUnixDay: number;
  missionIds: string[];
  weeklyMissionIds: string[];
  lastWeeklyResetUnixDay: number;
}

export interface SettingsState {
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  qualityLevel: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
  locale: string;
  notifications: boolean;
  colorBlindMode: boolean;
  reduceMotion: boolean;
}

export interface ProgressState {
  achievements: Record<string, number>;
  collection: Record<string, boolean>;
  mastery: Record<string, number>;
  routeStop: number;
  routeEmberPoints: number;
  unlockedIngredients: string[];
  cosmeticsOwned: string[];
  equipped: Record<string, string>;
  pass: { seasonId: string; xp: number; claimedFree: number[]; claimedPremium: number[]; premiumOwned: boolean };
  leaderboards: Record<string, number>;
  adState: { rewardedToday: Record<string, number>; interstitialsToday: number; lastInterstitialUnixSec: number; dayStamp: number };
  entitlements: string[];
  pendingRewards: { id: string; token: string; grantedAtUnixSec: number }[];
  /**
   * The TutorialDirector's state (tools/sim-core/src/tutorial.ts), so an FTUE
   * interrupted by the app dying resumes at its step and never re-sends a step
   * it already reported. `null` until the first launch creates one. Restore with
   * `restoreTutorialState(table, progress.tutorial, progress.ftueDone)`.
   */
  tutorial: TutorialState | null;
  /**
   * The FTUE is finished or skipped. It wins over `tutorial` on restore: a
   * returning player never redoes the first run, whatever else the save says.
   */
  ftueDone: boolean;
}

export interface SaveGame {
  schemaVersion: number;
  savedAtUnixSec: number;
  deviceClockUnixSec: number;
  totalPlayTimeSec: number;
  installId: string;
  player: PlayerState;
  daily: DailyState;
  settings: SettingsState;
  progress: ProgressState;
}

export function defaultSettings(): SettingsState {
  return {
    musicVolume: 0.6,
    sfxVolume: 0.85,
    haptics: true,
    qualityLevel: 'AUTO',
    locale: 'pt-BR',
    notifications: true,
    colorBlindMode: false,
    reduceMotion: false
  };
}

export function defaultDaily(): DailyState {
  return {
    streak: 0,
    lastClaimDayIndex: 0,
    lastClaimUnixDay: 0,
    missionsRerolledToday: 0,
    lastMissionResetUnixDay: 0,
    missionIds: [],
    weeklyMissionIds: [],
    lastWeeklyResetUnixDay: 0
  };
}

export function defaultProgress(): ProgressState {
  return {
    achievements: {},
    collection: {},
    mastery: {},
    routeStop: 1,
    routeEmberPoints: 0,
    unlockedIngredients: [],
    cosmeticsOwned: [],
    equipped: {},
    pass: { seasonId: '', xp: 0, claimedFree: [], claimedPremium: [], premiumOwned: false },
    leaderboards: {},
    adState: { rewardedToday: {}, interstitialsToday: 0, lastInterstitialUnixSec: 0, dayStamp: 0 },
    entitlements: [],
    pendingRewards: [],
    tutorial: null,
    ftueDone: false
  };
}

export function newSave(installId: string, nowUnixSec: number): SaveGame {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAtUnixSec: nowUnixSec,
    deviceClockUnixSec: nowUnixSec,
    totalPlayTimeSec: 0,
    installId,
    player: newPlayerState(),
    daily: defaultDaily(),
    settings: defaultSettings(),
    progress: defaultProgress()
  };
}

export interface SaveEnvelope {
  v: number;
  crc: number;
  payload: SaveGame;
}

/** CRC-32 (IEEE). Cheap, no dependency, enough to catch corruption/truncation. */
export function crc32(str: string): number {
  let c = ~0;
  for (let i = 0; i < str.length; i++) {
    c ^= str.charCodeAt(i);
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function serializeSave(save: SaveGame): string {
  const payload = stableStringify(save);
  const envelope: SaveEnvelope = { v: SAVE_SCHEMA_VERSION, crc: crc32(payload), payload: JSON.parse(payload) as SaveGame };
  return JSON.stringify(envelope);
}

export type LoadResult = { ok: true; save: SaveGame } | { ok: false; reason: string };

export function deserializeSave(raw: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  const env = parsed as Partial<SaveEnvelope>;
  if (!env || typeof env !== 'object' || !env.payload) return { ok: false, reason: 'missing_payload' };
  if (typeof env.v !== 'number') return { ok: false, reason: 'missing_version' };
  const payloadStr = stableStringify(env.payload);
  if (crc32(payloadStr) !== env.crc) return { ok: false, reason: 'checksum_mismatch' };
  const migrated = migrate(env.payload, env.v);
  return { ok: true, save: migrated };
}

/** Forward-only migrations. Never throws: unknown versions fall back to defaults for missing blocks. */
export function migrate(save: SaveGame, fromVersion: number): SaveGame {
  const out: SaveGame = { ...save };
  if (fromVersion < 1 || !out.player) out.player = newPlayerState();
  if (!out.daily) out.daily = defaultDaily();
  if (!out.settings) out.settings = defaultSettings();
  if (!out.progress) out.progress = defaultProgress();
  // v2: equipped grill. Pre-v2 saves had no churrasqueira fields; grant the starter.
  // v4: tipo de carvão. Save antigo nunca pediu um — entra o padrão, não um palpite.
  if (!out.player.charcoalType) out.player.charcoalType = DEFAULT_CHARCOAL_TYPE;
  if (!out.player.churrasqueiraId) out.player.churrasqueiraId = STARTER_CHURRASQUEIRA_ID;
  if (!out.player.churrasqueiraLevels) {
    out.player.churrasqueiraLevels = { [out.player.churrasqueiraId]: 1 };
  } else if (!out.player.churrasqueiraLevels[out.player.churrasqueiraId]) {
    out.player.churrasqueiraLevels[out.player.churrasqueiraId] = 1;
  }
  // v3: the FTUE. A save written before it existed belongs to someone who has
  // already played — the six-step first run must not ambush a returning player.
  const progress = { ...out.progress };
  if (fromVersion < 3) {
    progress.tutorial = null;
    progress.ftueDone = true;
  }
  if (progress.tutorial === undefined || (progress.tutorial !== null && typeof progress.tutorial !== 'object')) {
    progress.tutorial = null; // restoreTutorialState() validates what is left
  }
  if (typeof progress.ftueDone !== 'boolean') progress.ftueDone = false;
  out.progress = progress;
  out.schemaVersion = SAVE_SCHEMA_VERSION;
  return out;
}

/** Detects a device clock moved backwards since the last save (spec §58). */
export function detectClockTampering(save: SaveGame, nowUnixSec: number): { tampered: boolean; driftSec: number } {
  const drift = nowUnixSec - save.deviceClockUnixSec;
  return { tampered: drift < -60, driftSec: drift };
}

export function unixDay(unixSec: number): number {
  return Math.floor(unixSec / 86400);
}

/**
 * Daily streak with a grace day (spec §28): missing one day does not reset the
 * streak, it just does not advance it.
 */
export function resolveDailyClaim(save: SaveGame, nowUnixSec: number, cycleDays: number, graceDays: number): {
  dayIndex: number;
  streak: number;
  canClaim: boolean;
} {
  const today = unixDay(nowUnixSec);
  const last = save.daily.lastClaimUnixDay;
  if (last === today) {
    return { dayIndex: save.daily.lastClaimDayIndex, streak: save.daily.streak, canClaim: false };
  }
  const gap = today - last;
  let streak = save.daily.streak;
  if (last === 0) streak = 1;
  else if (gap <= 1 + graceDays) streak += 1;
  else streak = 1;
  const dayIndex = ((save.daily.lastClaimDayIndex + (last === 0 ? 0 : 1)) % cycleDays + cycleDays) % cycleDays;
  return { dayIndex, streak, canClaim: true };
}

/** Deterministic key ordering so the checksum is stable across engines. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
