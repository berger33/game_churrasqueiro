/**
 * check-csharp — the C# core compiles the way Unity will compile it, and agrees
 * with the TypeScript reference (`npm run check-csharp`, CI gate 14).
 *
 *   1. dotnet build tools/csharp/core     netstandard2.1, C# 9, nullable,
 *                                         warnings as errors
 *   2. dotnet run   tools/csharp/parity   tables bind losslessly, GameData.Load
 *                                         is clean, the golden vectors and the
 *                                         FTUE vectors replay to 1e-9
 *
 * Before this gate not one line of Assets/Scripts/Core had ever been compiled
 * (docs/18-STATUS.md §2); its first run found 42 compile errors and, once they
 * were fixed, two rules that disagreed with the TypeScript.
 *
 * Needs the .NET 8 SDK. CI installs it (.github/workflows/ci.yml); a machine
 * without one SKIPs with a notice. On CI a missing SDK is a failure, never a skip.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  if (process.env.CI) {
    console.error('[csharp] FAIL — no .NET SDK on CI (ci.yml must run actions/setup-dotnet before this gate)');
    process.exit(1);
  }
  console.log('[csharp] SKIP — no .NET SDK here. Install .NET 8 to run it locally; CI always runs it.');
  process.exit(0);
}
console.log(`[csharp] .NET SDK ${probe.stdout.trim()}`);

const env = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1' };
function run(args) {
  console.log(`[csharp] dotnet ${args.join(' ')}`);
  const r = spawnSync('dotnet', args, { cwd: ROOT, stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run(['build', 'tools/csharp/core/Churrasco.Core.csproj', '-c', 'Release', '-nologo', '-v', 'quiet']);
run(['build', 'tools/csharp/parity/Churrasco.Parity.csproj', '-c', 'Release', '-nologo', '-v', 'quiet']);

// The parity report is also published as a check annotation on GitHub, so a
// reviewer sees "N checks agree / M not ported" on the PR without opening logs.
console.log('[csharp] dotnet run --project tools/csharp/parity');
const parity = spawnSync('dotnet', ['run', '--no-build', '--project', 'tools/csharp/parity/Churrasco.Parity.csproj', '-c', 'Release'],
  { cwd: ROOT, env, encoding: 'utf8' });
process.stdout.write(parity.stdout ?? '');
process.stderr.write(parity.stderr ?? '');
if (process.env.GITHUB_ACTIONS) {
  const lines = (parity.stdout ?? '').split('\n').filter((l) => l.startsWith('[parity]'));
  const verdict = lines.at(-1) ?? '[parity] no output';
  const escape = (t) => t.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const body = escape(lines.join('\n'));
  console.log(parity.status === 0
    ? `::notice title=check-csharp (C# core vs TypeScript)::${body}`
    : `::error title=check-csharp (C# core vs TypeScript)::${escape(verdict)}%0A${body}`);
}
process.exit(parity.status ?? 1);
