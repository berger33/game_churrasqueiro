# Lote 03 — prompts (texto exato, gravado antes da geração)

Data: 2026-09-25 · ferramenta: `generate_image`, 10 chamadas · saída: `art/source/lote-03/`
(fora do git; brutos são descartáveis, ver `docs/22-ARTE_2D_PLANO.md` §8).

**Por que este conteúdo.** Ordem pela primeira aparição no jogo, conforme a auditoria em
`docs/22` §2:

- ícones de interface (moeda, brasa, estrela, relógio…) desde o primeiro minuto;
- ícone de "Brasa Mais Forte" no passo 6 do FTUE;
- chapa no nível 4, inox no 8 e fornalha no 14;
- Espetinho de Rua no 8, Trailer no 16 e Churrascaria de Bairro no 24;
- contra-filé no 22 e maminha no 26.

**Referências:**

- `art/source/refs/ref_food_picanha.png`, de `make-ref.mjs grid … spr_food_picanha_*`, guia o estilo das comidas e dos ícones;
- `art/source/refs/ref_bg_quintal.png`, cópia do master aprovado `bg_restaurant_quintal`, guia os fundos;
- as churrasqueiras novas vão **sem referência**, para não herdar a câmera oblíqua da lata.

Blocos **[STYLE]**, **[FOOD6]**, **[TECH]** e **[REF_FOOD: x]**: idênticos a `art/prompts/lote-02.md`.

**[ICONS9]**
> Square 1:1 icon sheet with exactly 9 game UI icons in 3 columns and 3 rows, read left to right, top to bottom; one icon per cell, each fully inside its cell and centred, all at the same scale. Bold, chunky, instantly readable silhouettes that still read at 32 pixels; soft 3D volume, glossy highlights, thick dark-brown outline; no background plates, no frames, no badges behind the icons.

**[GRILL_FRONT]**
> Camera: high three-quarter view from the front and above (about 60 degrees), perfectly symmetrical, so the rectangular cooking opening faces the viewer as one large horizontal rectangle about 1.4 times wider than tall, with its top edge perfectly horizontal. The opening is left empty so the flat magenta background shows through it: no grate, no coals, no food inside. Keep any chimney short. Wide 16:9 image, one single object, centred.

**[BG]**
> Vertical 9:16 mobile game background, painted in exactly the same style, warmth and level of detail as the reference image, but a different place. No people, no animals, no text, no letters, no readable signs, no logos. Keep the middle third of the image calm and uncluttered, because the game draws the grill there; a clear floor area in the bottom third for the prep counter.

## Imagens

### 1 · `ui_icons_core.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: the core interface icons of the game. [ICONS9] 1: a shiny gold coin with an embossed flame emblem. 2: a glowing ember gem, a faceted orange-red crystal shaped like a flame (the premium currency). 3: a plump gold star. 4: a round brass kitchen timer. 5: a lively orange fire flame. 6: a thick rounded green check mark. 7: a small wooden treasure chest with gold trim and a keyhole. 8: a small glass bottle holding a golden lightning bolt (a booster). 9: a chunky brass padlock. Use the reference image only as the guide for painting style, outline and lighting; do NOT draw any food. [TECH]

### 2 · `ui_icons_upgrades_a.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: upgrade icons for the grill and the kitchen. [ICONS9] 1: a wide barbecue grill grate with a bold upward arrow (bigger grill). 2: a large glowing charcoal ember with strong flames (stronger heat). 3: a sturdy grill grate resting on a solid anvil-like base (stable grill). 4: a steady even flame inside a circular gauge (constant heat). 5: a burlap sack of charcoal with a small hourglass (longer-lasting charcoal). 6: a premium charcoal lump with a gold sparkle (premium charcoal). 7: a metal chimney charcoal starter with little flames coming out (automatic lighter). 8: a sharp chef's knife with a glint on the blade (sharp knife). 9: a small cork order board with three pinned paper tickets covered in abstract squiggles instead of writing (order board). Use the reference image only as the guide for painting style, outline and lighting; do NOT draw any food. [TECH]

### 3 · `grill_ze_da_esquina_evo1.png` (sem referência)
[STYLE] Subject: "Grelha do Zé da Esquina", a humble but proud Brazilian street-corner commercial charcoal grill: a long rectangular box grill of dark, well-seasoned, slightly greasy black steel on a sturdy wheeled metal cart frame, with a small side shelf, a short chimney at the back left corner and honest wear. [GRILL_FRONT] [TECH]

### 4 · `grill_parrilla_chef_cisma_evo1.png` (sem referência)
[STYLE] Subject: "Parrilla do Chef Cisma", an elegant chef's Argentine-style parrilla: a polished mirror-finish stainless-steel firebox reflecting warm golden light, on a neat red-brick base, with a stainless side shelf, a small round thermometer on the front panel and a short stainless chimney at the back left corner. [GRILL_FRONT] [TECH]

### 5 · `grill_fornalha_dragao_manso_evo1.png` (sem referência)
[STYLE] Subject: "Fornalha do Brasa Braba, o Dragão Manso", a big traditional Brazilian masonry barbecue built from dark red firebricks with mortar lines, a heavy stone counter lip and a short brick chimney at the back left corner topped with a small friendly wrought-iron dragon ornament. [GRILL_FRONT] [TECH]

### 6 · `bg_espetinho_rua.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: a Brazilian street corner at night with warm light: a skewer vendor's cart under a striped awning at one side, low plastic stools, a small folding table, a street lamp casting warm orange light, a cobblestone sidewalk and the silhouettes of houses. [BG]

### 7 · `bg_trailer.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: a food-trailer park at dusk with a warm neon glow: a vintage food trailer at one side with its service window open and a flat griddle inside, a wooden prep counter, folding tables and chairs, string lights, and a glowing neon sign shaped like a flame and a sausage without any letters. [BG]

### 8 · `bg_churrascaria_bairro.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: inside a cozy neighbourhood churrascaria in the evening: wooden dining tables and chairs, a long wooden service counter, wine racks along the wall, warm pendant lights, a stainless-steel grill hood in the background and a terracotta tile floor. [BG]

### 9 · `food_contra_file.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one contra-filé (strip loin steak), a thick rectangular steak with a thin, even band of fat along its top edge, lying horizontally. [FOOD6] Cell 6: SERVED, sliced into thick strips on a small round wooden board, with rosy pink juicy centres. Raw contra-filé is deep red with fine marbling. [REF_FOOD: contra-filé only, with a thin fat edge instead of the thick fat cap of the reference] [TECH]

### 10 · `food_maminha.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one maminha (tri-tip), a thick, boat-shaped triangular beef roast tapering to a point on the right, with a thin fat layer on one side, lying horizontally. [FOOD6] Cell 6: SERVED, sliced into fanned slices on a small round wooden board, with rosy pink juicy centres. Raw maminha is deep red. [REF_FOOD: maminha only, triangular, not the reference steak] [TECH]
