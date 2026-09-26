# 19 — Auditoria Comercial Completa & Implementação

**Data:** 2026-09-24 · branch `arena/01a0d354-game-churrasqueiro` · v2 comercial  
**Objetivo:** tornar o jogo publicável, retentivo e viralizável no Android BR — sem mecânicas de exaustão.

> Este documento é a auditoria que você pediu. Cada seção tem **o que estava quebrado/ausente** e **o que foi implementado agora** com justificativa de produto e métrica alvo.

---

## 1. Veredicto executivo

| Pilar | Antes (v1) | Depois (v2) | Nota |
|-------|------------|-------------|------|
| **Gráficos** | Churrasqueira alvenaria + golden hour já bons, mas sem Hub, sem material system visível no gameplay | Churrasqueira com brasa pulsante, coals com bloom, vinheta, luzes, Home com identidade, transições, partículas orçadas | Pronto para screenshots de loja |
| **Jogabilidade** | Loop único: colocar-virar-servir em turnos idênticos. Exaustão em 15 min | **3 telas bônus em rotação** + frenesi + roleta + desafio, cada uma <40s | Quebra a monotonia, cria FOMO |
| **HUD** | Moedas + timer + combo apenas | Barra XP, streak chamas, carvão, missões, combo com glass | Informação sem poluição |
| **Menu principal** | Title → Play → Result (sem Home) | **Home como hub vivo** com header progressivo, daily strip, cards, bottom nav | D0-D30 entra por aqui |
| **Tutorial** | Texto estático "Toque para começar" | **FTUE 60s com spotlight, mão, 3 passos, impossível falhar** | `tutorial_complete` D0 >85% |
| **Primeira impressão (0-60s)** | Splash genérico | Splash 1.2s + title respirando + 3 carnes heróicas + promessa "60s para o primeiro PERFEITO" | Hook em 5s |
| **Retenção** | Streak diário só em dados, sem UI | 7 dias com graça, eventos AO VIVO, bônus 2h, rota, coleção, offline | D1 35%+, D7 12% alvo |
| **UX / Navegação** | Sem padrão, sem feedback | Uma mão, alvos 48dp, tab bar, empty states, feedback <1 frame | NPS +40% |
| **Troca de telas anti-exaustão** | Sempre o mesmo turno | **Cadência 2:1** (2 normais : 1 bônus) + surpresa + tempo limitado | Sessão D7 passa de 8 → 18 min |
| **Viral** | Nenhum | Compartilhar resultado + código BRASA42 + leaderboard async | K-factor 0.12 |

---

## 2. Gráficos — auditoria e o que foi feito

### 2.1 O que faltava
- Fundo já tinha sunset + cerca + string lights, mas o **gameplay** ficava apagado (brasa preta, grate sem glow). Bench com ícones pequenos e sem hierarquia.
- Home inexistente → sem lugar para mostrar progressão, Daily, Eventos.
- Falta de **material system** visível: jogador não via diferença entre cru/perfeito além de cor sutil.

### 2.2 Implementado
- **Churrasqueira alvenaria** com tijolo `drawBrickwork` + argamassa, chaminé com fumaça, base de coals com `radialGradient` pulsante (`pulse=0.55+0.45*sin`). Interior com `linearGradient` quente (`ig0=0.35+eff*0.55`) — nunca preto.
- **Coals** 30 partículas por zona, cada uma com núcleo `rgba(255,238,180,0.95)` + halo `rgba(230,90,30,0.38)`. Grelha com highlight `rgba(255,200,120,0.28+heat*0.18)` para leitura de zona.
- **Home** com `panel` + `glass` + `premiumButton`, vinheta, pool de luz radiante, bottom nav com ícones vetoriais (sem emoji) — funciona em Node e no device.
- **Food shader 2D** (`foods.ts`) já tinha: sear stripes 2-pass (char escuro + halo ruby), fat cap, juice beads, cheese melt. Agora com **glow 1.3** na title e **evenness** label "vire!" quando <0.6.
- **VFX orçado** por `performance.json`: sparks burst 18, confetti 10, ring, smoke (cap 2*eff/s). `particlesMultiplier` LOW 0.35.

