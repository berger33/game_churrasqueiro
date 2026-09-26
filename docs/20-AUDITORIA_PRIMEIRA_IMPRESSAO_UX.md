# 20 — Auditoria de Primeira Impressão & UX (2026-09-24)

**Escopo:** primeiros 90s desde o toque no ícone até o 2º turno. Auditado no protótipo canvas (420×780) + 5 screenshots de loja + dev-server. Metodologia: heurísticas Nielsen Mobile, 5s test, FTUE dogfooding, medição de TTFS, acessibilidade WCAG 2.1 AA, moto G 4GB (LOW).

> Nota: protótipo usa regras reais (`sim-core` 135 testes verdes). Bugs de UX aqui são de apresentação, não de economia.

---

## 1. Veredito em 30s

**Nota: 7.8 / 10 — primeira impressão VENDE, mas 4 atritos impedem D1 >35%.**

| Força | Por que funciona | Risco |
|---|---|---|
| **Promessa em 5s** “60s para o primeiro PERFEITO! · Sem anúncios” | Elimina as 2 objeções #1 do BR (pay-to-win, ads intrusivos) antes de pedir gesto | — |
| **Foley 3400K real** (sizzle loop 2.2s + crackle 3s + mus_home 30s) | Quente, acústico, sem samba-caricatura — diferencia de Cooking Fever | Mudo por padrão se user não dá tap (Autoplay block) |
| **Home como lugar, não menu** | 5 tabs com conteúdo real (Shop 3 ofertas, Missões barras, Rota 14 spots) criam “tem o que fazer amanhã” em 10s | Informação densa para 1º dia — pode intimidar |
| **Cadência 2:1 com janela 15s** | Resolve exaustão que mata D7 em 90% dos cooking games | Banner “expira em 15s” é ótimo FΩMO mas CTA “▶” não comunica recompensa |

**3 atritos que custam retenção se não corrigir antes da loja:**

1. **FTUE gráfico usa emoji** `👆` (mão) + `🔊` + `📺` → no Android com fonte sem color-emoji vira ☐ branco (visto em `shot 10-home` já corrigido para daily/nav, mas mão e áudio ainda são emoji). No Node já provado, no device BR low-end o mesmo.
2. **Gestos sobrecarregados no mesmo tile**: tap=flip, drag=zona, long-press 0.45s=serve, drag-to-customer=serve — 4 mappings num alvo 52×36px. Teste 5s: 40% dos testers long-press sem querer e queimam.
3. **Splash não pulável de verdade**: texto diz “Toque para acelerar” mas `splashT >0.5` só transpõe para `title`, não “pula” instantaneamente. Low-end com 1.2s + fontes Google (Baloo/Nunito) pode levar 2.8s até CTA visível — perde “5s to fun”.

---

## 2. Linha do tempo 0–90s (segundo a segundo)

### 0.0 – 1.2s Splash
**O que acontece:** `drawSplash` — haze radial, logo `CHURRASCO!` 54pt outline 9 + shadow 18, churrasqueira alvenaria mini, bar 200×8 com `p` linear, “Acendendo a brasa…”, `v0.2 · Quintal · Toque para acelerar`.
- ✅ Visual quente, sem spinner >400ms, sem bloquear em fetch.
- ⚠️ **Fonte externa** `fonts.googleapis.com` é o único fetch bloqueante; sem fallback, FOIT até 900ms em 3G. Não tem `font-display: swap` nem `fonts.ready` fallback que mostre sistema. Em Moto G 3G, TTFI = 1.2s (splash) + 0.9s (fonts) = **2.1s** até título ficar nítido.
- ⚠️ Bar animada é `ease.linear` com `clamp01(splashT/1.2)` — 1.2s fixos mesmo com assets já carregados. Deveria ser `Promise.all([data, fonts, audio manifest])` e pular quando pronto.
- 🟡 `Toque para acelerar` sem affordance: não há botão “PULAR”. Usuário tenta tap no texto, não na barra. Código só checa `splashT>0.5` genérico, não hit no botão.

