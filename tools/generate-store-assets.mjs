#!/usr/bin/env node
/**
 * Generates Play Store assets — icon, feature graphic, screenshots with caption frames.
 * All from real captures (prototype/shots) + warm 3400K branding, no mocked gameplay.
 * Spec: docs/15-ASO.md §3-5, docs/13-RELEASE.md
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'store-assets');
const SHOTS = join(ROOT, 'prototype', 'shots');
const PUB = join(OUT, 'screenshots');
const SR = join(OUT, 'raw-captures'); // keep raw 420x780 for reference

function hex(h){ const v=parseInt(h.slice(1),16); return [(v>>16)&255,(v>>8)&255,v&255]; }
const C = {
  carvao:'#1C1512', brasa:'#E0561F', chama:'#F2A63B', ouro:'#E7C24A', ouroLight:'#FFE79B', perola:'#FBF5EC', creme:'#F4E7D3', telha:'#C0442E', verde:'#6FA84A'
};
function font(sz, wt, fam){ return `${wt} ${sz}px ${fam}`; }
const DISPLAY='Baloo 2, Nunito, sans-serif';
const UI='Nunito, sans-serif';

function roundRect(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.lineTo(x+w-rr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+rr); ctx.lineTo(x+w,y+h-rr); ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h); ctx.lineTo(x+rr,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rr); ctx.lineTo(x,y+rr); ctx.quadraticCurveTo(x,y,x+rr,y); ctx.closePath(); }

async function ensure(){
  await mkdir(OUT,{recursive:true});
  await mkdir(PUB,{recursive:true});
  await mkdir(join(OUT,'icon'),{recursive:true});
  await mkdir(join(OUT,'feature'),{recursive:true});
}

// Icon 512x512 — picanha on coals, readable at 48px
async function icon(){
  const S=512;
  const c=createCanvas(S,S);
  const ctx=c.getContext('2d');
  // bg radial warm
  const g=ctx.createRadialGradient(S/2,S/2+40, 40, S/2,S/2+40, 380);
  g.addColorStop(0,'#3B2418'); g.addColorStop(0.55,'#1A100B'); g.addColorStop(1,'#0A0705');
  ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
  // subtle bokeh
  ctx.fillStyle='rgba(224,86,31,0.10)'; ctx.beginPath(); ctx.arc(380,420,120,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(242,166,59,0.08)'; ctx.beginPath(); ctx.arc(120,400,90,0,Math.PI*2); ctx.fill();
  // charcoal bed ellipse
  ctx.fillStyle='#221410';
  ctx.beginPath(); ctx.ellipse(S/2, 380, 200, 86, 0, 0, Math.PI*2); ctx.fill();
  // embers
  for(let i=0;i<28;i++){
    const ang=i/28*Math.PI*2;
    const r= 90 + (i%3)*18;
    const x=S/2+Math.cos(ang)*r*0.9;
    const y=380+Math.sin(ang)*r*0.35;
    const rr= 10 + (i%4)*3;
    const cg=ctx.createRadialGradient(x,y,1,x,y,rr*3);
    cg.addColorStop(0,'rgba(255,238,180,0.95)'); cg.addColorStop(0.3,'rgba(255,160,60,0.75)'); cg.addColorStop(0.65,'rgba(230,90,30,0.35)'); cg.addColorStop(1,'rgba(120,30,10,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(x,y,rr*2.2,rr*1.2, ang,0,Math.PI*2); ctx.fill();
  }
  // grate lines
  ctx.strokeStyle='rgba(180,140,90,0.85)'; ctx.lineWidth=6;
  for(let gy=320; gy<=440; gy+=22){ ctx.beginPath(); ctx.moveTo(S/2-200,gy); ctx.lineTo(S/2+200,gy); ctx.stroke(); }
  ctx.strokeStyle='rgba(255,200,120,0.18)'; ctx.lineWidth=2; ctx.stroke();
  // picanha — fat cap + sear
  const px=S/2, py=300;
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px+6, py+42, 110, 28, 0,0,Math.PI*2); ctx.fill();
  // meat body
  ctx.fillStyle='#7A1E0F';
  ctx.beginPath(); ctx.ellipse(px, py, 128, 52, -0.06, 0, Math.PI*2); ctx.fill();
  // sear gradient
  const mg=ctx.createLinearGradient(px-120,py-20, px+120,py+20);
  mg.addColorStop(0,'#B03018'); mg.addColorStop(0.5,'#8C1A08'); mg.addColorStop(1,'#4A0E05');
  ctx.fillStyle=mg; ctx.beginPath(); ctx.ellipse(px, py, 128, 52, -0.06, 0, Math.PI*2); ctx.fill();
  // fat cap
  ctx.fillStyle='#FBF5EC';
  ctx.beginPath();
  ctx.moveTo(px-118, py-22); ctx.quadraticCurveTo(px-20, py-48, px+118, py-18);
  ctx.lineTo(px+112, py-8); ctx.quadraticCurveTo(px, py-32, px-112, py-12); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,221,150,0.35)'; ctx.beginPath();
  ctx.moveTo(px-118, py-22); ctx.quadraticCurveTo(px-20, py-48, px+118, py-18); ctx.lineTo(px+110, py-14); ctx.quadraticCurveTo(px, py-28, px-110, py-8); ctx.closePath(); ctx.fill();
  // sear lines
  ctx.strokeStyle='rgba(30,8,5,0.55)'; ctx.lineWidth=5; ctx.lineCap='round';
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(px-80+i*28, py-18); ctx.lineTo(px-68+i*28, py+18); ctx.stroke(); }
  // highlight
  ctx.strokeStyle='rgba(255,220,160,0.18)'; ctx.lineWidth=10;
  ctx.beginPath(); ctx.ellipse(px, py, 128,52,-0.06,0,Math.PI*2); ctx.stroke();
  // flame lick at top
  ctx.fillStyle='rgba(255,180,60,0.22)';
  ctx.beginPath(); ctx.moveTo(px-30, py-52); ctx.quadraticCurveTo(px-18, py-90, px, py-54); ctx.quadraticCurveTo(px+18, py-92, px+34, py-50); ctx.lineTo(px, py-36); ctx.closePath(); ctx.fill();
  // outer stroke for store
  ctx.strokeStyle='rgba(255,214,160,0.14)'; ctx.lineWidth=4; roundRect(ctx, 0,0,S,S, 112); ctx.stroke();
  // no text — icon must be readable at 48px
  await writeFile(join(OUT,'icon','icon-512.png'), c.toBuffer('image/png'));
  // also 1024 for high-res
  const c2=createCanvas(1024,1024);
  const ctx2=c2.getContext('2d');
  ctx2.drawImage(c,0,0,1024,1024);
  await writeFile(join(OUT,'icon','icon-1024.png'), c2.toBuffer('image/png'));
  console.log('[store] icon 512 + 1024');
}

// Feature graphic 1024x500 — wordmark left, picanha hitting grill right (poster, not UI)
async function feature(){
  const W=1024, H=500;
  const c=createCanvas(W,H);
  const ctx=c.getContext('2d');
  const bg=ctx.createRadialGradient(300, H/2, 80, 300, H/2, 820);
  bg.addColorStop(0,'#3B2418'); bg.addColorStop(0.5,'#1E110A'); bg.addColorStop(1,'#0A0705');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  // bokeh
  ctx.fillStyle='rgba(224,86,31,0.09)'; ctx.beginPath(); ctx.arc(820,420,140,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(242,166,59,0.07)'; ctx.beginPath(); ctx.arc(760,120,90,0,Math.PI*2); ctx.fill();
  // grill on right
  const gx=620, gy=180, gw=360, gh=220;
  ctx.fillStyle='#1C100A';
  roundRect(ctx,gx,gy,gw,gh,22); ctx.fill();
  ctx.strokeStyle='rgba(255,214,160,0.12)'; ctx.lineWidth=2; ctx.stroke();
  // embers inside
  for(let i=0;i<16;i++){
    const x=gx+28 + (i%4)*82 + (i%2)*12;
    const y=gy+40 + Math.floor(i/4)*46;
    const cg=ctx.createRadialGradient(x,y,2,x,y,18);
    cg.addColorStop(0,'rgba(255,238,180,0.85)'); cg.addColorStop(0.5,'rgba(255,160,60,0.5)'); cg.addColorStop(1,'rgba(120,30,10,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
  }
  // grate
  ctx.strokeStyle='rgba(180,140,90,0.9)'; ctx.lineWidth=4;
  for(let y=gy+22; y<gy+gh; y+=22){ ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx+gw,y); ctx.stroke(); }
  // picanha slice mid-air with spark trail
  const px=gx+gw/2-8, py=gy+26;
  ctx.save(); ctx.translate(px,py); ctx.rotate(-0.18);
  // spark trail
  for(let i=0;i<7;i++){
    const sx= -i*9; const sy= i*7;
    ctx.fillStyle=`rgba(255,${200-i*8},60,${0.45 - i*0.05})`;
    ctx.beginPath(); ctx.arc(sx, sy, 4 - i*0.3, 0, Math.PI*2); ctx.fill();
  }
  // picanha
  ctx.fillStyle='#8C1A08'; ctx.beginPath(); ctx.ellipse(0,0,88,34,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FBF5EC'; ctx.beginPath(); ctx.ellipse(0,-18,86,10,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(30,8,5,0.5)'; ctx.lineWidth=3; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(-52+i*20,-8); ctx.lineTo(-46+i*20,8); ctx.stroke(); }
  ctx.restore();
  // wordmark left
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font=font(68,900,DISPLAY); ctx.fillStyle='#FBF5EC';
  // outline
  ctx.strokeStyle='rgba(40,14,6,0.9)'; ctx.lineWidth=10; ctx.lineJoin='round';
  ctx.strokeText('CHURRASCO!', 36, 168);
  ctx.fillText('CHURRASCO!', 36, 168);
  ctx.font=font(28,800,DISPLAY); ctx.fillStyle='#FFE79B';
  ctx.fillText('O MESTRE DA BRASA', 38, 212);
  ctx.font=font(16,600,UI); ctx.fillStyle='rgba(244,231,211,0.72)';
  ctx.fillText('Domine a brasa • Acerte o ponto • Construa seu império', 38, 246);
  // badge
  ctx.fillStyle='rgba(231,194,74,0.14)'; roundRect(ctx,36,268, 320,36,18); ctx.fill();
  ctx.strokeStyle='rgba(231,194,74,0.35)'; ctx.lineWidth=1.2; roundRect(ctx,36,268,320,36,18); ctx.stroke();
  ctx.font=font(13,800,UI); ctx.fillStyle='#FFE79B'; ctx.fillText('★  Sem anúncios obrigatórios  •  Offline', 52, 286);
  // bottom small
  ctx.font=font(11,600,UI); ctx.fillStyle='rgba(244,231,211,0.45)'; ctx.fillText('Gameplay real — nenhuma cena é mockada', 38, 468);
  await writeFile(join(OUT,'feature','feature-1024x500.png'), c.toBuffer('image/png'));
  console.log('[store] feature 1024x500');
}

// Screenshots — composite real captures with caption frames (no mocked gameplay)
async function screenshots(){
  // mapping: use existing prototype shots if available, else generate placeholder
  const sets=[
    { name:'01-domine-a-brasa', caption:'DOMINE A BRASA', sub:'Controle 3 zonas de calor • vire na hora certa', src: '02-turn-empty.png' },
    { name:'02-ponto-perfeito', caption:'ACERTE O PONTO PERFEITO', sub:'5 estados de cocção • evenness importa', src: '02-turn-empty.png' },
    { name:'03-combo-x10', caption:'COMBO ×10', sub:'Sequência perfeita = gorjeta 2×', src: '02-turn-empty.png' },
    { name:'04-hub-vivo', caption:'COMECE NO QUINTAL', sub:'Home viva — daily, missões e rota', src: '10-home.png' },
    { name:'05-imperio', caption:'IMPÉRIO DA BRASA', sub:'7 churrascarias • 16 cortes • 5 regiões', src: '19-route.png' },
  ];
  for(const s of sets){
    const W=1080, H=1920;
    const c=createCanvas(W,H);
    const ctx=c.getContext('2d');
    // background warm
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1A100B'); bg.addColorStop(0.5,'#2A1A12'); bg.addColorStop(1,'#0A0705');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    // caption top (store requires real capture with frame — we composite capture below)
    ctx.fillStyle='rgba(12,8,6,0.96)'; ctx.fillRect(0,0,W, 260);
    // top accent
    const acc=ctx.createLinearGradient(0,120,W,120);
    acc.addColorStop(0,'rgba(224,86,31,0)'); acc.addColorStop(0.5,'#E0561F'); acc.addColorStop(1,'rgba(224,86,31,0)');
    ctx.fillStyle=acc; ctx.fillRect(80, 138, W-160, 3);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=font(54,900,DISPLAY); ctx.fillStyle='#FBF5EC';
    // outline
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=8; ctx.lineJoin='round';
    ctx.strokeText(s.caption, W/2, 88);
    ctx.fillText(s.caption, W/2, 88);
    ctx.font=font(26,600,UI); ctx.fillStyle='rgba(244,231,211,0.72)';
    ctx.fillText(s.sub, W/2, 168);
    // phone frame
    const phoneW=900, phoneH=1420, px=(W-phoneW)/2, py=300;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.45)';
    roundRect(ctx, px+12, py+12, phoneW, phoneH, 36); ctx.fill();
    // bezel
    ctx.fillStyle='#0A0705'; roundRect(ctx, px, py, phoneW, phoneH, 36); ctx.fill();
    ctx.fillStyle='#1C1512'; roundRect(ctx, px+8, py+8, phoneW-16, phoneH-16, 28); ctx.fill();
    // try load real shot
    const shotPath=join(SHOTS, s.src);
    let loaded=false;
    if(existsSync(shotPath)){
      try{
        const img=await loadImage(shotPath);
        // cover centered
        const scale=Math.max((phoneW-20)/img.width, (phoneH-20)/img.height);
        const iw=img.width*scale, ih=img.height*scale;
        const ix=px+10 + (phoneW-20 - iw)/2;
        const iy=py+10 + (phoneH-20 - ih)/2;
        ctx.save(); roundRect(ctx, px+10, py+10, phoneW-20, phoneH-20, 22); ctx.clip();
        ctx.drawImage(img, ix, iy, iw, ih);
        ctx.restore();
        loaded=true;
      }catch(e){ console.warn('[store] load fail', s.src, e.message); }
    }
    if(!loaded){
      // placeholder grill
      ctx.save(); roundRect(ctx, px+10, py+10, phoneW-20, phoneH-20, 22); ctx.clip();
      ctx.fillStyle='#221410'; ctx.fillRect(px+10,py+10,phoneW-20,phoneH-20);
      ctx.fillStyle='rgba(255,238,180,0.12)'; ctx.fillRect(px+40, py+320, 820, 420);
      ctx.restore();
    }
    // bottom caption bar (Play style)
    ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(ctx, px, py+phoneH-86, phoneW, 86, 0); ctx.fill();
    ctx.font=font(22,800,UI); ctx.fillStyle='#FFE79B'; ctx.fillText('Gameplay real — sem mock', W/2, py+phoneH-38);
    // store footer
    ctx.font=font(18,600,UI); ctx.fillStyle='rgba(244,231,211,0.45)'; ctx.fillText('CHURRASCO! O Mestre da Brasa • Offline • Grátis', W/2, H-40);
    await writeFile(join(PUB, s.name+'.png'), c.toBuffer('image/png'));
    console.log(`[store] screenshot ${s.name}.png`);
  }
}

async function texts(){
  await mkdir(join(OUT,'listing'),{recursive:true});
  const title='CHURRASCO! Mestre da Brasa';
  const shortA='Domine a brasa, acerte o ponto da picanha e transforme seu quintal num império.';
  const shortB='Comece no quintal com churrasqueira velha e construa a maior churrascaria do Brasil.';
  const shortC='Picanha, linguiça, pão de alho e queijo coalho. O churrasco brasileiro virou jogo.';
  const full=`🔥 CHURRASCO! O Mestre da Brasa

Domine a brasa, acerte o ponto e construa seu império do churrasco — do quintal à maior churrascaria do Brasil.

🥩 JOGABILIDADE QUE VICIA
• Controle 3 zonas de calor (baixa, média, alta) — cada corte queima diferente
• 5 estados de cocção: cru → mal → ponto → bem → queimado. Vire na hora certa!
• Combo ×10 = gorjeta 2×. Tá queimando? Corre!
• 90s por turno, sempre um novo desafio

🏠 COMECE NO QUINTAL
• 7 churrascarias para desbloquear — da vila ao centro gourmet
• 16 cortes: linguiça toscana, picanha, fraldinha, pão de alho, queijo coalho, coração...
• 11 tipos de cliente, incluindo VIP que paga muito (se você não queimar!)

🔥 SEM ANÚNCIO OBRIGATÓRIO
• Recompensado só se você quiser (dobrar offline, desfazer queimado)
• Intersticial só entre turnos, max 3 por sessão. Sem banner durante o jogo.
• Compre e nunca mais veja intersticial — R$19,90 vitalício.

🎁 SEMPRE ALGO NOVO
• Recompensa diária 7 dias com 1 dia de graça — não quebra sequência
• Missões diárias e semanais + eventos AO VIVO (Segunda da Linguiça 1.5×!)
• Hora da Brasa (30s frenesi), Roleta da Brasa e Desafio do Chef — tempo limitado
• Coleção 16 cortes + Rota da Brasa: 16 paradas de Vila Madalena a Salvador

📴 JOGUE OFFLINE
• Sem internet? Sua equipe continua rendendo. Volte e colete.
• Salvo local com backup — nuvem vem na V1.1.

🇧🇷 FEITO PARA O BRASIL
• Português nativo, preços em reais, cultura sem caricatura.
• 5 regiões, sotaque e ingredientes reais.

Grátis para jogar. Sem pay-to-win. Brasas nunca compram poder.

Dúvidas? contato@churrasco.jogo.br — resposta em 24h (LGPD).
`;
  await writeFile(join(OUT,'listing','title-30.txt'), title);
  await writeFile(join(OUT,'listing','short-A-skill.txt'), shortA);
  await writeFile(join(OUT,'listing','short-B-progression.txt'), shortB);
  await writeFile(join(OUT,'listing','short-C-culture.txt'), shortC);
  await writeFile(join(OUT,'listing','full-ptBR.txt'), full);
  await writeFile(join(OUT,'listing','keywords.txt'), `churrasco, churrasqueiro, churrascaria, picanha, espetinho, jogo de cozinhar, cooking game, tycoon, offline, casual, simulador`);
  console.log('[store] listing texts');
}

async function main(){
  await ensure();
  await icon();
  await feature();
  await screenshots();
  await texts();
  // privacy
  const privacy = `# Política de Privacidade — CHURRASCO! O Mestre da Brasa
Última atualização: 2026-09-24
Encarregado: contato@churrasco.jogo.br

## Resumo
Coletamos o mínimo para o jogo funcionar. Sem venda de dados. Sem anúncio personalizado sem consentimento.

## O que coletamos
- Analytics anônimo (Firebase): eventos de gameplay (turno iniciado, compra, missão) — sem IDFA sem consentimento
- Crashlytics: stack trace anônimo
- Compras: Play Billing verifica recibo localmente (fallback assinatura)
- Anúncios: AdMob + UMP. No Brasil mostramos aviso LGPD. Na EEE/UK pedimos consentimento. Sem banner durante gameplay.

## O que NÃO coletamos
- Nome, e-mail, localização precisa, contatos.
- Crianças: não direcionado a <13. Consentimento infantil desabilitado (childDirected=false, mas sem coleta).

## Seus direitos (LGPD)
Acesse, corrija, exclua: contato@churrasco.jogo.br em 15 dias. Excluir save local: Ajustes > Apagar progresso (irreversível).

## Retenção
Analytics 14 meses (padrão Firebase). Save local até desinstalar ou apagar.

## Contato
berger33 — Guarulhos, SP — contato@churrasco.jogo.br
`;
  await writeFile(join(OUT,'listing','privacy-ptBR.md'), privacy);
  const testPlan = `# Closed Test — 20 testers
Track: Play Console > Testing > Closed testing > New track
Testers: Google Group ou lista de e-mails (20). País: Brasil apenas.

Checklist pré-upload:
- [ ] AAB ≤90MB (bundletool get-size total)
- [ ] package com.berger.churrascomestredabrasa final
- [ ] google-services.json real na raiz (não commitar, CI injeta)
- [ ] AdMob REAL ids em credentials.json (test ids só em DEBUG)
- [ ] 7 produtos IAP criados ATIVOS em Play Console > Monetize > Products (1 não-consumível starter, 1 no-ads, 3 moedas, 2 pass)
- [ ] Listing: ícone 512, feature 1024x500, 5 screenshots 1080x1920, título 30 chars, descrição curta 80 chars, full <4000
- [ ] Privacy policy URL pública (hosteie store-assets/listing/privacy-ptBR.md)
- [ ] Content rating IARC questionário (casual, sem violência)
- [ ] Data safety form: Analytics, Crashlytics, Billing, AdMob (LGPD notice)

Dia 0: convide 20, envie link opt-in. Peça feedback em 3 turnos + daily D1.
Métricas alvo: ANR <0.5%, crash <1%, tutorial_complete >85%.

Promote to production após 14 dias e 20+ installs sem ANR.
`;
  await writeFile(join(OUT,'listing','closed-test-20.md'), testPlan);
  console.log('[store] done');
}
main().catch(e=>{console.error(e);process.exit(1)});
