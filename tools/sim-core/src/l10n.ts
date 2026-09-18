/**
 * Localisation.
 *
 * Rule (§56): no literal player-facing string ever appears in code or in the
 * gameplay tables. Tables carry `*Key` fields; the client resolves them here.
 * pt-BR is the authored language; every other locale must have full coverage or
 * the build fails (`npm run check-l10n`).
 *
 * Deliberately tiny and dependency-free so the same module runs in the Node
 * studio tools, the browser prototype and (via a hand port) the Unity client.
 */

export type L10nTable = Record<string, string>;

export interface L10n {
  /** Active locale, e.g. `pt-BR`. */
  readonly locale: string;
  /** Resolve a key. Missing keys return the key itself, visibly — never a crash. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** True when the key exists in the active table. */
  has(key: string): boolean;
  /** Keys present in the active table. */
  keys(): string[];
}

const VAR = /\{(\w+)\}/g;

export function createL10n(table: L10nTable, locale: string): L10n {
  return {
    locale,
    has: (key: string): boolean => Object.prototype.hasOwnProperty.call(table, key),
    keys: (): string[] => Object.keys(table),
    t: (key: string, vars?: Record<string, string | number>): string => {
      const raw = table[key];
      if (raw === undefined) {
        // Fail loudly in dev rather than shipping an untranslated key silently.
        if (typeof process !== 'undefined' && process.env?.L10N_STRICT === '1') {
          throw new Error(`missing localisation key: ${key}`);
        }
        return key;
      }
      if (!vars) return raw;
      return raw.replace(VAR, (_m, name: string) => {
        const v = vars[name];
        return v === undefined ? `{${name}}` : String(v);
      });
    }
  };
}

/**
 * Builds a resolving chain: the requested locale first, then pt-BR as the
 * authored fallback, then the raw key. This keeps an unfinished es-419 table
 * playable instead of showing bare keys.
 */
export function createL10nChain(primary: L10nTable, primaryLocale: string, fallback: L10nTable): L10n {
  const merged: L10nTable = { ...fallback, ...primary };
  return createL10n(merged, primaryLocale);
}

/** Keys referenced by the data tables but absent from a translation table. */
export function missingKeys(table: L10nTable, required: readonly string[]): string[] {
  return required.filter((k) => !Object.prototype.hasOwnProperty.call(table, k));
}
