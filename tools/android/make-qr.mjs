#!/usr/bin/env node
/**
 * Renders a QR code PNG so a phone can open or install a build without anyone
 * typing a URL. Used by the Android playtest workflow (attached to the release)
 * and by hand for the sandbox preview link.
 *
 * Usage: node tools/android/make-qr.mjs <url> <out.png> [--label "text"]
 */
import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [, , url, out, ...rest] = process.argv;
if (!url || !out) {
  console.error('usage: node tools/android/make-qr.mjs <url> <out.png> [--label "text"]');
  process.exit(2);
}

const labelIdx = rest.indexOf('--label');
const label = labelIdx >= 0 ? rest[labelIdx + 1] : null;
const target = resolve(out);
await mkdir(dirname(target), { recursive: true });

// Error-correction M keeps the modules large enough to scan off a laptop screen
// while surviving a phone camera at an angle.
const png = await QRCode.toBuffer(url, {
  type: 'png',
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 900,
  color: { dark: '#140D08', light: '#FBF5EC' }
});
await writeFile(target, png);

const text = `${label ? label + '\n' : ''}${url}\n`;
await writeFile(target.replace(/\.png$/i, '.txt'), text);
console.log(`[qr] ${target}`);
console.log(`[qr] ${url}`);
