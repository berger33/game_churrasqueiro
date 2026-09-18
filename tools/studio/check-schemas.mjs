/**
 * Schema validation CLI (`npm run check-schema`).
 *
 * Validates every table in `shared/data` against its `shared/schema` contract,
 * resolving the `$schema` field each table declares rather than guessing the
 * pairing. Before this existed those 18 `$schema` references were dangling —
 * every table pointed at a file that was not in the repository.
 *
 * Also runs a negative pass: a schema that accepts anything is worthless, so
 * each contract is fed a deliberately broken copy of its own table and must
 * reject it. This is what proves the schemas have teeth.
 */
import Ajv from 'ajv';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const SCHEMA_DIR = join(ROOT, 'shared', 'schema');

const ajv = new Ajv({ strict: false, allErrors: true });

const tables = readdirSync(DATA).filter((f) => f.endsWith('.json')).sort();
const problems = [];
let checked = 0;

for (const file of tables) {
  const raw = readFileSync(join(DATA, file), 'utf8');
  const data = JSON.parse(raw);

  // Resolve the declared $schema rather than assuming a naming convention.
  let schemaPath;
  if (data.$schema) {
    schemaPath = join(ROOT, 'shared', data.$schema);
    if (!existsSync(schemaPath)) {
      problems.push(`${file}: declares $schema "${data.$schema}" but that file does not exist`);
      continue;
    }
  } else {
    // Tables with no $schema still get checked against the derived contract.
    schemaPath = join(SCHEMA_DIR, file.replace('.json', '.schema.json'));
    if (!existsSync(schemaPath)) {
      problems.push(`${file}: no $schema declared and no derived schema found`);
      continue;
    }
  }

  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (e) {
    problems.push(`${file}: schema does not compile — ${e.message}`);
    continue;
  }

  if (!validate(data)) {
    for (const err of validate.errors.slice(0, 5)) {
      problems.push(`${file}: ${err.instancePath || '/'} ${err.message} ${JSON.stringify(err.params)}`);
    }
    if (validate.errors.length > 5) problems.push(`${file}: …and ${validate.errors.length - 5} more`);
    continue;
  }
  checked++;

  // ── Negative pass ──────────────────────────────────────────────────────────
  // Break the table in a way any real contract must catch, and require rejection.
  const broken = JSON.parse(raw);
  const arrayKey = Object.keys(broken).find((k) => Array.isArray(broken[k]) && broken[k].length);
  if (arrayKey && broken[arrayKey][0] && typeof broken[arrayKey][0] === 'object') {
    // Remove a required field from the first row.
    const requiredFields = schema.properties?.[arrayKey]?.items?.required ?? [];
    if (requiredFields.length) {
      delete broken[arrayKey][0][requiredFields[0]];
      if (validate(broken)) {
        problems.push(
          `${file}: schema accepted a row missing required field "${requiredFields[0]}" — contract has no teeth`
        );
      }
    }
  }
  // An unknown top-level key must be rejected (additionalProperties: false).
  const polluted = JSON.parse(raw);
  polluted.__definitelyNotARealField = true;
  if (validate(polluted)) {
    problems.push(`${file}: schema accepted an unknown top-level field — additionalProperties is not enforced`);
  }
}

if (problems.length) {
  console.error(`[check-schema] FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error('  · ' + p);
  process.exit(1);
}

console.log(
  `[check-schema] OK — ${checked}/${tables.length} tables valid against their schema, ` +
  `and every contract rejects a broken copy of itself`
);
