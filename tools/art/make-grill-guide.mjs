#!/usr/bin/env node
/**
 * Recovered from PRs #7/#8: generate a proposed layout without modifying approved art.
 * This uses art/grill-authoring-standard.json, NOT the production renderer geometry.
 * node tools/art/make-grill-guide.mjs <out.png> [width] --grill <id> --evo <n> [--mouth-tilt <degrees>]
 * Existing make-ref.mjs grid/single/grill-guide commands remain unchanged.
 */
import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { loadStandard, capacity, requiredMouth } from './grill-geometry.mjs';
const ROOT = join(import.meta.dirname, '..', '..');
const STYLE_BODIES = {
  lata:    { body: [0.05, 0.10, 0.95, 0.66], base: { kind: 'drum', from: 0.66, to: 0.93, inset: 0.12 }, shelf: null, chimney: null },
  chapa:   { body: [0.06, 0.10, 0.94, 0.60], base: { kind: 'wheels', from: 0.60, to: 0.90, inset: 0.13 }, shelf: [0.94, 0.34, 0.99, 0.48], chimney: [0.13, 0.035, 0.19, 0.115] },
  inox:    { body: [0.05, 0.12, 0.95, 0.60], base: { kind: 'legs', from: 0.60, to: 0.90, inset: 0.10 }, shelf: [0.95, 0.30, 1.00, 0.46], chimney: [0.09, 0.0, 0.15, 0.075] },
  fornalha:{ body: [0.03, 0.10, 0.97, 0.585], base: { kind: 'plinth', from: 0.585, to: 0.97, inset: 0.0 }, shelf: null, chimney: [0.08, 0.0, 0.16, 0.115] },
  // Os três estilos que entraram com a escada de dez grelhas (docs/23 §2). O que importa para a
  // régua é o corpo e a boca; os detalhes abaixo da boca (spits/valve/counter) são caráter — são
  // desenhados *fora* do magenta, porque qualquer coisa sobre o buraco encolhe o leito detectado
  // pelo process-sprites e a grelha inteira volta para `redo`.
  espeto:  { body: [0.04, 0.14, 0.96, 0.66], base: { kind: 'drum', from: 0.66, to: 0.94, inset: 0.14 }, shelf: null, chimney: null, spits: true, motor: true },
  tambor:  { body: [0.12, 0.09, 0.88, 0.60], base: { kind: 'legs', from: 0.60, to: 0.95, inset: 0.16 }, shelf: null, chimney: [0.42, 0.0, 0.58, 0.075], valve: true },
  campeao: { body: [0.03, 0.13, 0.97, 0.60], base: { kind: 'plinth', from: 0.60, to: 0.96, inset: 0.02 }, shelf: [0.97, 0.32, 1.00, 0.46], chimney: null, counter: [0.0, 0.075, 1.0, 0.115] },
};

// ── o sentido da inclinação é da FAMÍLIA, não da física ─────────────────────────────────────
// As artes assinadas da MESMA grelha já decidiram se o vão sobe ou desce para a direita. A evo
// nova tem de casar com as vizinhas de escada, senão o jogador vê a churrasqueira "virar" ao
// evoluir (o lote 11 quase perdeu a zé assim: a régua do vão passava, o sentido era o inverso do
// evo 1/evo 2 assinados). Medido no manifesto, onde y cresce para baixo: tiltDeg > 0 = o vão
// DESCE para a direita. Sem manifesto ou sem família assinada, vale o sinal pedido na linha de
// comando. Retorna +1, -1, ou 0 quando não há maioria.
function familyMouthSign(man, grillId, upToEvo) {
  let pos = 0, neg = 0;
  for (let e = 1; e < upToEvo; e++) {
    const q = man.sprites?.[`spr_grill_${grillId}_evo${e}`]?.hole?.quad;
    if (!q) continue;
    const deg = (Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]) * 180) / Math.PI;
    if (deg > 1) pos++; else if (deg < -1) neg++;
  }
  return pos > neg ? 1 : neg > pos ? -1 : 0;
}

