#!/usr/bin/env node
// PR #7 compatibility entry point. Always execute the current strict registry gate.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./check-art-registry.ts', import.meta.url)), ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
