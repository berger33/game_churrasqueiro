/**
 * Localisation tests. §56 forbids hardcoded player-facing text, so the resolver
 * and the coverage gate are load-bearing, not decorative.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createL10n, createL10nChain, missingKeys, type L10nTable } from '../../sim-core/src/l10n.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const L10N = join(ROOT, 'shared', 'l10n');

const ptBR = JSON.parse(readFileSync(join(L10N, 'pt-BR.json'), 'utf8')) as L10nTable;
const t = createL10n(ptBR, 'pt-BR');

const KEY_FIELDS = /^(nameKey|descKey|taglineKey|reactionPerfectKey|reactionGoodKey|reactionBurnedKey|reactionLostKey|effectKey|titleKey|subtitleKey|labelKey|hintKey|introKey|bodyKey|ctaKey|blurbKey|voiceKey|flavorKey|traditionKey)$/;

function collectKeys(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) { for (const v of node) collectKeys(v, out); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === 'string' && KEY_FIELDS.test(k)) out.add(v);
      collectKeys(v, out);
    }
  }
}

describe('resolver', () => {
  it('resolves a known key', () => {
    expect(t.t('currency.coins')).toBe('Moedas');
    expect(t.t('food.picanha.name')).toBe('Picanha');
  });

  it('returns the key itself for an unknown key instead of throwing', () => {
    expect(t.t('no.such.key')).toBe('no.such.key');
  });

  it('interpolates {vars}', () => {
    const l = createL10n({ 'ui.meta.level': 'Nível {n}', 'ui.x': '{a} e {b}' }, 'pt-BR');
    expect(l.t('ui.meta.level', { n: 12 })).toBe('Nível 12');
    expect(l.t('ui.x', { a: 1, b: 'dois' })).toBe('1 e dois');
  });

  it('leaves an unmatched placeholder visible rather than printing undefined', () => {
    const l = createL10n({ 'k': 'a {x} b' }, 'pt-BR');
    expect(l.t('k')).toBe('a {x} b');
    expect(l.t('k', { y: 1 })).toBe('a {x} b');
  });

  it('reports has() correctly', () => {
    expect(t.has('currency.embers')).toBe(true);
    expect(t.has('currency.nope')).toBe(false);
  });
});

describe('fallback chain', () => {
  it('falls back to the authored locale for a missing key', () => {
    const stub = { 'currency.coins': 'Coins' };
    const l = createL10nChain(stub, 'en-US', ptBR);
    expect(l.t('currency.coins')).toBe('Coins');      // translated in the stub
    expect(l.t('currency.embers')).toBe('Brasas');    // falls back to pt-BR
    expect(l.locale).toBe('en-US');
  });

  it('prefers the primary locale when both define a key', () => {
    const l = createL10nChain({ 'currency.coins': 'Coins' }, 'en-US', { 'currency.coins': 'Moedas' });
    expect(l.t('currency.coins')).toBe('Coins');
  });
});

describe('coverage', () => {
  const referenced = new Set<string>();
  for (const f of readdirSync(DATA).filter((x) => x.endsWith('.json'))) {
    collectKeys(JSON.parse(readFileSync(join(DATA, f), 'utf8')), referenced);
  }

  it('finds keys referenced by the data tables', () => {
    expect(referenced.size).toBeGreaterThan(300);
  });

  it('pt-BR translates every key the data references', () => {
    expect(missingKeys(ptBR, [...referenced])).toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = Object.entries(ptBR).filter(([, v]) => typeof v !== 'string' || v.trim() === '');
    expect(empty).toEqual([]);
  });

  it('stub locales contain no orphan keys', () => {
    for (const locale of ['en-US', 'es-419']) {
      const path = join(L10N, `${locale}.json`);
      if (!existsSync(path)) continue;
      const table = JSON.parse(readFileSync(path, 'utf8')) as L10nTable;
      const orphans = Object.keys(table).filter((k) => !(k in ptBR));
      expect(orphans, `${locale} has orphans`).toEqual([]);
    }
  });

  it('every gameplay table is free of literal accented text', () => {
    // Comments and _-prefixed documentation fields may be prose; values may not.
    const accented = /[À-ÿà-ÿ]/;
    const offenders: string[] = [];
    for (const f of readdirSync(DATA).filter((x) => x.endsWith('.json'))) {
      readFileSync(join(DATA, f), 'utf8').split('\n').forEach((line, i) => {
        if (!accented.test(line)) return;
        const s = line.trim();
        if (s.startsWith('//') || s.startsWith('"_') || s.startsWith('*')) return;
        offenders.push(`${f}:${i + 1}: ${s.slice(0, 70)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
