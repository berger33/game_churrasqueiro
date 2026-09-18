/**
 * sync-data.mjs — copies the authoritative data layer from `shared/data` into the
 * Unity project and emits a manifest with content hashes.
 *
 * Unity reads exactly these files at runtime (Addressables/Resources). The source
 * of truth is ALWAYS `shared/data`: the simulator and the tests read that folder,
 * and CI fails if the two copies diverge (`npm run verify-data-sync`).
 *
 * Usage: node tools/studio/sync-data.mjs [--check]
 */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'shared', 'data');
const DEST = join(ROOT, 'Assets', 'Data');
const check = process.argv.includes('--check');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const files = (await readdir(SRC)).filter((f) => f.endsWith('.json')).sort();
const manifest = { generatedAt: new Date().toISOString(), source: 'shared/data', files: {} };

let drift = [];
for (const file of files) {
  const buf = await readFile(join(SRC, file));
  const hash = sha256(buf);
  const size = buf.length;
  // Validate it parses before it ever reaches the client.
  try {
    JSON.parse(buf.toString('utf8'));
  } catch (e) {
    console.error(`[sync] ${file} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  manifest.files[file] = { sha256: hash, bytes: size };

  const destPath = join(DEST, file);
  const existing = await stat(destPath).catch(() => null);
  if (!existing || sha256(await readFile(destPath)) !== hash) {
    drift.push(file);
    if (!check) {
      await mkdir(DEST, { recursive: true });
      await writeFile(destPath, buf);
    }
  }
}

if (check) {
  if (drift.length === 0) {
    console.log(`[sync] OK — Assets/Data matches shared/data (${files.length} tables)`);
    process.exit(0);
  }
  console.error(`[sync] DRIFT — run "npm run sync-data" to update:`);
  for (const f of drift) console.error(`  - ${f}`);
  process.exit(1);
}

await writeFile(join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[sync] wrote ${files.length} tables to Assets/Data`);
if (drift.length) console.log(`[sync] updated: ${drift.join(', ')}`);