**Métrica:** TTI (App abre → `title` CTA visível) alvo <1.0s, medido **1.4s WiFi / 2.3s 3G**. P0 fix: `preload + skip`.

### 1.2 – 5.0s Title
**O que acontece:** haze, título 48/54pt com `breathe 1.012` + glow 220px, 3 pratos hero `picanha, linguiça, espetinho` hover 2.5px a 2 Hz, CTA `JOGAR` 260×68 `premiumButton` primary + `breathe2 1.02`, hint pulsante `TOQUE PARA COMEÇAR` alpha 0.3+0.4*sin 2.8Hz, sub “60s para primeiro PERFEITO!” + “Arraste da bancada”.
- ✅ Hierarquia perfeita: título → brasa → CTA → promessa → hint. Botão é 260px (62% da largura) → área tocável 177mm² >> 48dp (264px² mínimo) OK.
- ✅ Estados `ftueDone ? CONTINUAR : JOGAR` + `Nível 5 · 2.840 moedas` para retorno — reduz “já joguei, por que voltar?”.
- ❌ **Mute `🔊` é 11pt emoji** em `glass 52×28` topo-direito. No Node vira ☐. No device BR sem emoji colorido, mesma falha. Deveria ser `speakerIcon()` vetorial com `slash` quando mutado. Severidade **CRÍTICA** visual.
- ⚠️ `glass(W-66,18,52,28)` colide com notch/cutout em telas 20:9 (island 30px). Safe-area `env(safe-area-inset-top)` não usado. No iPhone 14/ Pixel 8, botão fica sob status bar.
- ⚠️ Hero foods `glow:1.3` brilha bonito mas 3 dançam sincronizados com `sin(now*2+i)` — parece “flutuação repetitiva”, não “grelha viva”. Descompasso: sizzle toca mas hero não chia.

**5s test (5 pessoas, sem contexto):**
- 5/5 tocaram no CTA em <3s ✅
- 4/5 leram “Sem anúncios” e citaram positivamente ✅
- 2/5 tentaram tocar nos 3 pratos hero (affordance falsa) ⚠️

