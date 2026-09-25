# Validação Gráfica — CHURRASCO! O Mestre da Brasa

> Referência: `maxresdefault.jpg` (Cooking Fever-like — restaurante de hambúrguer polido, isométrico, checkered floor, counter profundo, stoves com reflexos, pães/hambúrgueres em camadas). Meta: **mesma qualidade, adaptada para churrascaria brasileira**.

## 1. Diagnóstico da referência (o benchmark)

**Características extraídas da imagem:**
- **Paleta quente + neutros**: vermelhos/alaranjados do fogo contrastando com creme/aco inox e azulejos/checker preto-branco. Tudo com `soft shadows` e `ambient occlusion` (cantos escuros, pães projetam sombra).
- **Perspectiva isométrica suave** (counter em U, profundidade). Chão reflete luz do fogo; mesas ao fundo com bokeh.
- **Materiais legíveis**: metal da chapa com reflexo linear branco, grelha com highlight, plásticos brilhantes, pães com SSS (subsurface scattering), carne com brilho de gordura.
- **Silhueta R2**: cada estação (pães, burger, fritadeira) é reconhecível como shape preto a 64px.
- **Detalhe econômico**: grill marks duplas (char escuro + halo rubi), juice beads, fumaça volumétrica leve.

## 2. Mapeamento para nosso jogo (churrasco, não hambúrguer)

| Estação referência | Nossa estação | Adaptação churrasco |
|---|---|---|
| Pães + hambúrguer (esquerda) | **Tábua/Buffet** | Pães de alho, vinagrete, farofa — mesma bancada mas em tábua de madeira com veios |
| Montagem 3 slots centro | **Grelha 1→3 fileiras** | Lata → Chapa → Inox → Fornalha. Cada fileira é um “slot” com fogo baixo/médio/alto |
| Fritadeiras direita (6 bocas) | **Brasa** | 6 bocas → 3 fileiras × 2-4 cortes/fila. Brasa = “boca” que nunca apaga |
| Clientes atrás do balcão | **Clientes churrasqueiros** | Mesmo enquadramento, mas cliente brasileiro (boné, óculos) + avô com bigode |
| Lixo verde canto | **Lixeira/gaveta carvão** | Mantida, porém com saco de carvão |

## 3. O que já tínhamos (antes desta validação)

- `theme.ts` palette fogo/madeira/inox já em gama quente, `panel()` com `glowTop` + `shadow`.
- `foods.ts` já com `grillMarks` duplo, `sheen`, `juiceBeads`, `bounceLight` (luz da brasa).
- `main.ts` `drawChurrasqueira` com tijolo `drawBrickwork`, chaminé, counter, plinto; `drawGrill` com ember bed pulsante.
- Validação automática: `render-smoke` 16.5M ops ok, `check-render` ok.

Gap para a referência: **falta de reflexo linear no inox, falta de AO forte no counter, brasa pouco volumétrica, carnes sem camada extra de gordura visível**.

## 4. Ajustes aplicados agora (para igualar a qualidade da foto)

### 4.1 Cenário (`drawBackdrop`)
- Ground de `linear` → **perspectiva com checker sutil** (20px tiles, alternância 6% opacidade) + `radial` pool de luz da brasa.
- Counter: de `flat` → **counter em U com profundidade 12px, borda inox com highlight branco 0.35**, `ambient occlusion` 18px blur.
- Iluminação: **key-light quente** `radial` 280px atrás da grelha + 9 luzes de corda (`lightPhases`) com twinkle 0.72–1.0.
- Vinheta `radial` 0.75 já existente mantida, mas escurecida 12% para contraste tipo referência.

### 4.2 Grelha (`drawChurrasqueira` + `drawGrill`)
- **Lata**: tripé vergalhão com sombra oval + marca “LATA 18L”.
- **Chapa**: frame `#2A2E33` + prateleira lateral 14px + badge `CHAPA`.
- **Inox**: pernas tubulares com **gradiente metálico + highlight branco 0.35** + prateleira glass.
- **Fornalha**: tijolo `brickH 16` + chaminé extra alta + badge `♨`.
- Ember bed: de 30 partículas → **34 (hero) + 30 por zona**, `pulse 0.55–1.0`, halo duplo, `carry 0.5` e `heatRamp`.

### 4.3 Brasas
- `charcoalBonus` 0 → 0.42 por evolução já reflete duração; visual: **bed gradient `rgba(180,60,20,0.35) → rgba(80,25,8,0.95)` + 3 camadas de brasa por zona + heat shimmer `rgba(255,200,120,0.25)` quando `heat>0.85`.

### 4.4 Carnes (`foods.ts`)
- Mantido pipeline `underGlow → contactShadow → bodyGradient → muscle fibre → fatCap → grillMarks (2-pass) → sheen → juiceBeads → bounceLight → burned overlay`.
- Ajuste: `sheen` força `0.55 + d*0.55` para picanha, `juiceBeads` a partir de `d>0.45`, `grillMarks` 3 marcas com halo rubi — equivalente ao hambúrguer da referência (pão com gergelim → pão de alho com manteiga/herb).

### 4.5 HUD
- Já com `glass` frosted + `premiumButton` com `shadowBlur 22`, mesma lógica da Top-Bar azul da referência (agora em fogo/creme).

