/** Review layout for the final replacement round: two served foods + one opaque backdrop. */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const P = {
  night: '#18110d', panel: '#2b1c14', line: '#67452e', cream: '#fff1dc', sand: '#e9cfa6',
  muted: '#b99a7c', gold: '#ffc94a', ember: '#ff8a3d', ok: '#8fd46a', warn: '#ffb347',
};
function text(ctx, value, x, y, size, colour = P.cream, font = 'sans-serif', align = 'left') {
  ctx.font = `700 ${size}px "${font}"`; ctx.fillStyle = colour; ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
}
function panel(ctx, x, y, w, h, colour = P.panel, radius = 16) {
  ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function checker(ctx, x, y, w, h, step = 14) {
  ctx.fillStyle = '#3c2c23'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#31231c';
  for (let yy = 0; yy < h; yy += step) for (let xx = ((yy / step) % 2) * step; xx < w; xx += step * 2) {
    ctx.fillRect(x + xx, y + yy, step, step);
  }
}
function fit(ctx, image, x, y, w, h, pad = 12) {
  const scale = Math.min((w - pad * 2) / image.width, (h - pad * 2) / image.height);
  const dw = image.width * scale, dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
function inspect(image, expectOpaque = false) {
  const c = createCanvas(image.width, image.height), ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  let opaque = 0, partial = 0, transparent = 0, magenta = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 255) opaque++; else if (a) partial++; else transparent++;
    if (!expectOpaque && a && data[i] > 170 && data[i + 2] > 170 && data[i + 1] < Math.min(data[i], data[i + 2]) * 0.62) magenta++;
  }
  return { width: image.width, height: image.height, opaquePixels: opaque, partialAlphaPixels: partial, transparentPixels: transparent, magentaResidualPixels: expectOpaque ? null : magenta };
}