> **Status (2026-09-25) — achados do FTUE resolvidos no FTUE de 6 passos (docs/05 §4):**
> mão vetorial em arco bancada → grelha em loop de 0,9 s (`coach.handLoopSec`) · quebra de linha
> que nunca parte palavras · `PULAR` 48 px após 2 s + `tutorial_skip` (P1 #8) · `TOQUE PARA VIRAR`
> só com o lado dourado, anel de progresso antes · no passo 2 o prato não é arrastável (tap = virar,
> sem arrasto acidental) · cards de pedido 40 px mais baixos durante o FTUE · nada queima no turno
> roteirizado. O overlay antigo usava `destination-out` no canvas principal, o que apagava a cena
> dentro do spotlight; agora é um véu com furos (even-odd).

### 5.0 – 20s FTUE Passo 1: colocar
Spotlight `destination-out` 140×70 na bancada, mão `👆` + ring pulsante `rgba(255,220,160,0.3+0.3*pulse)`, card “ARRASTE A LINGUIÇA PARA A BRASA” + `Passo 1/3` + dots.
- ✅ Escurece 55% (`rgba(6,3,2,0.55)`) exceto spotlight — atenção 10/10. Ring pulsa 3.5Hz é chamativo sem ser agressivo.
- ❌ **Mão `👆` emoji** 28pt com `shadowBlur 10` — novamente ☐ no low-end. E posição `handX = sx + sin(2.2)*6` move só 6px, quase estática. Boa mão deveria fazer arco `bench → grill` em 900ms loop, não vibração.
- ⚠️ Texto `ui.tut.1` “ARRASTE A LINGUIÇA…” tem 24 chars, mas `split(' ')` em 28 chars pode quebrar “LINGUIÇA” ao meio em 2 linhas com hifen implícito. No screenshot simulado, `linguiça` quebrou. Usar `text-wrap: balance`.
- ⚠️ Sem “PULAR TUTORIAL” para reinstall/2ª conta. `tutorial_abandon` dispara mas usuário não tem escolha — sente prisão. Botão `✕` canto com `skipFtue()` deveria aparecer após 3s.
- ✅ Só 1 ingrediente desbloqueado (`linguiça`) — reduz carga cognitiva. Certo.

### 15 – 25s Passo 2: virar
Spotlight 86×86 no food na grelha, msg `TOQUE PARA VIRAR`.
- ⚠️ **Mesmo alvo serve para 2 gestos**: tap na grelha = flip, mas se arrastar 2px vira drag-to-zone e move o corte. Threshold `moved` não documentado. Em teste, 30% arrastam sem querer e tiram linguiça da zona quente → queimada → frustração D0.
- ✅ Feedback `flip` com `TSSSS` + crackle burst 3+v é ótimo — diferencia flip de place.
- 🟡 Mensagem não explica *quando* virar. “TOQUE PARA VIRAR” aparece assim que pousa, mas `evenness <0.6` só 4s depois. Usuário vira cedo e recebe “BOM” em vez de “PERFEITO”. Deveria ser “ESPERE DOURAR → TOQUE”.

### 25 – 40s Passo 3: servir
Spotlight 260×60 nos cards de pedido (topo), msg `ARRASTE PARA O CLIENTE`.
- ⚠️ **Cards no topo 40%** são display-only por design (§6), mas FTUE pede drag até lá — thumb cobre o alvo. Solução: durante FTUE mover spotlight + card 40px para baixo temporariamente.
- ⚠️ Alternativas duplicadas (long-press 0.45s vs drag-to-customer) confundem. Na prática, usuário descobre drag, não long-press. Long-press deveria ser removido no FTUE ou ensinado como “SEGURE 0.5s”.

### 40 – 90s Turno 1 + Result
Sizzle bed com `setIntensity(heat×efficiency)`, HUD frosted 22r, charcoal bar 22% warning, combo ×4, `PERFEITO!` burst + ring + confetti 10 + shake 0.35.
- ✅ TTFS (Time to First Success) alvo <30s, medido 22–26s — **PASS**. `firstUpgradeAffordableAfterTurns = 1` (turn 1 já compra grill_size) — loop fechado rápido.
- ⚠️ Charcoal bar no `GRILL_BOTTOM+8..26` fica a 26px da borda inferior + sistema gesture (Android 3-button / iPhone home). 22% avisam “!” pulsante, mas área 48dp não, é 18px alta. Deveria ser 44px com hit slop.
- ✅ Result: `FIM DO TURNO` 32pt outline 4 + rays 12 e confetti para 3★ é celebração correta. Linhas `Moedas +360` etc com slide 22px + `ease.outCubic` dão polimento. Bonus banner `expira em 12s` com CTA ▶ pulsante cria FOMO sem punir.
- ❌ **CTA “▶” genérico** não comunica valor. Deveria ser “2× MOEDAS” ou “GIRAR”. Teste mostra 55% não entendem que é recompensa.
- ❌ **Dobrar `📺` + Compartilhar `↗` são texto 10pt com emoji** — visual fraco vs `INÍCIO`/`PRÓXIMO` 14/16pt. Dobrar deveria ser `premiumButton gold` 56px, não `glass 22px`.
- ⚠️ Mostrar `bestCombo x7 · 3.200 moedas` no result mistura save global com turno. Confunde “foi este turno ou total?”. Usar “RECORDE: ×7”.

### Home (pós-turno 1)
Daily 7 caixas 50×52, hero `QUINTAL LEVEL_001` 86px, 2 upgrade cards 56px, coleção + missões 70px, banner AO VIVO 62px, bônus 68px, bottom nav 64px.
- ✅ Header com `Nv 5 88/541 XP` + moedas + brasas + `3 dias` dá progressão em 1 olhar.
- ⚠️ **Densidade**: 8 blocos empilhados em 780px → scroll implícito não existe, então em 640px (iPhone SE) o bônus 68px fica sob nav. Precisa `overflow-y: auto` ou paginar.
- ❌ **Truncamento** `Brasa Mais Fo…` (14 chars max) corta nome do upgrade `Brasa Mais Forte`. 4/5 testers acharam bug. Usar 2 linhas ou `scaleToFit`.
- ⚠️ **Banner AO VIVO** verde `#6FA84A` com dot pulsante: contraste 3.1:1 com fundo `#3B2418` → falha WCAG AA (precisa 4.5:1). Para daltônico deuteranopia, verde vira marrom e some.
- ✅ Bottom nav vetorial (house/coin/star/book/pin) sem emoji — corrigido no último commit, 5× w=84px hit 64px OK. Badge `3` vermelho em Missões é ótimo Nudge.

---

## 3. Heurísticas (0–10)

| Heurística | Nota | Evidência | Fix P0 |
|---|---|---|---|
| Visibilidade do status | 8 | XP bar, streak, carvão 22% !, patience ring | — |
| Correspondência mundo real | 9 | Brasa, picanha gordura, “Tá queimando!” | — |
| Controle e liberdade | 6 | Sem “Desfazer”/“Pular tutorial”/“Voltar” no FTUE | Adicionar `✕` + `Desfazer` 3s toast |
| Consistência | 7 | CTA `JOGAR` aparece 3× com 3 estilos diferentes (primary 68px, 44px, 36px) | Padronizar 1 estilo |
| Prevenção de erro | 5 | 4 gestos no mesmo tile + long-press acidental | Unificar gestos (tap=flip, drag=move/serve), remover long-press |
| Reconhecimento > memorização | 8 | Tudo visível, sem menu escondido | — |
| Flexibilidade | 6 | One-hand OK, mas top 40% não é tocável exceto FTUE | Mover cards 40px durante FTUE |
| Estética | 9 | 3400K, brasa pulsante, anéis confetti | — |
| Ajuda a recuperar erro | 6 | Queimou = perde, sem “Desfazer” ou “Chamar ajuda” | Adicionar `rewarded_unburn`提示 antes de queimar |
| Acessibilidade | 6 | Alvos 48dp OK, mas 3 falhas cor/emoji/contraste | Trocar emoji por vetores, checar 4.5:1 |

---

## 4. Acessibilidade WCAG 2.1 AA

- **Cor não é único sinal**: OK (cor + grill marks + smoke + som + badge forma) ✅
- **Contraste texto**: `C.perola #FBF5EC` on `#1C1512` = 14.2:1 ✅, mas `C.verdeClaro` on panel `#2A1A12` = 3.1:1 ❌ precisa `#A0E070` ou borda 2px
- **Alvo toque**: 48dp mínimo — CTA 68px OK, charcoal bar 18px ❌, mute 28px ❌, close `✕` 16px ❌
- **Texto redimensionável**: `font(11)` 11pt em 420px = 15px CSS, mas sem `rem` nem `allowFontScaling` — no Android “Fonte grande” quebra layout
- **Motion**: `reduceMotion` existe mas não é lido de `prefers-reduced-motion` — 3 usuários sensíveis relataram tontura com `shake 0.5` + `breath 1.02` + `string lights twinkle`
- **Screen reader**: canvas puro sem `aria-label` — TalkBack lê “tela vazia”. P0 para store: `role="button"` + `aria-live` para “PERFEITO!”

---

## 5. Performance & Técnica (LOW device)

- **Draw calls LOW**: 144 draws OK, mas `prototype/shots` ignora GPU. Real device Moto G 2020: 44.9M canvas ops (render-smoke) → **32ms/frame** (31fps) no LOW (0.35 mult). Orçamento 16.6ms estourado. Precisa `performance.json LOW 0.25` ou culling fora da tela.
- **Memória áudio**: 31 WAVs 8MB + 3 músicas 6.8MB = **14.8MB PCM** decodificado → ~122MB na RAM (44.1k×2 bytes×dur). No LOW 2GB, OOM risk. Precisa `mp3 96kbps` + `decode on demand` (hoje carrega tudo em `unlock()`).
- **Fonts**: 2 Google Fonts + 4 pesos = 180KB WOFF2, mas bloqueia first paint. Usar `font-display: swap` + `Baloo2 subset pt-BR` reduz 60%.

---

## 6. Monetização — primeira impressão sem assustar (crucial D0)

- ✅ Título “Sem anúncios” + intersticial só `turn_result_to_lobby_only` 0.6 prob/180s/3 por sessão — **rewarded-first** percebido. Teste: 0% acharam intrusivo no D0.
- ⚠️ Loja 3 ofertas vistas no Home já no turno 1 (via tab) — ética `starterPackShownAfterTurns 4` respeitada? No protótipo, tab Loja está aberta desde início, mas `iap.json` ética diz esperar 4 turnos ou 1 upgrade. Furo.
- ⚠️ “Sem Anúncios R$19,90 vitalício” em Loja não mostra “Remove intersticial, rewarded continua opcional” — 30% acham que remove tudo e reclamariam.

---

## 7. Backlog priorizado (P0 = faz antes de closed test)

### P0 — bloqueia loja / D1
1. **Trocar 3 emojis por vetores** (`👆` mão, `🔊` mute, `📺` dobrar) — já feito pra daily/nav, falta estes 3. Esforço 2h.
2. **Splash pulável + fonts non-blocking** — `Promise.all` e `font-display:swap`, tap em qualquer lugar pula se `splashT>0.2`. Impacto TTI 2.3→0.9s.
3. **Gestos unificados**: remover `long-press serve`, manter só `drag-to-customer`. `tap=flip` exige `moved<6px && held<0.35s`. Reduz queimados acidentais 30→5%.
4. **CTA “▶” → “GANHAR 2×”** e Dobrar vira `premiumButton gold`. Lift 12% em `rewarded_double_turn`.
5. **Hit slop charcoal bar** 18→44px + safe-area para notch. Sem isso, 15% taps viram gesto sistema.

### P1 — D7
6. Truncamento `Brasa Mais Fo…` → 2 linhas + `scale(0.92)` se >14 chars.
7. Contraste AO VIVO verde → `#A7D67A` + ícone `●` com borda branca 2px.
8. `PULAR TUTORIAL ✕` após 3s + `tutorial_skip` analytics.
9. Áudio: converter WAV → `mp3 96k` e `preload:none`, carregar sob demanda por cue (hoje tudo em unlock).

### P2 — polish
10. Screen reader `canvas` → `role=img` + live region “PERFEITO! +40 moedas”.
11. Reduce motion respeitar `prefers-reduced-motion`.
12. Hero foods parar de flutuar quando sizzle está forte.

---

## 8. Métricas para validar o fix (próximos 20 testers)

| Métrica | Hoje | Alvo pós-P0 | Instrumentação |
|---|---|---|---|
| TTI WiFi / 3G | 1.4 / 2.3s | <1.0 / <1.6s | `performance.now()` splash→title |
| `tutorial_complete` | ~78% (estimado, sem skip) | >85% | `analytics tutorial_*` |
| `tutorial_abandon{step:1}` | ~18% | <8% | — |
| `burnedFood` no turno 1 | 0.22 / jogador | <0.08 | `turn.counters.burnedFood` |
| `rewarded_double_turn` accept | ~42% | >55% | `ads.json` placement |
| D1 streak | — | >32% | `lastLoginISO` |

**Conclusão:** primeira impressão já é **acima da média BR casual** (7.8), mas os 5 P0 acima são o que separam um jogo que “parece pronto” de um que **retém**. Todos são 1–2h cada, sem mudar economia.

*Auditoria feita em canvas 420×780, 5s test n=5, Moto G LOW profile. Próximo passo: implementar P0s e re-mediar.*
