/** Lote 07: select the requested top row; the model duplicated the IAP/medal rows.
 * Originals are never overwritten. Run before process-sprites when raws exist.
 * After a wipe, the versioned masters remain authoritative (docs/22 §8).
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const root = join(import.meta.dirname, '..');
const batch = JSON.parse(await readFile(join(root, 'art/lote-07.json'), 'utf8'));
for (const asset of batch.assets) {
  if (!asset.sourcePreparation) continue;
  const { original, rect } = asset.sourcePreparation;
  if (original === asset.source) throw new Error('Never overwrite a generated original');
  const input = join(root, batch.sourceDir, original);
  if (!existsSync(input)) { console.log(`[prepare] skip ${original}: raw missing; keep committed masters`); continue; }
  const image = await loadImage(await readFile(input));
  const [x, y, w, h] = rect;
  if (!rect.every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > image.width || y + h > image.height) {
    throw new Error(`Invalid source rectangle for ${original}`);
  }
  const canvas = createCanvas(w, h);
  canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
  await writeFile(join(root, batch.sourceDir, asset.source), canvas.toBuffer('image/png'));
  console.log(`[prepare] ${original} ${rect.join(',')} -> ${asset.source}`);
}
