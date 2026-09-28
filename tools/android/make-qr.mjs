#!/usr/bin/env node
/**
 * Renders the QR a tester points a phone camera at, and *proves* it decodes.
 *
 * A QR that is generated but never decoded is a link someone types by hand after
 * it fails on their third try. Every PNG this writes is read back with jsQR and
 * compared against the URL that went in; a mismatch or an unreadable image exits
 * non-zero instead of shipping a broken code.
 *
 * Two layouts:
 *   plain  `node tools/android/make-qr.mjs <url> <out.png>` — just the code
 *   card   `... --card --build 42` — install card: title, code, URL, steps
 *
 * Used by hand (sandbox preview link) and by .github/workflows/android-playtest.yml
 * (attached to the release, so the tester's QR never depends on this machine).
 *
 * Usage: node tools/android/make-qr.mjs <url> <out.png> [--label "text"] [--card] [--build <n>]
 */
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const url = argv[0];
const out = argv[1];
if (!url || !out || url.startsWith('--')) {
  console.error('usage: node tools/android/make-qr.mjs <url> <out.png> [--label "text"] [--card] [--build <n>]');
  process.exit(2);
}
const label = flag('--label');
const card = argv.includes('--card');
const build = flag('--build');
const target = resolve(out);
await mkdir(dirname(target), { recursive: true });

// Error-correction M: still readable off a laptop screen or a printed page, while
// keeping the modules big enough for a phone camera at an angle.
const qrPng = await QRCode.toBuffer(url, {
  type: 'png',
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 900,
  color: { dark: '#140D08', light: '#FBF5EC' }
});

/** Reads the code back out of the pixels actually written to disk. */
async function verify(png, surface) {
  const meta = png; // Buffer
  const img = await loadImage(meta);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  const decoded = jsQR(new Uint8ClampedArray(data), width, height);
  if (!decoded) throw new Error(`the QR in ${surface} does not decode`);
  if (decoded.data !== url) throw new Error(`the QR in ${surface} decodes to "${decoded.data}", not "${url}"`);
  return decoded.data;
}

let written = qrPng;
if (card) {
  const W = 1080;
  const H = 1580;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#221610');
  bg.addColorStop(0.55, '#140D08');
  bg.addColorStop(1, '#0A0705');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const iconPath = join(ROOT, 'store-assets', 'icon', 'icon-512.png');
  if (existsSync(iconPath)) {
    const icon = await loadImage(iconPath);
    const size = 148;
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 132, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(icon, W / 2 - size / 2, 132 - size / 2, size, size);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4E7D3';
  ctx.font = '800 62px sans-serif';
  ctx.fillText('CHURRASCO!', W / 2, 300);
  ctx.fillStyle = '#F2A63B';
  ctx.font = '700 40px sans-serif';
  ctx.fillText('O Mestre da Brasa', W / 2, 352);
  ctx.fillStyle = 'rgba(244,231,211,0.68)';
  ctx.font = '600 30px sans-serif';
  ctx.fillText(build ? `Build de teste Android ${build}` : 'Build de teste Android', W / 2, 406);

  const qr = await loadImage(qrPng);
  const qrSize = 620;
  const qrY = 452;
  ctx.fillStyle = '#FBF5EC';
  ctx.fillRect(W / 2 - qrSize / 2 - 18, qrY - 18, qrSize + 36, qrSize + 36);
  ctx.drawImage(qr, W / 2 - qrSize / 2, qrY, qrSize, qrSize);

  ctx.fillStyle = '#F4E7D3';
  ctx.font = '800 40px sans-serif';
  ctx.fillText('Aponte a câmera para instalar', W / 2, qrY + qrSize + 108);
  ctx.fillStyle = 'rgba(244,231,211,0.6)';
  ctx.font = '500 24px monospace';
  // Two lines rather than an ellipsis: a tester who cannot scan still needs the whole link.
  const half = Math.ceil(url.length / 2);
  const breakAt = url.lastIndexOf('/', half) > 20 ? url.lastIndexOf('/', half) + 1 : half;
  const lines = url.length > 74 ? [url.slice(0, breakAt), url.slice(breakAt)] : [url];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, qrY + qrSize + 150 + i * 34));

  const steps = [
    '1. Abra o link no celular (câmera ou navegador)',
    '2. Instale o APK e permita apps desconhecidos',
    '3. Jogue em tela cheia, retrato, até sem internet'
  ];
  ctx.textAlign = 'left';
  ctx.font = '600 30px sans-serif';
  ctx.fillStyle = 'rgba(244,231,211,0.82)';
  steps.forEach((s, i) => ctx.fillText(s, 96, qrY + qrSize + 268 + i * 52));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(244,231,211,0.35)';
  ctx.font = '500 24px sans-serif';
  ctx.fillText('Teste de jogabilidade — não é a versão de loja', W / 2, H - 56);

  written = canvas.toBuffer('image/png');
}

await writeFile(target, written);
const decoded = await verify(written, target);
await writeFile(
  target.replace(/\.png$/i, '.txt'),
  `${label ? label + '\n' : ''}${url}\nQR verified: decodes to the URL above\n`
);
console.log(`[qr] ${target}`);
console.log(`[qr] ${url}`);
console.log(`[qr] verified: decoded "${decoded}" from ${written.length} bytes of PNG`);
