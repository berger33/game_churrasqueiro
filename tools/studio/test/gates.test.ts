/**
 * The local `npm run gates` list and `.github/workflows/ci.yml` must not drift.
 * A gate that only runs in one of them is how the ideal-zone bug hid.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GATES = [
  'typecheck', 'validate', 'check-schema', 'verify-schemas', 'check-l10n',
  'check-csharp-types', 'verify-data-sync', 'test', 'sim', 'check-vectors',
  'check-art', 'check-render'
];

describe('CI lockstep', () => {
  it('ci.yml runs every gate that run-gates.mjs runs', () => {
    const yml = readFileSync('.github/workflows/ci.yml', 'utf8');
    const mjs = readFileSync('tools/studio/run-gates.mjs', 'utf8');
    for (const id of GATES) {
      expect(mjs.includes(`['${id}',`), `run-gates.mjs missing ${id}`).toBe(true);
      const inYml = id === 'test'
        ? yml.includes('npm test')
        : yml.includes(`npm run ${id}`);
      expect(inYml, `ci.yml missing ${id}`).toBe(true);
    }
  });
});
