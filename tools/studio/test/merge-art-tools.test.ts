import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { capacity, loadStandard, report } from '../../art/grill-geometry.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const temp = mkdtempSync(join(tmpdir(), 'churrasco-merge-tools-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const run = (script: string, args: string[] = [], env: Record<string, string> = {}) => spawnSync(
  process.execPath, [script, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env },
  },
);
const hashes = (dir: string) => Object.fromEntries(readdirSync(dir).sort().map(name => [
  name, createHash('sha256').update(readFileSync(join(dir, name))).digest('hex'),
]));
const guide = 'tools/art/make-grill-guide.mjs';

describe('PR #7/#8 reconciliation: tools without production regressions', () => {
  it('dry-run neither rewrites the shipped atlas nor modifies/deletes output files', () => {
    const atlas = join(ROOT, 'prototype/assets/art');
    const before = hashes(atlas);
    // Deliberately seed the output with names that the non-dry builder deletes.
    writeFileSync(join(temp, 'sentinel.webp'), 'do not delete');
    writeFileSync(join(temp, 'index.json'), '{"sentinel":true}');
    const outputBefore = hashes(temp);
    const result = run('tools/art/build-runtime.mjs', ['--dry-run', '--out', temp]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('dry run: 244 sprites');
    expect(hashes(atlas)).toEqual(before);
    expect(hashes(temp)).toEqual(outputBefore);
  }, 60000);

  it('legacy registry command delegates to the current strict gate', () => {
    const result = run('tools/art/check-art-registry.mjs');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('244 baseline IDs preserved');
  }, 30000);

  it('legacy registry command propagates failure instead of silently skipping a missing checkout', () => {
    const result = run('tools/art/check-art-registry.mjs', ['--root', join(temp, 'missing-checkout')]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FAIL');
  });

  it('loads current capacities without importing the obsolete 10-grill economy', async () => {
    const standard = await loadStandard(ROOT);
    expect(standard.churrasqueiras.map(g => g.id)).toEqual([
      'lata_valente', 'ze_da_esquina', 'parrilla_chef_cisma', 'fornalha_dragao_manso',
    ]);
    expect(capacity(standard, 'ze_da_esquina', 2).zoneCount).toBe(2);
    expect(() => capacity(standard, 'ze_da_esquina', 99)).toThrow('Unknown evolution');
    expect(() => capacity(standard, 'missing', 1)).toThrow('not in churrasqueiras.json');
    const result = await report(standard);
    expect(result.ladder).toHaveLength(12);
    expect(result.rows).toHaveLength(12);
  });

  it('creates a new guide using a current grill, without modifying its approved master', () => {
    const master = join(ROOT, 'Assets/Art/Sprites/Grills/spr_grill_ze_da_esquina_evo3.png');
    const before = readFileSync(master);
    const output = join(temp, 'guide.png');
    const result = run(guide, [output, '512', '--grill', 'ze_da_esquina', '--evo', '3', '--mouth-tilt', '7']);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(readFileSync(master)).toEqual(before);
    const pixels = readFileSync(output);
    const overwrite = run(guide, [output, '512', '--grill', 'ze_da_esquina']);
    expect(overwrite.status).not.toBe(0);
    expect(readFileSync(output)).toEqual(pixels);
  });

  it.each([
    ['Assets/Art/merge-test-must-not-exist.png', '512', '--grill', 'ze_da_esquina'],
    ['prototype/assets/merge-test-must-not-exist.png', '512', '--grill', 'ze_da_esquina'],
    [join(temp, 'bad-width.png'), '0', '--grill', 'ze_da_esquina'],
    [join(temp, 'bad-evo.png'), '512', '--grill', 'ze_da_esquina', '--evo', '99'],
    [join(temp, 'bad-angle.png'), '512', '--grill', 'ze_da_esquina', '--mouth-tilt', '90'],
    [join(temp, 'bad-grill.png'), '512', '--grill', 'missing'],
  ])('refuses invalid or protected guide output (%s)', (...args) => {
    const result = run(guide, args);
    expect(result.status).not.toBe(0);
    expect(existsSync(resolve(ROOT, args[0]!))).toBe(false);
  });

  it('keeps the existing make-ref grill-guide interface working', () => {
    const output = join(temp, 'legacy-guide.png');
    const result = run('tools/art/make-ref.mjs', ['grill-guide', relative(ROOT, output), '512', '512', 'inox']);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('runs the recovered probe against current unlock contracts and valid grill IDs', () => {
    const result = run('tools/studio/probe-monetization.ts', [], { PROBE_TURNS: '1' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('topo atual');
    expect(result.stdout).not.toMatch(/NaN|Infinity/);
    expect(result.stdout).not.toContain('cozinha_do_campeao');
  }, 30000);
});