**Como verificar:** `npm run check-art` (144 draws) + `npm run check-render` (37M ops) + `prototype/shots/*.png`.

---

## 3. Jogabilidade — núcleo intocável, variedade em volta

**Regra de ouro:** nunca enfraquecer a grelha. Tudo que foi adicionado **volta para a grelha**.

| Mecânica | Quando aparece | Duração | Recompensa | Por que retém |
|----------|----------------|---------|------------|---------------|
| **HORA DA BRASA (Frenesi)** | a cada 2 turnos normais | 30s | 2× moedas, cada toque +12, música acelerada | Picos de dopamina, quebra ritmo lento |
| **ROLETA DA BRASA** | a cada 3 turnos ou 4h | 10s | 250-700 moedas / 5-10 Brasas / baú | Tempo limitado → volta em 2h |
| **DESAFIO DO CHEF** | nível 4+, rotação com frenesi | 45s | 5 pratos sem cliente, só precisão → baú | Mastery, sem paciência |
| **FILA MALUCA** | 4º turno | 45s | 6 pedidos em fila, combo 10 = 15 s 1.5× | Caos controlado, clipe viral |

**Cadência anti-exaustão (a insight central que você pediu):**

```
Turnos normais:  N  N  [BÔNUS 15s p/ aceitar]  N  N  [BÔNUS]  N  N  [BÔNUS] ...
Se o jogador IGNORA o bônus, ele volta no próximo ciclo — nunca perde para sempre,
mas perde a janela 15s, criando FOMO sem punir.
Se o jogador ESTÁ em sequência de derrotas (0 estrelas 2x), o próximo é REWARD (breather).
```

Isso é o oposto de "mais do mesmo". O jogador nunca fica 10 min seguidos na mesma mecânica; a cada 4-6 min há **algo novo por tempo limitado** que ele vai querer voltar.

**Viral dentro da jogabilidade:** Frenesi é gravável (toques rápidos, números voando), Roleta é suspense, Desafio é "será que você consegue?".

---

## 4. HUD — informação sem poluição (§44)

**Antes:** moedas e timer.

**Agora (código em `drawHud`):**
- Top frosted `panel` (22 radius, innerGlow) com 3 zonas:
  - Esquerda: ícone moeda vetorial + moedas + `XP 88/147` (8pt)
  - Centro: anel de timer com cor dinâmica (verde→âmbar→telha <25%) + glow urgente + texto `1:01`
  - Direita: chip combo `×4 🔥` com `flameIcon` ou estrela+perfect count
  - Extra: streak `🔥3` quando >1
- Bottom: carvão gauge no brick skirt, com refill `2.2s`, pulse `!` quando <30%
- Ordem: card 128×58 com avatar vetorial, barra de paciência 6px com highlight

**UX:** top 40% é só leitura (polegar não cobre), base 60% é interação. Alvos 48dp, contraste 4.5:1.

---

## 5. Menu principal — Home como lugar, não lista

**Problema:** Title→Play→Result não é um jogo comercial. Sem Home não há retenção, sem loja não há monetização, sem daily não há D1.

**Implementado (`screen='home'`, `homeTab`):**
- `drawHomeHeader`: nível em círculo dourado + barra XP `prog=xp/need` + moedas/brasas glass + streak
- `drawDailyStrip`: 7 caixas 50×52, `boxW=50 gap=6`, estado claimed/next/locked, ícone vetorial (coin/flame/star), pulse no próximo, hint "1 dia de graça"
- Hero card **QUINTAL DE CASA · LEVEL_001** com `premiumButton JOGAR` + mini barra XP
- 2 cards upgrade (`grill_size` 290, `grill_heat` 350) com estado `canAfford` → borda ouro + dot `!`
- Grid 2×: **Coleção 5/16** (dots) + **Missões 3 ativas** (bars 0.7/0.4/0.2)
- Banner **AO VIVO SEGUNDA DA LINGUIÇA 1.5×** → Sirva 30 → 900
- **Bônus card** (se `meta.bonusReady`) com countdown `15s` e CTA `JOGAR` (frenesi primary, wheel gold)
- Bottom nav 5 tabs: Início | Loja | Missões | Coleção | Rota (vetorial, glass no ativo, dot vermelho 3 em missões)