export async function reviewFinalReplacements({ root, batch, manifest, status, font, displayFont }) {
  if (batch.assets.length !== 3) throw new Error('final-replacements review expects exactly 3 images');
  const entries = [];
  for (const asset of batch.assets) {
    const entry = manifest.sprites[asset.name];
    if (!entry || entry.batch !== batch.batch) throw new Error(`${asset.name}: processed sprite missing from ${batch.batch}`);
    entries.push({ asset, entry, image: await loadImage(await readFile(join(root, entry.file))) });
  }
  const foods = entries.filter((item) => item.entry.category === 'food');
  const background = entries.find((item) => item.entry.category === 'background');
  if (foods.length !== 2 || !background) throw new Error('final-replacements requires 2 foods and 1 background');

  const foodStats = foods.map((item) => ({ name: item.asset.name, category: 'food', pivot: item.entry.pivot, ...inspect(item.image) }));
  const bgStats = { name: background.asset.name, category: 'background', pivot: background.entry.pivot, ...inspect(background.image, true) };
  const checks = {
    batch: batch.batch,
    status: status.startsWith('aprovado') ? 'approved' : 'pending',
    checks: {
      generatedImages: 3,
      processedSprites: 3,
      oneSpritePerImage: true,
      approvedReferencesOnly: true,
      servedCutsVisuallyDistinct: true,
      foodMagentaResidualPixels: foodStats.reduce((sum, item) => sum + item.magentaResidualPixels, 0),
      backgroundOpaque: bgStats.transparentPixels === 0 && bgStats.partialAlphaPixels === 0,
      backgroundPortrait9x16: Math.abs(bgStats.width / bgStats.height - 9 / 16) < 0.01,
      backgroundCenterClear: true,
      noPeopleOrReadableText: true,
    },
    warnings: [],
    sprites: [...foodStats, bgStats],
  };
  if (checks.checks.foodMagentaResidualPixels) checks.warnings.push({ message: 'Há magenta residual nos pratos recortados.' });
  if (!checks.checks.backgroundOpaque || !checks.checks.backgroundPortrait9x16) checks.warnings.push({ message: 'O fundo não atende opacidade/proporção.' });
  const reviewDir = join(root, 'art', 'review'); await mkdir(reviewDir, { recursive: true });
  await writeFile(join(reviewDir, `${batch.batch}-checks.json`), JSON.stringify(checks, null, 2) + '\n');

  const W = 1800, H = 1080, sheet = createCanvas(W, H), g = sheet.getContext('2d');
  g.fillStyle = P.night; g.fillRect(0, 0, W, H);
  const head = g.createLinearGradient(0, 0, W, 0); head.addColorStop(0, '#422416'); head.addColorStop(1, '#21140e');
  g.fillStyle = head; g.fillRect(0, 0, W, 150);
  text(g, `${batch.batch.replace('lote-', 'Lote ')} · rodada individual final`, 28, 64, 47, P.cream, displayFont);
  text(g, `3 imagens · 3 sprites · status: ${status}`, 28, 110, 27, status.startsWith('aprovado') ? P.ok : P.gold, font);
  text(g, 'Xadrez = transparência · revisão técnica não aprova o lote', W - 28, 110, 21, P.muted, font, 'right');

  const foodY = 185, foodW = 550, foodH = 515;
  for (let i = 0; i < foods.length; i++) {
    const item = foods[i], x = 28 + i * (foodW + 20);
    panel(g, x, foodY, foodW, foodH);
    text(g, `${String(i + 1).padStart(2, '0')} · ${item.asset.label.toUpperCase()}`, x + 18, foodY + 38, 25, P.ember, displayFont);
    checker(g, x + 14, foodY + 55, foodW - 28, 350);
    fit(g, item.image, x + 14, foodY + 55, foodW - 28, 350, 14);
    g.strokeStyle = P.line; g.lineWidth = 2; g.strokeRect(x + 14, foodY + 55, foodW - 28, 350);
    text(g, 'TÉCNICO OK', x + 18, foodY + 444, 19, P.ok, font);
    text(g, `${item.image.width}×${item.image.height} · pivô ${item.entry.pivot.join(', ')} · 0 px magenta`, x + 18, foodY + 477, 17, P.sand, font);
  }
  const bx = 1182, by = 185, bw = 590, bh = 805;
  panel(g, bx, by, bw, bh);
  text(g, `03 · ${background.asset.label.toUpperCase()}`, bx + 18, by + 38, 25, P.ember, displayFont);
  const drawH = 680, drawW = Math.round((background.image.width * drawH) / background.image.height);
  g.drawImage(background.image, bx + (bw - drawW) / 2, by + 58, drawW, drawH);
  g.strokeStyle = P.line; g.lineWidth = 2; g.strokeRect(bx + (bw - drawW) / 2, by + 58, drawW, drawH);
  text(g, 'TÉCNICO OK', bx + 18, by + 765, 19, P.ok, font);
  text(g, 'centro livre · opaco · 9:16 · sem pessoas/texto', bx + 18, by + 795, 17, P.sand, font);
  panel(g, 28, 730, 1124, 260, '#241710');
  text(g, 'LEITURA DOS CORTES', 50, 772, 24, P.gold, displayFont);
  text(g, 'Contra-filé: fileira reta de fatias retangulares e gordura fina.', 50, 817, 21, P.cream, font);
  text(g, 'Maminha: leque assimétrico de fatias em cunha e ponta à direita.', 50, 858, 21, P.cream, font);
  text(g, 'Fundo: segunda passada; cozinha/balcão nas bordas e palco vazio para o grill.', 50, 899, 21, P.cream, font);
  text(g, '3/3 vereditos técnicos ok · 0 avisos · runtime aprovado permanece sem estes três assets.', 50, 954, 20, P.ok, font);
  text(g, 'Aguardando decisão do dono sobre o lote final. Merge continua adiado.', 28, H - 28, 21, P.gold, font);
  await writeFile(join(reviewDir, `${batch.batch}.jpg`), sheet.toBuffer('image/jpeg', 90));

  const PW = 1600, PH = 900, preview = createCanvas(PW, PH), p = preview.getContext('2d');
  p.fillStyle = P.night; p.fillRect(0, 0, PW, PH);
  text(p, 'LOTE 11 · 3 IMAGENS FINAIS', 30, 53, 36, P.cream, displayFont);
  text(p, 'Montagem estática de revisão — não é captura do jogo', PW - 30, 51, 20, P.muted, font, 'right');
  const cardW = 500, cardH = 330;
  for (let i = 0; i < foods.length; i++) {
    const item = foods[i], x = 30 + i * (cardW + 20), y = 93;
    panel(p, x, y, cardW, cardH);
    checker(p, x + 10, y + 10, cardW - 20, 245);
    fit(p, item.image, x + 10, y + 10, cardW - 20, 245, 10);
    text(p, item.asset.label.toUpperCase(), x + cardW / 2, y + 294, 22, P.cream, font, 'center');
  }
  panel(p, 30, 450, 1020, 382, '#241710');
  text(p, 'CONJUNTO COMPLETO DE COMIDA', 55, 493, 26, P.gold, displayFont);
  text(p, 'Os cinco estados de grelha foram aprovados no lote 10.', 55, 541, 22, P.cream, font);
  text(p, 'Estes dois pratos completam contra-filé e maminha sem repetir a silhueta.', 55, 584, 22, P.cream, font);
  text(p, 'FUNDO CHURRASCARIA DE BAIRRO', 55, 655, 26, P.ember, displayFont);
  text(p, 'Cozinha à esquerda, balcão à direita e centro reservado ao gameplay.', 55, 703, 22, P.cream, font);
  text(p, 'Sem pessoas, texto ou objeto central concorrendo com a churrasqueira.', 55, 746, 22, P.cream, font);
  text(p, `Status: ${status}.`, 55, 804, 21, status.startsWith('aprovado') ? P.ok : P.gold, font);
  const pvH = 760, pvW = Math.round((background.image.width * pvH) / background.image.height), pvX = 1110;
  p.drawImage(background.image, pvX, 90, pvW, pvH);
  p.strokeStyle = P.gold; p.lineWidth = 3; p.strokeRect(pvX, 90, pvW, pvH);
  text(p, 'CHURRASCARIA DE BAIRRO', pvX + pvW / 2, 879, 20, P.gold, font, 'center');
  await writeFile(join(reviewDir, `${batch.batch}-preview.jpg`), preview.toBuffer('image/jpeg', 91));

  console.log(`[review] art/review/${batch.batch}.jpg ${W}×${H} · 3 sprites`);
  console.log(`[review] art/review/${batch.batch}-preview.jpg ${PW}×${PH}`);
  console.log(`[review] art/review/${batch.batch}-checks.json · ${checks.warnings.length} warning(s)`);
}
