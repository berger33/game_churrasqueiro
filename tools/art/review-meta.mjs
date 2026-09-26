/** Review layout for collection / events / shop / pass / map / achievements / title art.
 * Called by review-sheet for batches with reviewLayout: "meta". Uses versioned masters,
 * never the ignored raws. Missing assets stay visibly missing, NOT implicitly approved.
 * This is offline review tooling; it never changes the game or runtime asset index.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function reviewMeta({ root, batch, manifest, status, font }) {
  const P = { bg: '#1c1512', panel: '#30221a', line: '#61442c', cream: '#f4e7d3', muted: '#b98a55', gold: '#e7c24a' };
  const names = (a) => a.names ?? [a.name];
  const assets = new Map();
  for (const a of batch.assets) for (const name of names(a)) {
    const entry = manifest.sprites[name];
    if (!entry || entry.batch !== batch.batch) continue;
    assets.set(name, await loadImage(await readFile(join(root, entry.file))));
  }
  const expected = batch.assets.reduce((n, a) => n + names(a).length, 0);
  const completed = batch.assets.filter((a) => names(a).every((n) => assets.has(n))).length;
  const incomplete = completed !== batch.assets.length;
  const state = incomplete ? 'INCOMPLETO — NÃO APROVAR PARCIALMENTE' : status;
  function text(g, str, x, y, size = 22, color = P.cream, align = 'left') {
    g.font = `${size}px "${font}"`; g.fillStyle = color; g.textAlign = align; g.fillText(str, x, y);
  }
  function wrap(g, str, x, y, w, size = 21, color = P.muted) {
    g.font = `${size}px "${font}"`; let line = '';
    for (const word of str.split(' ')) {
      if (g.measureText(`${line} ${word}`).width > w && line) { text(g, line, x, y, size, color); y += size * 1.35; line = ''; }
      line += (line ? ' ' : '') + word;
    }
    if (line) text(g, line, x, y, size, color);
    return y + size * 1.35;
  }
  function box(g, x, y, w, h, fill = P.panel) {
    g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  }
  function checker(g, x, y, w, h) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#3c3028'; g.fillRect(x, y, w, h); g.fillStyle = '#49392e';
    for (let yy = 0; yy < h; yy += 16) for (let xx = ((yy / 16) % 2) * 16; xx < w; xx += 32) g.fillRect(x + xx, y + yy, 16, 16);
    g.restore();
  }
  function fit(g, name, x, y, w, h, pad = 0) {
    const im = assets.get(name);
    if (!im) { box(g, x, y, w, h, '#47271e'); text(g, 'FALTA GERAR', x + w / 2, y + h / 2, 20, P.gold, 'center'); return; }
    const s = Math.min((w - 2 * pad) / im.width, (h - 2 * pad) / im.height);
    g.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
  }
  function sizeTests(g, name, x, y, width) {
    box(g, x, y, width / 2 - 4, 64, P.bg);
    fit(g, name, x + (width / 2 - 32) / 2, y + 16, 32, 32);
    const c = createCanvas(48, 48), cg = c.getContext('2d');
    fit(cg, name, 0, 0, 48, 48);
    const pixels = cg.getImageData(0, 0, 48, 48);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const l = .299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2];
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = l;
    }
    cg.putImageData(pixels, 0, 0);
    box(g, x + width / 2 + 4, y, width / 2 - 4, 64, P.cream);
    g.drawImage(c, x + width / 2 + (width / 2 - 48) / 2, y + 8);
  }

  const width = 2000, margin = 28, gap = 24, pw = (width - 2 * margin - gap) / 2;
  const rowHeights = [];
  for (let i = 0; i < batch.assets.length; i += 2) {
    const pair = batch.assets.slice(i, i + 2);
    rowHeights.push(pair.some((a) => a.reviewLayout === 'portrait') ? 1050 : 740);
  }
  const height = 240 + rowHeights.reduce((a, b) => a + b + gap, 0) + 100;
  const c = createCanvas(width, height), g = c.getContext('2d');
  g.fillStyle = P.bg; g.fillRect(0, 0, width, height);
  text(g, `${batch.batch.replace('lote-', 'Lote ')} · arte 2D · revisão de conteúdo`, margin, 65, 46);
  text(g, `${completed}/${batch.assets.length} imagens · ${assets.size}/${expected} sprites · ${batch.date} · ${state}`, margin, 118, 27, P.gold);
  text(g, `Registro: ${status}. Só o “ok” do dono aprova o lote completo.`, margin, 162, 24);
  text(g, 'Xadrez = transparência · miniaturas: 32 px em cor / 48 px em cinza · textos desta folha são overlays de revisão.', margin, 204, 23, P.muted);
  let y = 240;
  for (let row = 0; row < rowHeights.length; row++) {
    const ph = rowHeights[row];
    for (let col = 0; col < 2; col++) {
      const index = row * 2 + col, a = batch.assets[index]; if (!a) continue;
      const x = margin + col * (pw + gap), innerX = x + 20, innerW = pw - 40;
      box(g, x, y, pw, ph);
      text(g, `${String(index + 1).padStart(2, '0')} / ${a.label}`, innerX, y + 42, 27, P.gold);
      const ns = names(a), allPresent = ns.every((n) => assets.has(n));
      const noteY = y + ph - 73;
      if (!allPresent) {
        box(g, innerX, y + 80, innerW, ph - 220, '#47271e');
        text(g, 'IMAGEM NÃO GERADA', x + pw / 2, y + ph / 2 - 30, 34, P.gold, 'center');
        text(g, 'Falha da ferramenta + limite de chamadas do turno.', x + pw / 2, y + ph / 2 + 15, 23, P.cream, 'center');
        text(g, 'Nada desta folha será aprovado isoladamente.', x + pw / 2, y + ph / 2 + 57, 23, P.cream, 'center');
      } else if (a.reviewLayout === 'banners') {
        const ch = (ph - 185) / ns.length;
        ns.forEach((n, i) => {
          checker(g, innerX, y + 67 + i * ch, innerW, ch - 35);
          fit(g, n, innerX, y + 67 + i * ch, innerW, ch - 35, 3);
          text(g, a.cellLabels?.[i] ?? n, innerX + 8, y + 67 + i * ch + ch - 11, 20);
        });
      } else if (a.reviewLayout === 'portrait' || a.reviewLayout === 'hero') {
        checker(g, innerX, y + 75, innerW, ph - 185);
        fit(g, ns[0], innerX, y + 75, innerW, ph - 185, 8);
      } else {
        const columns = Math.min(4, ns.length), rows = Math.ceil(ns.length / columns);
        const cw = innerW / columns, ch = (ph - 180) / rows;
        ns.forEach((n, i) => {
          const xx = innerX + (i % columns) * cw, yy = y + 72 + Math.floor(i / columns) * ch;
          checker(g, xx + 3, yy, cw - 6, ch - 102);
          fit(g, n, xx + 3, yy, cw - 6, ch - 102, 8);
          sizeTests(g, n, xx + 3, yy + ch - 98, cw - 6);
          text(g, a.cellLabels?.[i] ?? n, xx + cw / 2, yy + ch - 11, 19, P.cream, 'center');
        });
      }
      wrap(g, a.review?.note ?? 'Aguardando revisão do lote completo.', innerX, noteY, innerW, 20);
    }
    y += ph + gap;
  }
  text(g, incomplete ? 'PARCIAL PARA PRESERVAÇÃO — falta IAP 1/2. Não é uma solicitação de aprovação.' : 'Aguardando decisão do dono sobre o lote completo. Nenhuma integração autorizada por esta folha.', margin, y + 30, 27, P.gold);
  const dir = join(root, 'art/review'); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${batch.batch}.jpg`), c.toBuffer('image/jpeg', 90));
  console.log(`[review] art/review/${batch.batch}.jpg ${width}×${height} · ${completed}/${batch.assets.length}`);

  // Three honest, static UI mockups, not screenshots and not new game implementation.
  const preview = createCanvas(1340, 1020), ctx = preview.getContext('2d');
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, preview.width, preview.height);
  text(ctx, `${batch.batch.toUpperCase()} · MONTAGEM ESTÁTICA DE ARTE${incomplete ? ' · PARCIAL' : ''}`, 28, 45, 30, P.gold);
  text(ctx, 'Não é captura do jogo. Textos e botões abaixo são overlays de teste, não parte da pintura.', 28, 82, 22);
  for (let i = 0; i < 3; i++) {
    const x = 20 + i * 440, sy = 155;
    text(ctx, ['Título / área para logo e CTA', 'Eventos / passe / loja', 'Mapa / espaço para UI'][i], x, 129, 22);
    box(ctx, x, sy, 420, 780);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, sy, 420, 780, 20); ctx.clip();
    if (i === 0) {
      fit(ctx, 'bg_title_key_art', x, sy, 420, 780);
      box(ctx, x + 30, sy + 60, 360, 122, '#1c1512df');
      text(ctx, 'CHURRASCO!', x + 210, sy + 115, 42, P.cream, 'center');
      text(ctx, 'O Mestre da Brasa', x + 210, sy + 151, 24, P.gold, 'center');
      box(ctx, x + 64, sy + 657, 292, 65, '#a32e1c');
      text(ctx, 'JOGAR', x + 210, sy + 699, 29, P.cream, 'center');
    } else if (i === 1) {
      text(ctx, 'EVENTOS', x + 20, sy + 38, 26, P.gold);
      for (const [j, n] of ['spr_event_segunda_linguica', 'spr_event_festa_junina'].entries()) {
        fit(ctx, n, x + 16, sy + 57 + j * 151, 388, 134);
        text(ctx, j ? 'Festa Junina' : 'Segunda da', x + 56, sy + 102 + j * 151, 22);
        text(ctx, j ? 'Ver evento' : 'Linguiça', x + 56, sy + 134 + j * 151, 21, P.gold);
      }
      fit(ctx, 'spr_pass_temporada', x + 16, sy + 365, 388, 183);
      text(ctx, 'BRASA PASS', x + 32, sy + 418, 24, P.gold);
      text(ctx, 'Temporada', x + 32, sy + 451, 20);
      text(ctx, 'LOJA · arte do passe', x + 20, sy + 590, 24, P.gold);
      fit(ctx, 'spr_iap_pass_season', x + 25, sy + 610, 155, 143);
      wrap(ctx, 'Ilustração do produto. Preço e benefícios vêm da loja.', x + 196, sy + 650, 194, 20, P.cream);
    } else {
      fit(ctx, 'bg_route_brasil', x, sy, 420, 780);
      box(ctx, x + 24, sy + 20, 372, 91, '#1c1512df');
      text(ctx, 'ROTA DA BRASA', x + 210, sy + 60, 30, P.gold, 'center');
      text(ctx, 'Fundo ilustrado · Brasil', x + 210, sy + 91, 21, P.cream, 'center');
      box(ctx, x + 24, sy + 662, 372, 91, '#1c1512df');
      text(ctx, '16 paradas · 5 regiões', x + 210, sy + 700, 24, P.cream, 'center');
      text(ctx, 'Trajeto e pins ainda não integrados', x + 210, sy + 733, 19, P.cream, 'center');
    }
    ctx.restore();
  }
  text(ctx, `${state} · Registro: ${status}. Runtime inalterado.`, 28, 984, 24, P.gold);
  await writeFile(join(dir, `${batch.batch}-preview.jpg`), preview.toBuffer('image/jpeg', 90));
  console.log(`[review] art/review/${batch.batch}-preview.jpg ${preview.width}×${preview.height}`);
}
