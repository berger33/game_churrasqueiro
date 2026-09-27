/** Contract mutations run the actual CLI against isolated, metadata-only fixtures.
 * No production master or runtime asset is edited. Pixel decoding is check-shots' job. */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repo = resolve('.');
const cli = join(repo, 'tools/art/check-art-registry.ts');
const registryPath = 'Assets/Art/ASSET_REGISTRY.csv';
const manifestPath = 'Assets/Art/sprites.manifest.json';
const runtimePath = 'prototype/assets/art/index.json';
const name = 'ic_coin';
const master = 'Assets/Art/UI/Icons/ic_coin.png';
const webp = 'prototype/assets/art/ic_coin.webp';
const superseded = 'spr_char_customer_turista';
let root: string;
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const write = (file: string, text: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
const editJson = (file: string, mutate: (data: any) => void) => {
  const data = JSON.parse(read(file)); mutate(data); write(file, JSON.stringify(data));
};
const editRow = (mutate: (line: string) => string) => {
  write(registryPath, read(registryPath).split(/\r?\n/).map(l => l.startsWith(`${name},`) ? mutate(l) : l).join('\n'));
};
const run = (at = root) => spawnSync(process.execPath, ['--experimental-strip-types', cli, '--root', at], { encoding: 'utf8' });
const reject = (code: string) => {
  const r = run();
  expect(r.status, r.stdout + r.stderr).toBe(1);
  expect(r.stderr).toContain(`[${code}]`); // missing CLI / crash is NOT a passing negative test
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'churrasco-art-'));
  for (const file of [registryPath, manifestPath, runtimePath]) write(file, readFileSync(join(repo, file), 'utf8'));
  mkdirSync(join(root, 'art'), { recursive: true });
  for (let n = 1; n <= 11; n++) {
    const file = `art/lote-${String(n).padStart(2, '0')}.json`;
    cpSync(join(repo, file), join(root, file));
  }
  const manifest = JSON.parse(read(manifestPath));
  const index = JSON.parse(read(runtimePath));
  // The immutable baseline belongs to the gate, not to an untrusted --root fixture.
  for (const entry of Object.values(manifest.sprites) as { file: string }[]) write(entry.file, 'master fixture');
  for (const entry of Object.values(index.sprites) as { file: string }[]) write(`prototype/assets/art/${entry.file}`, 'runtime fixture');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('check-art-registry CLI', () => {
  it('accepts the complete fixture (244 approved, one superseded outside runtime)', () => {
    const r = run(); expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('244 approved');
  });
  it('accepts the real checkout', () => {
    const r = run(repo); expect(r.status, r.stderr).toBe(0);
  });
  for (const status of ['pending', 'rejected']) {
    it(`allows ${status} masters when they remain outside the runtime`, () => {
      write(registryPath, read(registryPath).replace(',superseded,', `,${status},`));
      const r = run(); expect(r.status, r.stderr).toBe(0);
    });
  }
  it('allows additional approved sprites without weakening the 244-ID baseline', () => {
    write(registryPath, read(registryPath).split(/\r?\n/).map(l => l.startsWith(`${superseded},`)
      ? l.replace(',superseded,', ',approved,').replace(',ai-assisted,', ',ai-assisted-reviewed,') : l).join('\n'));
    editJson(runtimePath, i => {
      i.sprites[superseded] = { file: `${superseded}.webp`, w: 1, h: 1 };
      i.customers.turista.unshift(superseded);
    });
    write(`prototype/assets/art/${superseded}.webp`, 'new approval fixture only');
    const r = run(); expect(r.status, r.stderr).toBe(0); expect(r.stdout).toContain('245 approved');
  });
  it('rejects a master without a registry row', () => {
    write('Assets/Art/Sprites/Food/spr_food_orphan.png', 'orphan'); reject('MASTER_UNREGISTERED');
  });
  it('rejects non-PNG unregistered art too', () => {
    write('Assets/Art/orphan.jpg', 'orphan'); reject('MASTER_UNREGISTERED');
  });
  it('rejects a row without its master', () => { rmSync(join(root, master)); reject('MASTER_MISSING'); });
  it('rejects duplicate registry names', () => {
    write(registryPath, read(registryPath) + '\n' + read(registryPath).split(/\r?\n/).find(l => l.startsWith(`${name},`)));
    reject('REGISTRY_DUPLICATE_NAME');
  });
  it('rejects duplicate registry paths', () => {
    editRow(l => l.replace(master, 'Assets/Art/UI/Icons/ic_star.png')); reject('REGISTRY_DUPLICATE_FILE');
  });
  it('rejects a name inconsistent with its file', () => {
    editRow(l => l.replace(/^ic_coin,/, 'wrong_name,')); reject('REGISTRY_NAME');
  });
  it('rejects a path traversal', () => {
    editRow(l => l.replace(master, 'Assets/Art/../../ic_coin.png')); reject('REGISTRY_PATH');
  });
  it('rejects an absolute path', () => {
    editRow(l => l.replace(master, '/tmp/ic_coin.png')); reject('REGISTRY_PATH');
  });
  it('rejects a symlink master', () => {
    rmSync(join(root, master)); symlinkSync(join(repo, master), join(root, master)); reject('SYMLINK');
  });
  it('rejects a symlinked runtime directory', () => {
    rmSync(join(root, 'prototype/assets/art'), { recursive: true });
    symlinkSync(join(repo, 'prototype/assets/art'), join(root, 'prototype/assets/art')); reject('SYMLINK');
  });
  it('rejects an unknown status', () => {
    editRow(l => l.replace(',approved,', ',approveed,')); reject('REGISTRY_STATUS');
  });
  it('requires reviewed provenance for approved art', () => {
    editRow(l => l.replace(',ai-assisted-reviewed,', ',ai-assisted,')); reject('REGISTRY_APPROVAL');
  });
  it('rejects a malformed batch id', () => {
    editRow(l => l.replace(',lote-08,', ',8,')); reject('REGISTRY_BATCH');
  });
  it('rejects a nonexistent batch spec', () => {
    rmSync(join(root, 'art/lote-08.json')); reject('BATCH_MISSING');
  });
  it('rejects coordinated registry/manifest drift to the wrong existing batch', () => {
    editRow(l => l.replace(',lote-08,', ',lote-11,'));
    editJson(manifestPath, m => { m.sprites[name].batch = 'lote-11'; }); reject('BATCH_ASSET');
  });
  it('rejects batch metadata that disagrees with its filename', () => {
    editJson('art/lote-08.json', b => { b.batch = 'lote-09'; }); reject('BATCH_ID');
  });
  it('rejects a batch output path mismatch', () => {
    editJson('art/lote-08.json', b => { b.assets.find((a: any) => a.name === name).out = 'Assets/Art/FX'; });
    reject('BATCH_ASSET');
  });
  it('rejects a malformed CSV header', () => {
    write(registryPath, read(registryPath).replace('name,category,', 'name,name,')); reject('REGISTRY_CSV');
  });
  it('rejects a truncated CSV row', () => {
    editRow(() => 'ic_coin,ui'); reject('REGISTRY_CSV');
  });
  it('rejects an unterminated quoted CSV cell', () => {
    editRow(l => l + ',"unterminated'); reject('REGISTRY_CSV');
  });
  it('accepts quoted commas, escaped quotes, CRLF and embedded newlines in notes', () => {
    editRow(l => l.replace(/,[^,]*$/, ',"review, says ""ok""\r\nsecond line"')); const r = run();
    expect(r.status, r.stderr).toBe(0);
  });
  it('rejects a row without a manifest entry', () => {
    editJson(manifestPath, m => { delete m.sprites[name]; }); reject('MANIFEST_MISSING');
  });
  it('rejects a manifest entry without a registry row', () => {
    editRow(() => ''); reject('MANIFEST_UNREGISTERED');
  });
  for (const [field, value] of [['file', 'Assets/Art/UI/Icons/ic_star.png'], ['batch', 'lote-09'], ['category', 'food']]) {
    it(`rejects manifest ${field} disagreement`, () => {
      editJson(manifestPath, m => { m.sprites[name][field!] = value; }); reject('MANIFEST_MISMATCH');
    });
  }
  it('rejects manifest provenance outside the declared source batch', () => {
    editJson(manifestPath, m => { m.sprites[name].source = 'art/source/lote-11/other.png'; }); reject('MANIFEST_SOURCE');
  });
  it('rejects invalid manifest JSON', () => { write(manifestPath, '{'); reject('INPUT'); });
  it('rejects malformed manifest shape', () => { write(manifestPath, '{}'); reject('INPUT'); });
  it('rejects a review build even if no pending sprites appear', () => {
    editJson(runtimePath, i => { i.includePending = true; }); reject('RUNTIME_REVIEW');
  });
  for (const status of ['pending', 'rejected', 'superseded']) {
    it(`rejects ${status} art in runtime`, () => {
      editRow(l => l.replace(',approved,', `,${status},`)); reject('RUNTIME_NOT_APPROVED');
    });
  }
  it('rejects the actual superseded portrait inserted in the bundle', () => {
    editJson(runtimePath, i => { i.sprites[superseded] = { file: `${superseded}.webp`, w: 1, h: 1 }; });
    write(`prototype/assets/art/${superseded}.webp`, 'unapproved'); reject('RUNTIME_NOT_APPROVED');
  });
  it('rejects an approved sprite removed from the runtime index', () => {
    editJson(runtimePath, i => { delete i.sprites[name]; }); reject('RUNTIME_MISSING');
  });
  it('rejects a missing runtime file', () => { rmSync(join(root, webp)); reject('RUNTIME_FILE_MISSING'); });
  it('rejects an orphan runtime file even if not in the index', () => {
    write('prototype/assets/art/orphan.webp', 'unapproved'); reject('RUNTIME_ORPHAN');
  });
  it('rejects unindexed nested runtime files and non-WebP files', () => {
    write('prototype/assets/art/review/unapproved.png', 'unapproved'); reject('RUNTIME_ORPHAN');
  });
  it('rejects runtime aliases/path traversal', () => {
    editJson(runtimePath, i => { i.sprites[name].file = '../ic_coin.webp'; }); reject('RUNTIME_PATH');
  });
  it('rejects unregistered runtime entries', () => {
    editJson(runtimePath, i => { i.sprites.orphan = { file: 'orphan.webp', w: 1, h: 1 }; }); reject('RUNTIME_NOT_APPROVED');
  });
  it('rejects a coordinated removal across all four inventories', () => {
    editRow(() => ''); editJson(manifestPath, m => { delete m.sprites[name]; });
    editJson(runtimePath, i => { delete i.sprites[name]; delete i.icons[name]; });
    rmSync(join(root, master)); rmSync(join(root, webp)); reject('BASELINE_MISSING');
  });
  it('rejects substitution of a baseline ID even when the count stays 244', () => {
    const replacement = 'ic_replacement';
    editRow(l => l.replaceAll(name, replacement));
    editJson(manifestPath, m => { m.sprites[replacement] = { ...m.sprites[name], file: master.replace(name, replacement) }; delete m.sprites[name]; });
    editJson(runtimePath, i => {
      i.sprites[replacement] = { ...i.sprites[name], file: `${replacement}.webp` };
      delete i.sprites[name]; delete i.icons[name]; i.icons[replacement] = replacement;
    });
    editJson('art/lote-08.json', b => { b.assets.find((a: any) => a.name === name).name = replacement; });
    rmSync(join(root, master)); rmSync(join(root, webp));
    write(master.replace(name, replacement), 'replacement'); write(webp.replace(name, replacement), 'replacement');
    reject('BASELINE_MISSING');
  });
  it('rejects a runtime food frame pointing to non-approved art', () => {
    editJson(runtimePath, i => { i.foods.picanha.states.raw = superseded; }); reject('RUNTIME_LOOKUP');
  });
  it('rejects a missing food lookup despite all 244 sprites being present', () => {
    editJson(runtimePath, i => { delete i.foods.picanha; }); reject('RUNTIME_LOOKUP');
  });
  it('rejects incorrect customer lookup routing', () => {
    editJson(runtimePath, i => { i.customers.comum = ['ic_coin']; }); reject('RUNTIME_LOOKUP');
  });
  it('rejects a manifest food frame referring to the wrong ingredient', () => {
    editJson(manifestPath, m => { m.foods.picanha.states.raw = 'spr_food_cupim_raw'; }); reject('MANIFEST_FOOD');
  });
  it('rejects coordinated loss of a food lookup in manifest and runtime', () => {
    editJson(manifestPath, m => { delete m.foods.picanha; });
    editJson(runtimePath, i => { delete i.foods.picanha; }); reject('MANIFEST_FOOD');
  });
});