async function drawGuide(out, kindOrOpts) {
  const standard = await loadStandard(ROOT);
  const { grillId, evo, W = 1408, roll = 0, mouthTilt = 0 } = kindOrOpts;
  let tilt = +mouthTilt || 0;
  let tiltNote = '';
  const ch = standard.churrasqueiras.find((c) => c.id === grillId);
  if (!ch) throw new Error(`churrasqueira ${grillId} não está em churrasqueiras.json`);
  const style = ch.visual?.style ?? 'inox';
  const g = STYLE_BODIES[style];
  if (!g) throw new Error(`style ${style} não tem silhueta no make-ref (adicione em STYLE_BODIES)`);
  const cap = capacity(standard, grillId, evo);
  const need = requiredMouth(standard.art, cap);
  const aspect = need.bedW / need.mouthH;
  // The frame is derived from the mouth, never the other way round: the opening takes MOUTH_W of
  // the width and MOUTH_H of the height, and the body, the front band and the base are laid out
  // in what is left. A grill with 3 zones therefore gets a taller, squarer image — which is what
  // "espaço de acordo com cada uma" means in pixels. (Hard-coded 16:9 frames are what made the
  // mouth leak past the body in the first place.)
  const MOUTH_W = 0.8, MOUTH_H = 0.42;
  const Wm = Math.round(W);
  // `--mouth-tilt <graus>` é a câmera, `--roll` era a foto. O vão é cisalhado (o topo e a base sobem
  // para a direita por dy) sobre um CORPO DE NÍVEL, e a altura perpendicular do vão continua sendo a
  // que o dado promete — a bbox cresce de dy, e o quadro cresce com ela para nenhum canto ser cortado.
  // O rolo do quadro inteiro entrou como remédio para "sem inclinação na imagem" (docs/22 §6.10.3) e
  // o dono devolveu as duas evo 3 do lote 11 pelo motivo oposto: "as churrasqueiras estão com o lado
  // direito mais alto, a grade pode ser assim, mas a churrasqueira está na diagonal". Inclinam-se as
  // barras da grade; o móvel fica de pé no chão.
  const mHpx = (MOUTH_W * Wm) / aspect;
  if (tilt) {
    const mp = join(ROOT, 'Assets', 'Art', 'sprites.manifest.json');
    let fam = 0;
    if (existsSync(mp)) {
      try { fam = familyMouthSign(JSON.parse(await readFile(mp, 'utf8')), grillId, evo || 1); } catch { fam = 0; }
    }
    // o guia cisalha empurrando o lado ESQUERDO para baixo, então `tilt > 0` = vão SUBINDO para a
    // direita = tiltDeg NEGATIVO no detector. O sinal trocado é o único jeito de o guia nascer
    // casado com a família sem que alguém precise lembrar de passar `--mouth-tilt -7`.
    if (fam === 1 && tilt > 0) { tilt = -tilt; tiltNote = ` — sinal trocado para casar com ${grillId} assinada (vão descendo à direita)`; }
    else if (fam === -1 && tilt < 0) { tilt = -tilt; tiltNote = ` — sinal trocado para casar com ${grillId} assinada (vão subindo à direita)`; }
    else if (fam) tiltNote = ' — sinal da família assinada';
  }
  const dy = Math.tan((tilt * Math.PI) / 180) * MOUTH_W * Wm;
  const bboxHpx = mHpx + Math.abs(dy);
  const H = Math.max(768, Math.ceil(bboxHpx / MOUTH_H / 16) * 16);
  const mwFrac = MOUTH_W;
  const mH = bboxHpx / H;
  const mTop = 0.5 - mH / 2 - 0.06;
  const mouth = [0.5 - mwFrac / 2, mTop, 0.5 + mwFrac / 2, mTop + mH];
  const body = [0.5 - mwFrac / 2 - 0.045, mTop - 0.05, 0.5 + mwFrac / 2 + 0.045, mouth[3] + 0.17];
  const base = { from: body[3], to: Math.min(0.97, body[3] + 0.24) };
  // `--roll <graus>` inclina o desenho inteiro, boca e corpo juntos. Ninguém pediu isso por capricho:
  // o dono reprovou três grelhas do lote 08 porque "não têm nenhuma inclinação na imagem", e o motivo
  // estava no meu próprio prompt, que pedia bordas horizontais para matar a isometria. O guia com rolo
  // ensina a câmera (as aprovadas medem −8,6° a −6,1°) sem abrir mão da boca retangular que o detector
  // precisa achar. O quadro cresce de padX/padY para absorver os cantos girados — a boca continua com os
  // pixels que o padrão exige, e o magenta extra é aparo, não corpo.
  const rad = (roll * Math.PI) / 180;
  const padX = roll ? Math.ceil(Math.abs(Math.sin(rad)) * H / 2) + 4 : 0;
  const padY = roll ? Math.ceil(Math.abs(Math.sin(rad)) * W / 2) + 4 : 0;
  const c = createCanvas(W + padX * 2, H + padY * 2);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FF00FF'; ctx.fillRect(0, 0, W + padX * 2, H + padY * 2);
  if (roll) {
    ctx.translate(padX + W / 2, padY + H / 2);
    ctx.rotate(-rad);
    ctx.translate(-W / 2, -H / 2);
  }
  const rect = ([x0, y0, x1, y1], fill, r = 0) => {
    const [x, y, w, h] = [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H];
    ctx.fillStyle = fill;
    if (!r || !ctx.roundRect) { ctx.fillRect(x, y, w, h); return; }
    ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.fill();
  };
  const BODY = '#4a4038', FAR = '#3d352e', NEAR = '#5b5045';
  if (g.chimney) rect([g.chimney[0], body[1] - 0.09, g.chimney[2], body[1] + 0.01], FAR);
  rect(body, BODY, W * 0.012);
  if (g.shelf) rect(g.shelf, NEAR, W * 0.006);
  ctx.fillStyle = FAR;
  const bi = g.base.inset;
  if (g.base.kind === 'plinth') {
    rect([bi, base.from, 1 - bi, base.to], NEAR, W * 0.008);
    rect([bi + 0.02, base.from + 0.025, 1 - bi - 0.02, base.to - 0.03], FAR);
  } else if (g.base.kind === 'wheels') {
    for (const cx of [bi, 1 - bi - 0.02]) {
      ctx.fillRect(cx * W, base.from * H, W * 0.016, (base.to - base.from) * H * 0.72);
      ctx.beginPath(); ctx.arc((cx + 0.008) * W, base.to * H - H * 0.04, H * 0.04, 0, Math.PI * 2); ctx.fill();
    }
  } else if (g.base.kind === 'drum') {
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * (base.from + 0.015), W * 0.42, H * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    for (const cx of [bi, 1 - bi - 0.025]) ctx.fillRect(cx * W, base.from * H, W * 0.026, (base.to - base.from) * H);
  }
  if (g.counter) rect(g.counter, NEAR, W * 0.006);   // bancada do campeão: sempre acima do corpo
  if (tilt) {
    // o vão cisalhado: arestas esquerda/direita verticais, topo e base subindo para a direita
    const [x0, yTop, x1, yBot] = [mouth[0] * W, mouth[1] * H, mouth[2] * W, mouth[3] * H];
    ctx.fillStyle = '#FF00FF';
    ctx.beginPath();
    // o lado esquerdo desce dy: lido da esquerda para a direita o vão SOBE, que é como a
    // abertura fecha para o lado que se afasta de uma câmera posta acima e à esquerda.
    ctx.moveTo(x0, yTop + dy); ctx.lineTo(x1, yTop); ctx.lineTo(x1, yBot - dy); ctx.lineTo(x0, yBot);
    ctx.closePath(); ctx.fill();
  } else {
    rect(mouth, '#FF00FF');   // the opening: painted by the model, detected by process-sprites
  }
  // Caráter do estilo, desenhado na faixa entre a boca e a base — nunca sobre o magenta.
  const bandTop = mouth[3] + 0.012, bandBot = body[3] - 0.012;
  if (g.spits) {
    ctx.fillStyle = '#6f6257';
    for (let i = 0; i < 3; i++) {
      const y = bandTop + (bandBot - bandTop) * (0.28 + i * 0.22);
      ctx.fillRect(mouth[0] * W, y * H, (mouth[2] - mouth[0]) * W, Math.max(2, H * 0.008));
    }
  }
  if (g.motor) { ctx.fillStyle = FAR; ctx.fillRect(body[0] * W - W * 0.05, (body[1] + 0.06) * H, W * 0.05, H * 0.10); }
  if (g.valve) {
    ctx.fillStyle = NEAR; ctx.beginPath();
    ctx.arc(body[2] * W + W * 0.012, ((bandTop + bandBot) / 2) * H, H * 0.022, 0, Math.PI * 2); ctx.fill();
  }
  const mwp = (mouth[2] - mouth[0]) * W, mhp = (mouth[3] - mouth[1]) * H;
  const perp = mhp - Math.abs(dy);   // o que o detector vê é a bbox; o que a comida ocupa é a perpendicular
  console.log(`[guide] ${grillId} e${evo} (${style}) ${W}×${H}${tilt ? ` corpo de nível, vão cisalhado ${tilt}°${tiltNote}` : roll ? ` com a câmera rolada ${roll}° (legado: tomba o móvel inteiro)` : ''}: boca ${Math.round(mwp)}×${Math.round(perp)} px de vão perpendicular (${Math.round(mhp)} px de caixa com o cisalhamento) `
    + `= ${(mwp / mhp).toFixed(2)}:1 · ${cap.zoneCount}×${cap.slotsPerZone} vagas · leito ${need.bedW} px na tela `
    + `· vaga ${need.cellW}×${need.cellH} → ${out}`);
  return c;
}

