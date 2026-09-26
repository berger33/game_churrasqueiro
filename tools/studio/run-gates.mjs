/**
 * The per-PR CI gate list (`npm run gates`).
 *
 * One command, same order, same exit codes locally and in GitHub Actions.
 * A gate that only runs by hand is how the ideal-zone bug (docs/18-STATUS.md
 * §4.1) survived two rounds of green tests: `tsconfig.json` was strict, but
 * nothing ever invoked `tsc`.
 *
 * `sim:long` is deliberately not here — it is the nightly workflow.
 * The Unity build / AAB size / asset-registry are not here because there is no
 * Unity toolchain (docs/12-BUILD.md §5). The engine-free C# core is:
 * `check-csharp` compiles it as Unity would and replays the golden vectors. It
 * needs the .NET 8 SDK, so a machine without one reports SKIP; CI never skips.
 *
 * GitHub Actions runs the same 14 commands as separate `run:` steps
 * (`.github/workflows/ci.yml`) so a failure names the gate. `tools/studio/test/gates.test.ts`
 * fails the build if the two lists drift.
 */
import { execSync, spawnSync } from 'node:child_process';

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
  ['check-grill-geometry', 'cada grelha pintada comporta a grade que churrasqueiras.json promete (boca × leito × comida)'],
  ['check-render', 'real prototype bundle: the FTUE played by following the hand, skip/abandon, a full turn'],
  ['check-shots', 'real PNGs of the first run (FTUE steps 1-6) and the relaunch path — sim catch-up, not 10 800 draws'],
  ['check-csharp', 'the C# core compiles as Unity would (netstandard2.1, C# 9) and replays the golden + FTUE vectors', 'dotnet']
];

/** Gates that need a tool this machine may lack. CI installs them and never skips. */
const hasTool = (tool) => {
  const r = spawnSync(tool, ['--version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
};
const skipped = [];

let failed = 0;

console.log('── CHURRASCO! CI gates ─────────────────────────────────────────');
console.log(`${GATES.length} gates · same list GitHub Actions runs on every push`);
console.log('');

for (const [id, why, needs] of GATES) {
  console.log(`── ${id}  ${'─'.repeat(Math.max(0, 50 - id.length))}`);
  console.log(`   ${why}`);
  if (needs && !process.env.CI && !hasTool(needs)) {
    console.log(`SKIP  ${id}  (no \`${needs}\` on this machine — CI runs it)`);
    console.log('');
    skipped.push(id);
    continue;
  }
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

console.log(skipped.length
  ? `${GATES.length - skipped.length} of ${GATES.length} CI gates met here; skipped (missing toolchain, CI runs them): ${skipped.join(', ')}`
  : `all ${GATES.length} CI gates met`);
process.exit(failed === 0 ? 0 : 1);