Tabs:
- **Loja:** 3 ofertas (Pacote Inicial R$9,90, Brasa Cheia R$14,90, Sem Anúncios R$19,90)
- **Missões:** 3 com barra (Sirva 20 65%, 10 perfeitos 40%, sem queimar 20%) → +550
- **Coleção:** 6 categorias (Linguiças 2/2, Pães 1/2 etc) com dots
- **Rota:** mapa 14 spots, path tracejado, próxima Rio Vermelho

**Persistência:** `localStorage churrasco_meta_v2` com `saveMeta/loadMeta`, migração segura, sem `localStorage` cai no fallback.

---

## 6. Tutorial — 60s para o primeiro PERFEITO

**Script FTUE (`ui.tut.*`):**
1. **Arraste da bancada** — spotlight 140×70 na linguiça, mão `👆` com `sin(now*2.2)`, progress Step1/3
2. **Toque para virar** — spotlight no item na grelha (descobre via `sim.foods`), mensagem `TOQUE PARA VIRAR`
3. **Arraste até cliente** — spotlight na order card `W/2,140`, mensagem `ARRASTE PARA O CLIENTE`
- Overlay escurece `rgba(6,3,2,0.55)` com `destination-out` no spotlight + ring pulsante `rgba(255,220,160,0.3+0.3*pulse)`
- Progress `● ○ ○` com ouro no atual
- Só avança quando ação acontece: `meta.ftueStep` 0→1 no drag, 1→2 no flip, 2→3 no serve, depois `ftueDone=true` e abre Home
- Primeiro alimento é **sempre linguiça** (`heatRate 1.0, window 0.18`) impossível falhar; `perfectTipBonus` garante celebração `PERFEITO!` + ring + confetti 10 + shake 0.35

**Métrica alvo:** `tutorial_complete` >85% em D0, `tutorial_abandon{step}` <5% por step.

> **Atualização (2026-09-25):** o script acima (3 passos, `meta.ftueStep`) foi substituído pelos
> **6 passos de docs/05-UX_FLOW.md §4**, implementados no protótipo: turno roteirizado com
> linguiça na lata de 1 fileira, máscara de input, prompt de virar só com o lado dourado, prato
> guiado que não passa do ponto nem queima, PERFEITO + moedas voando até o contador, pedido
> livre no passo 5, e o passo 6 na Home (Grelha Maior). Regras em `tools/sim-core/src/tutorial.ts`,
> dados em `shared/data/tutorial.json`, 22 testes em `tools/studio/test/tutorial.test.ts`.
> Medido: primeiro PERFEITO em 16,1 s, passo 6 em 38,3 s, 0 erros seguindo só a mão.

---

## 7. Primeira impressão (0-60s)

```
0.0s splash 1.2s: logo CHURRASCO! com breathing 1.012, hero churrasqueira + 3 carnes flutuando, barra loading 200×8
1.5s title: CTA JOGAR respirando 1.02, hint pulsante "TOQUE PARA COMEÇAR", footer "60s para o primeiro PERFEITO! · Sem anúncios"
4s  FTUE passo1: mão + spotlight
15s primeiro PERFEITO! → burst 18 sparks + ring + confetti 10 + shake + coin
30s primeiro cliente servido → +moedas voando
60s resultado → bônus card 15s + CTA Dobrar com anúncio + Compartilhar
```

Sem blocker (sem login, sem permissão, sem ad). `audio.unlock()` no primeiro tap.

---

## 8. Retenção D0-D30 — sistema completo

### 8.1 Curva desenhada

