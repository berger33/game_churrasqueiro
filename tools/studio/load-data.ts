import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase, validateDatabase } from '../sim-core/src/data.ts';
import type { GameDatabase, RawDataBundle } from '../sim-core/src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', '..', 'shared', 'data');

export function readJson(fileName: string): unknown {
  return JSON.parse(readFileSync(join(DATA_DIR, fileName), 'utf8'));
}

let cached: GameDatabase | null = null;

export function loadDatabase(): GameDatabase {
  if (cached) return cached;
  const raw: RawDataBundle = {
    ingredients: readJson('ingredients.json') as RawDataBundle['ingredients'],
    grill: readJson('grill.json') as RawDataBundle['grill'],
    customers: readJson('customers.json') as RawDataBundle['customers'],
    restaurants: readJson('restaurants.json') as RawDataBundle['restaurants'],
    upgrades: readJson('upgrades.json') as RawDataBundle['upgrades'],
    economy: readJson('economy.json') as RawDataBundle['economy']
  };
  cached = createDatabase(raw);
  return cached;
}

export function loadAndValidate(): { db: GameDatabase; problems: string[] } {
  const db = loadDatabase();
  return { db, problems: validateDatabase(db) };
}