const flags = {}, pos = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    if (!['grill', 'evo', 'mouth-tilt', 'roll'].includes(key) || args[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete option: ${args[i]}`);
    }
    flags[key] = args[++i];
  } else pos.push(args[i]);
}
const [out, width = '1408'] = pos;
if (!out || !flags.grill || pos.length > 2) throw new Error('usage: make-grill-guide.mjs <out.png> [width] --grill <id> --evo <n> [--mouth-tilt <degrees>]');
const W = Number(width), evo = Number(flags.evo ?? 1);
const roll = Number(flags.roll ?? 0), mouthTilt = Number(flags['mouth-tilt'] ?? 0);
if (!Number.isInteger(W) || W < 128 || W > 4096 || !Number.isInteger(evo) || evo < 1 || evo > 3 ||
    !Number.isFinite(roll) || Math.abs(roll) > 20 || !Number.isFinite(mouthTilt) || Math.abs(mouthTilt) > 20) {
  throw new Error('Invalid dimensions/evolution/angle (width 128..4096, evo 1..3, angles -20..20)');
}
const dest = resolve(ROOT, out);
const inside = (dir) => { const r = relative(resolve(ROOT, dir), dest); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
if (inside('Assets') || inside('prototype/assets') || existsSync(dest)) {
  throw new Error('Guide output must be a NEW file outside Assets and prototype/assets; approved art is never overwritten');
}
const canvas = await drawGuide(out, { grillId: flags.grill, evo, W, roll, mouthTilt });
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, canvas.toBuffer('image/png'), { flag: 'wx' });
console.log('[guide] Authoring proposal only; no production pixels, registry or runtime geometry changed.');