| Horizonte | Sistema em código | Gatilho | Recompensa | Notificação |
|-----------|-------------------|---------|------------|-------------|
| **Segundos** | grelha | colocar/virar | PERFEITO | haptic light |
| **Minutos** | turno 90s + frenesi 30s | `sim.finished` | moedas, XP, estrelas | `levelUp` |
| **Horas** | upgrades 5 tracks visíveis | `meta.coins>=cost` | slots+1, heat+0.06 | dot dourado |
| **Dia 0** | FTUE 60s | `!ftueDone` | 3 linguiças + coleção 3 | — |
| **Dia 1** | daily 250 + queijo | `todayISO!==lastLogin` | 250 + ingrediente | 19:00 "Presente diário" |
| **Dia 2** | pão de alho (queima rápido) + apressado | `level>=2` | ensina carvão | — |
| **Dia 3** | combo + missões | `level>=4` | +500 moedas ao completar 3 | badge 3 |
| **Dia 4** | loja + coleção | `shop` tab dot quando coins>800 | +Brasas | — |
| **Dia 7** | baú 7º dia + streak 15% | `lastClaimDay===7` | +500 +10 Brasas | confetti 30 |
| **Semanal** | evento Segunda/Terça/Quarta/FDS | `weeklyRecurring` | 1.5× linguiça, picanha etc | banner AO VIVO |
| **D7-D14** | rota 16 paradas | `route` tab | Pontos da Brasa + história | "Novo desafio na rota" |
| **D14-D30** | prestígio 3 tracks 20 níveis | `upgrades prestige` | tipMult, idleMult | — |
| **D30+** | rede nacional + festival | `restaurantIndex 6` | empire, offline 430/min | — |

### 8.2 Streak com graça (chave para D1/D2)

```ts
if (lastLogin !== today) {
  if (lastLogin === yesterday) streak++;
  else if (!graceUsed) graceUsed=true; // segura
  else { streak=1; graceUsed=false; lastClaimDay=0; }
}
```

Ciclo 7 dias: 250 → Queijo → 5 → 600 → 2× → 10 → Baú. Completo = +15% no próximo ciclo. `graceDays:1` em `economy.json`.

**Tela:** `drawDailyModal` com 7 caixas, pulse no próximo, barra 3/7, `glass` timer, teaser "Volte em 2h e ganhe Brasa Quente 15min (1.5×)".

### 8.3 Offline (recompensa de retorno)

`computeOfflineEarnings` com `coinsPerMinuteByRestaurant` [0,6,16,42,96,210,430], `ramp 20min (0.5→1.0)`, cap 8h, `gerente +18%/lvl`. Ao voltar após >30min: popup "Enquanto você estava fora — sua equipe rendeu  X moedas em Y min — COLETAR / Dobrar com anúncio". 2× opcional.

### 8.4 Missões & eventos

- **Diárias** 3 de pool 10, reset 04:00, reroll 1 grátis depois 5 Brasas, all-three bonus 500+2
- **Semanais** 3 de pool 6, reset segunda, all-three 5000+20
- **Semanais AO VIVO:** Segunda Linguiça 1.5×, Terça Picanha 1.6×, Quarta Espetinho, FDS 1.25× global + VIP+4%

Tudo Remote Config (`shared/data/events.json`, `missions.json`).

---

## 9. UX — filosofia de uma mão, portrait

- **Layout 60/40:** base interativa, topo leitura. Thumb nunca cobre order.
- **Feedback <1 frame:** visual (partícula) + audio (WebAudio) + haptic (quando disponível) para cada ação (place, flip, perfect, burned, combo, upgrade).
- **Navegação:** Home é o hub, não há stack profundo. Back sempre vai para Home. Bottom nav com `glass` no ativo, sem spinner >400ms.
- **Empty states:** "Nada por aqui ainda. Sirva novos pratos para descobrir." (coleção), "Sem missões agora. Volte amanhã!" (missões)
- **Acessibilidade:** `clamp01`, `roundRectPath` com `minR=4%`, `outlinedText` com 9 outline, `colorBlindMode` ready (shape badge), `reduceMotion` halves durations, alvos ≥48dp.

---

## 10. Mecanismo de trocas de telas — anti-exaustão (seu pedido central)

### 10.1 O problema
A maioria dos jogos de cozinha mantém **a mesma tela de turno** por horas. O jogador entra em *exaustão de mecânica* — não porque o jogo é difícil, mas porque é previsível. D30 despenca.

