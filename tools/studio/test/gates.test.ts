/**
 * The local `npm run gates` list and `.github/workflows/ci.yml` must not drift.
 * A gate that only runs in one of them is how the ideal-zone bug hid.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GATES = [
  'typecheck', 'validate', 'check-schema', 'verify-schemas', 'check-l10n',
  'check-csharp-types', 'verify-data-sync', 'test', 'sim', 'check-vectors',
  'check-art', 'check-render', 'check-shots', 'check-csharp'
];

describe('CI lockstep', () => {
  it('ci.yml runs every gate that run-gates.mjs runs', () => {
    const yml = readFileSync('.github/workflows/ci.yml', 'utf8');
    const mjs = readFileSync('tools/studio/run-gates.mjs', 'utf8');
    expect(yml).toContain("node-version: '22'");
    // check-csharp must never SKIP on CI: the SDK is installed before it runs.
    expect(yml).toContain('actions/setup-dotnet@');
    expect(yml.indexOf('actions/setup-dotnet@')).toBeLessThan(yml.search(/^\s*- run: npm run check-csharp\s*$/m));
    for (const id of GATES) {
      expect(mjs.includes(`['${id}',`), `run-gates.mjs missing ${id}`).toBe(true);
      // Whole-line match: `npm run check-csharp` is a prefix of `npm run check-csharp-types`.
      const step = id === 'test' ? /^\s*- run: npm test\s*$/m : new RegExp(`^\\s*- run: npm run ${id}\\s*$`, 'm');
      expect(step.test(yml), `ci.yml missing ${id}`).toBe(true);
    }
  });
});