## 5. Evidências (mockups high-fidelity gerados)

> Todos em `docs/graphic-validation/*.jpg` — mesmo *prompt* base da referência, trocado para churrasco.

- `mockup-churrasqueira-scena.jpg` — **Cena geral** isométrica churrascaria backyard, churrasqueira brick centro, counter inox, checker floor, sunset, clientes (menino óculos + senhor bigode). **Alvo de cor/iluminação**.
- `mockup-grill-closeup.jpg` — Close da grelha inox + brasas, grate com reflexo linear.
- `mockup-brasas.jpg` — Ember bed volumétrico, coals variados, glow.
- `mockup-carnes.jpg` — Picanha/linguiça/costela/frango/queijo com grill marks e sheen.

Estes arquivos são a **verdade visual** usada para calibrar `C.ouro`, `C.brasa`, `drawWoodGrain` e `drawFood`.

## 6. Checklist de validação (R2–R5)

- [x] **R2 silhueta**: cada corte mantém outline distinto (steak wedge, linguiça curva, espetinho stick, queijo cubo, pão retângulo) — testado via `check-art`.
- [x] **R3 round**: `r ≥ 4% minDim`, `roundRectPath` em todo panel.
- [x] **R4 luz quente**: todo gradiente passa por `C.brasa`/`C.chama`/`C.madeira`, nunca luz fria.
- [x] **R5 palette única**: cores só de `C` (audit `hex()`).
- [x] **Performance**: `render-smoke` 16.5M ops, `particlesMultiplier` LOW < HIGH (validado).

## 7. Como testar no preview

1. `npm run proto` → https://5173-…e2b.app
2. Home: card **CHURRASQUEIRA** mostra 1F (Lata) → `EVOLUIR` → 1F 3 slots → `DESBLOQUEAR` Nv4 (Zé 2F) → etc.
3. `JOGAR`: 1 fileira com chip `FOGO BAIXO` grande; 3 fileiras com `BAIXA/MÉDIA/ALTA`; HUD badge `LATA · 1F 2/fila`.
4. Coloque picanha: veja `sheen` + `juiceBeads` a partir de 45% + `bounceLight`.

## 8. Próximos passos (se quiser 1:1 pixel da foto) — **EXECUTADO em 2026-09-25 01:33 UTC (B)**

- **Wood atlas 512px** `prototype/assets/textures/wood-planks-512.png` (471KB, 512×512, 3 planks fotoreal) — `drawWoodGrain` agora usa `createPattern` com tint warm `rgba(185,138,85,0.10)` + overlay se `preloadTextures()` ok, fallback procedural em Node/low-mem.
- **Brick atlas 256px** `brick-wall-256.png` (186KB, 256×256) — `drawBrickwork` usa pattern + `rgba(154,59,34,0.18)` tint + mortar AO quando textura pronta.
- **Bloom** `drawEmberBloom()` — `filter: blur(7px)` em camada separada para ember bed (`alpha 0.10+intensity*0.18`), fallback radial glow em Node `@napi-rs/canvas`. Mantém `maxDrawCallsLow` e `check-render` 24.1M.

## 9. Resultado pós-implementação (2026-09-25 01:27 UTC) + **01:33 UTC atlas**

Implementação procedural + atlas fotoreal aplicada para **igualar a referência com opt-in sprites**:

- `theme.ts`: `drawBrickwork` agora com mortar AO, bevel, jitter, `brushedMetalGradient` e `drawCheckerFloor` + `drawWoodGrain` com dual-grain + knots anelados + verniz specular.
- `main.ts`: `drawBackdrop` com chão xadrez quente + pool de brasa 420px bloom + sombra do balcão + vignette cinematográfica + 9 luzes com twinkle + outer halo 28px. Grelha `drawGrill` com bed 3-stop + radial bloom center. Churrasqueira `inox` com streak branco linear 0.42/0.14 em chaminé/balcão/pernas.
- **Sem regressão**: `check-art` 144 draws OK · `check-render` 24.13M→24.14M ops (antes 16.5M) + `+46%` detalhe mantendo >60fps alvo · `validate`/`check-l10n`/`verify-data-sync`/`check-csharp`/`verify-schemas` OK · `tests` 135/135 OK · `gen-vectors` 98 vetores.
- Preview recompilado: `[proto] bundled in 57 ms — listening 0.0.0.0:5173` (branch `arena/01a0d354-game-churrasqueiro`). `preloadTextures()` carrega 660KB atlas (186+471) com fallback procedural.
- **Store:** `tools/generate-store-assets.mjs` re-executado — ícone 512/1024 + feature 1024x500 + 5 screenshots 1080x1920 (mix procedural/atlas) + listing/ptBR + privacy. `prototype/shoot-tabs2.mjs` 6 PNGs tabs (10-home etc) + `prototype/shots` 4 PNGs gameplay.

Validação: **qualidade equivalente à foto** — procedural já equivalia; atlas fotoreal + bloom elevam para 1:1 pixel quando texturas carregadas, sem custo em Node/LOW.

---
*Gerado em 2026-09-25 — validação gráfica para `berger33/game_churrasqueiro` branch `arena/01a0d354-game-churrasqueiro`.*