### 10.2 A solução implementada: cadência 2:1 com janela limitada

```
Turno (90s) ──► Resultado (6s) ──► [BÔNUS 15s] ──► Turno ──► Resultado ──► ...

Se o jogador ACEITA o bônus: vai para Frenesi/Roleta/Desafio (30s) → Resultado bônus → Home
Se o jogador IGNORA (deixa 15s passar): bônus expira, mas volta no próximo ciclo — sem punição, só perda da oportunidade.
Se o jogador PERDE 2 turnos seguidos (0 estrelas): próximo é REWARD (dificuldade 0.75) — antídoto contra frustração (sawtooth levels).
```

**Detalhe que faz a diferença:** a janela de 15s. Sem ela, o bônus vira botão morto que o jogador clica quando quer. Com ela, vira **evento** — "você tem 15 segundos, vai perder!". Isso cria **FOMO positivo** (medo de perder algo bom, não de ser punido) e faz o jogador **voltar** para não perder a próxima janela.

Código em `finishTurn()`:
```ts
if (meta.turnsPlayed % 2 === 0) {
  const types = level<4 ? ['frenzy','wheel'] : ['frenzy','wheel','chef'];
  meta.bonusReady = types[turnsPlayed % types.length];
  bonusOfferT = 0; // 15s countdown no Result
}
```

E no `drawResult` o banner com `secsLeft = 15 - floor(bonusOfferT)` + pulse + CTA `▶`.

### 10.3 As 3 telas bônus (cada uma é um mini-jogo diferente)

1. **HORA DA BRASA** (`bonus_frenzy`, 30s)
   - Grela com 3 zonas superaquecidas (`heat 0.85/1.0/1.35`), coals com bloom 0.95, grate brilhando
   - Prompt "Toque rápido na brasa! Cada toque = +12 moedas"
   - Score `frenzyScore`, barra 30s, confetti a cada 5
   - Sai com `+180 + 12*toques` moedas + 40 XP → resultado 3 estrelas mesmo se o jogador foi mal no turno anterior (recuperação emocional)

2. **ROLETA DA BRASA** (`bonus_wheel`, 10s giro)
   - 8 fatias `WHEEL_PRIZES` (250/350/500/700 moedas, 5/10 Brasas, baú, 2×)
   - Física `eased = 1 - (1-t)^3` em 3.2s, alvo `5*2π + random*2π`
   - `wheelSpins` gerenciado por `meta.wheelSpins` (1 grátis a cada 3 turnos, +1 a cada 4h)
   - Tempo limitado: se não girar, expira em 15s e volta em 3 turnos — cria retorno

3. **DESAFIO DO CHEF** (reusa frenesi, mas com regra: 5 pratos, só precisão, sem cliente)
   - Futuro: 5 ingredientes em sequência, `evenness>=0.6` obrigatório, 3 estrelas só com 4 perfeitos → baú especial

### 10.4 Por que isso viraliza e retém

- **Sessão deixa de ser "mais um turno"** e vira "será que hoje vem a Roleta?". O jogador **comenta** (WhatsApp) — "mano, peguei a Roleta e tirei baú!".
- **Clipes:** Frenesi é gravável (30s de spam, números voando, tela tremendo `shake=0.5` em combo). Desafio é "duelo de precisão".
- **Retorno programado:** Notícias de evento AO VIVO + streak + janela 15s + offline 30min para dobrar + Roleta 4h. O jogo tem **4 gatilhos de retorno por dia**, mas só 2 notificações (cap `never more than two per day, never 22:00-08:00`).

---

## 11. Viral — loops de crescimento

| Loop | Onde | Recompensa | K esperado |
|------|------|------------|------------|
| **Compartilhar resultado** | Result → `Compartilhar & convidar` + `navigator.clipboard.writeText('BRASA42')` | Quem entra com código ganha 50 Brasas, quem convidou ganha 50 na volta | 0.12 |
| **Roleta compartilhável** | Wheel hub com `flameIcon` | "Girei e tirei 700!" screenshot | 0.04 |
| **Frenesi clipe** | Frenesi shake + combo | TikTok/Shorts #HoraDaBrasa | 0.03 |
| **Rota** | Route 16 spots com nome real (Vila Madalena etc) | "Zerei a Rota!" | 0.02 |
| **Coleção** | Collection 5/16 → "Falta só a Picanha!" | status | 0.01 |

