/**
 * The per-PR CI gate list (`npm run gates`).
 *
 * One command, same order, same exit codes locally and in GitHub Actions.
 * A gate that only runs by hand is how the ideal-zone bug (docs/18-STATUS.md
 * §4.1) survived two rounds of green tests: `tsconfig.json` was strict, but
 * nothing ever invoked `tsc`.
 *
 * `sim:long` is deliberately not here — it is the nightly workflow.
 * Unity compile / AAB size / asset-registry are not here because this
 * environment has no Unity toolchain (docs/12-BUILD.md §5).
 *
 * GitHub Actions runs the same 12 commands as separate `run:` steps
 * (`.github/workflows/ci.yml`) so a failure names the gate. `tools/studio/test/gates.test.ts`
 * fails the build if the two lists drift.
 */
import { execSync } from 'node:child_process';

const GATES = [
  ['typecheck', 'strict tsc — the gate that caught the dead ideal-zone mechanic'],
  ['validate', 'referential + semantic integrity of every data table'],
  ['check-schema', 'every table against its JSON Schema, plus a negative pass'],
  ['verify-schemas', 'schemas in step with shared/data'],
  ['check-l10n', 'no missing keys, no literal pt-BR in data (§56)'],
  ['check-csharp-types', 'generated C# types in step with the tables'],
  ['verify-data-sync', 'Assets/Data matches shared/data'],
  ['test', 'full vitest suite'],
  ['sim', 'short-horizon economy guardrails'],
  ['check-vectors', 'golden vectors still match the rules'],
  ['check-art', '16 ingredients × 8 doneness levels all paint'],
  ['check-render', 'real prototype bundle driven through a full turn']
];

let failed = 0;

console.log('── CHURRASCO! CI gates ─────────────────────────────────────────');
console.log(`${GATES.length} gates · same list GitHub Actions runs on every push`);
console.log('');

for (const [id, why] of GATES) {
  console.log(`── ${id}  ${'─'.repeat(Math.max(0, 50 - id.length))}`);
  console.log(`   ${why}`);
  try {
    // shell:true so this matches `run: npm run X` in GitHub Actions.
    // spawnSync('npm', …, {shell:false}) exited 9 on ubuntu-latest —
    // npm is a corepack shim, not a real executable.
    execSync(`npm run ${id}`, { stdio: 'inherit', env: process.env });
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException & {status?: number}} */ (err).status ?? 1;
    console.error(`FAIL  ${id}  (exit ${code})`);
    failed++;
    process.exit(code);
  }
  console.log(`PASS  ${id}`);
  console.log('');
}

console.log(`all ${GATES.length} CI gates met`);
process.exit(failed === 0 ? 0 : 1);