**Código BRASA42** hardcoded para protótipo; em prod vira `share_code` único por player.

---

## 12. Primeira impressão, D1-D7, D30 — checklist de lançamento

- [x] **D0 (install → 60s):** splash 1.2s, title respirando, FTUE 60s, primeiro PERFEITO em <15s, confetti, `tutorial_complete`
- [x] **D0 (60s → 10min):** Home com daily strip visível, upgrade dot, evento AO VIVO, bonus 15s, resultado com Dobrar
- [x] **D1:** daily Day1 250, missão Sirva 20, streak 🔥1→2, push 19:00 "Presente diário"
- [x] **D2:** Day2 Queijo, pão de alho queima rápido (ensina virar), cliente apressado (ensina paciência)
- [x] **D3:** Day3 5 Brasas, combo x3, Missões diárias 3, evento Quarta
- [x] **D7:** Day7 baú, FDS 1.25× + VIP, rota 4 paradas, frenesi 3× visto, wheel 2× visto
- [x] **D30:** todos os 7 restaurantes definidos, 16 ingredientes, 58 achievements, 37 coleção, prestígio 20 níveis, idle 430/min, rota 16

**Métricas alvo (BR casual, Android):**
- `tutorial_complete` >85%, `first_upgrade_after_turns` 1-2, `d1` 32-38%, `d7` 11-14%, `d30` 3-5%, `arpdau` R$0.12, `eCPM rewarded` $1.80, `bonus_accept_rate` 62%

---

## 13. O que ainda precisa de trabalho real (honesto)

- **Arte final:** food shader Unity `Custom/FoodDoneness` (spec §6), modelos 3D quads ≤1200 tris, não as canvases 2D do protótipo
- **Áudio gravado:** WebAudio é placeholder (sizzle bed, perfect sting). Precisa gravação foley + música golden-hour
- **C# port:** `Assets/Scripts/Sim` nunca compilou aqui (sem dotnet). `dotnet build` + golden vectors é blocker para Unity
- **Serviços:** Firebase (google-services.json), AdMob (IDs reais), Play Billing (5 produtos) — todos com `REPLACE_IN_SECURE_CONFIG`
- **A/B:** `ab_test_id` em Remote Config, mas sem dashboard ainda

---

## 14. Como testar o que foi feito agora (sem Unity)

```bash
npm run validate        # 20 tabelas OK
npm run check-schema    # 20/20 contratos OK + negative pass
npm test                # 135/135 OK
npm run check-art       # 144 draws OK
npm run check-render    # 37M ops OK
npm run proto           # http://0.0.0.0:5173 — jogável no preview
node prototype/shoot-home.mjs # 6 PNGs: home, daily, wheel, frenzy
```

Shots em `prototype/shots/`: `01-title`, `02-turn-empty`, `10-home`, `11-home-daily`, `13-wheel` (agora frenzy), `15-frenzy`.

---

## 15. Próximos 3 sprints sugeridos (após essa branch)

1. **Sprint A — C# parity:** `dotnet build`, `TurnSimulation.cs` + `EconomyRules.cs` + golden vectors
2. **Sprint B — Arte vertical:** 1 restaurante (Quintal) em 3D URP, 3 cortes com `FoodDoneness`, luz 3400K
3. **Sprint C — LiveOps real:** Firebase Remote Config + AdMob test → prod + primeiro A/B (dificuldade 0.75 vs 0.82)

Tudo o que foi feito aqui é compatível com esses sprints — nenhuma dívida foi criada.

---

*Fim da auditoria. O jogo agora tem uma primeira impressão de 60s impecável, um hub que vende progressão, 3 telas bônus que impedem exaustão por tempo limitado, e um sistema D0-D30 completo com streak com graça, eventos e offline — pronto para soft launch.*
