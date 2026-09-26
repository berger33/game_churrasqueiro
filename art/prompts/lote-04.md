# Lote 04 — prompts (texto exato, gravado antes da geração)

Data: 2026-09-25 · ferramenta: `generate_image`, 10 chamadas · saída: `art/source/lote-04/`
(fora do git; brutos são descartáveis, ver `docs/22-ARTE_2D_PLANO.md` §8).

**Por que este conteúdo.** O dono **rejeitou o lote 03 inteiro** (2026-09-25): "nada entra no
runtime; refazer o lote". Então o lote 04 é o **reprocessamento das mesmas 10 imagens**, com os
prompt corrigidos, e não o conteúdo que estava planejado para ele. O que ia no lote 04 (costela,
cupim, ícones 2/3 e 3/3, funcionários, fundos premium e festival) desce para o lote 05
(`docs/22` §6).

**As duas correções que este lote carrega:**

1. **Grelhas: guia de layout em vez de frase sobre a câmera** (§6.4). Os três brutos do lote 03
   saíram como *janelas frontais* — a boca com 5–9 % do sprite, inclinada ±9°, contra 21 % a
   −8,6° da lata aprovada. O modelo leu "a boca voltada para quem olha" ao pé da letra. Agora
   cada grelha recebe um guia desenhado por script (`make-ref.mjs guide`) com a silhueta e a boca
   já no lugar: ≥ 87 % da largura do objeto, topo perfeitamente horizontal, ~40 % do bbox. A
   ordem do prompt é *pintar dentro do guia*, não *inventar a composição*.
2. **Maminha distinguível do contra-filé.** Na prévia do lote 03 os dois bifes crus na bancada
   eram gêmeos (mesmo recorte, mesmo marmoreado, mesmo tamanho) — e reconhecer o pedido é o
   jogo. A maminha passa a ser pedida como cunha triangular larga num lado e fina no outro, com
   fibra longa visível e sem faixa de gordura; o contra-filé mantém o retângulo com a faixa fina.

**Referências:**

| Arquivo | Como foi feito | Serve para |
|---|---|---|
| `art/source/refs/ref_food_picanha.png` | `make-ref.mjs grid … 848 1264 2 3 spr_food_picanha_{raw,rare,medium,well,burned,served}` | comidas e ícones (estilo, célula, tamanho) |
| `art/source/refs/ref_bg_quintal.png` | cópia do master aprovado `bg_restaurant_quintal` | fundos |
| `art/source/refs/ref_customers.png` | `make-ref.mjs grid … 1376 768 4 2 spr_char_customer_*` | (reserva; nenhum item deste lote é gente) |
| `art/source/lote-04/guides/guide_cart.png` | `make-ref.mjs guide … 1408 768 cart` | chapa do Zé da Esquina |
| `art/source/lote-04/guides/guide_box.png` | `make-ref.mjs guide … 1408 768 box` | parrilla Chef Cisma |
| `art/source/lote-04/guides/guide_masonry.png` | `make-ref.mjs guide … 1408 768 masonry` | fornalha Dragão Manso |

Cada guia foi medido com o detector real antes de gerar
(`node tools/art/process-sprites.mjs art/source/lote-04/check-guides.json --dry-run`):
boca 1126–1197 px de largura, topo horizontal, 38–44 % do bbox do objeto.

Blocos **[STYLE]**, **[FOOD6]**, **[TECH]**, **[ICONS9]**, **[BG]** e **[REF_FOOD: x]**:
idênticos a `art/prompts/lote-02.md` e `art/prompts/lote-03.md`.

## Blocos

**[STYLE]**
> Premium 2D mobile game art for a Brazilian churrasco cooking game. Stylized semi-realistic hand-painted look with soft 3D volume, like top-grossing casual cooking games. Subtle dark-brown outline, rich saturated but natural colours, glossy highlights. Warm golden-hour key light from the upper left; no cold light.

**[FOOD6]**
> Portrait 2:3 sprite sheet with exactly 6 cells in 2 columns and 3 rows, read left to right, top to bottom; one item per cell, each fully inside its cell and centred. Camera: three-quarter top-down view at about 55 degrees, the item lying horizontally with its long axis left to right. Cells 1 to 5 show the SAME single piece with an identical shape, size and position; only the cooking changes: 1 RAW; 2 RARE, just seared, pale with faint first grill marks; 3 PERFECT, golden-brown crust, dark crisp grill marks, glistening juices; 4 WELL DONE, darker and drier; 5 BURNED, charred black with cracks and grey ash.

**[TECH]**
> The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no floor, no cast shadows, no grid lines, no cell borders, no frames. Items are separated only by empty magenta space; leave generous magenta space around every item. No letters, numbers, captions, labels or watermark anywhere in the image. Nothing in the artwork itself is magenta or hot pink (natural meat reds and pinks are fine).

**[ICONS9]**
> Square 1:1 icon sheet with exactly 9 game UI icons in 3 columns and 3 rows, read left to right, top to bottom; one icon per cell, each fully inside its cell and centred, all at the same scale. Bold, chunky, instantly readable silhouettes that still read at 32 pixels; soft 3D volume, glossy highlights, thick dark-brown outline; no background plates, no frames, no badges behind the icons.

**[BG]**
> Vertical 9:16 mobile game background, painted in exactly the same style, warmth and level of detail as the reference image, but a different place. No people, no animals, no text, no letters, no readable signs, no logos. Keep the middle third of the image calm and uncluttered, because the game draws the grill there; a clear floor area in the bottom third for the prep counter.

**[GRILL_GUIDE]** *(novo neste lote — substitui o [GRILL_FRONT] do lote 03)*
> The reference image is a layout guide, not artwork: a flat dark silhouette of the object with one bright magenta rectangle inside it, which is the cooking opening. Paint your object into exactly that composition: keep the silhouette's proportions, position and size, and keep the opening in exactly the same place, with exactly the same size and its top edge perfectly horizontal. The opening stays empty magenta: no grate, no coals, no ash, no food, no reflection covering it. Do not turn the object into a front-facing window or a wall opening, and do not shrink the opening. The object is seen from the front and above at about 55 degrees, so the opening reads as the wide top surface of the grill. Wide 16:9 image, one single object.

## Imagens

### 1 · `ui_icons_core.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: the core interface icons of the game. [ICONS9] 1: a shiny gold coin with an embossed flame emblem. 2: a glowing ember gem, a faceted orange-red crystal shaped like a flame (the premium currency). 3: a plump gold star. 4: a round brass kitchen timer. 5: a lively orange fire flame. 6: a thick rounded green check mark. 7: a small wooden treasure chest with gold trim and a keyhole. 8: a small glass bottle holding a golden lightning bolt (a booster). 9: a chunky brass padlock. Use the reference image only as the guide for painting style, outline and lighting; do NOT draw any food. [TECH]

### 2 · `ui_icons_upgrades_a.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: upgrade icons for the grill and the kitchen. [ICONS9] 1: a wide barbecue grill grate with a bold upward arrow (bigger grill). 2: a large glowing charcoal ember with strong flames (stronger heat). 3: a sturdy grill grate resting on a solid anvil-like base (stable grill). 4: a steady even flame inside a circular gauge (constant heat). 5: a burlap sack of charcoal with a small hourglass (longer-lasting charcoal). 6: a premium charcoal lump with a gold sparkle (premium charcoal). 7: a metal chimney charcoal starter with little flames coming out (automatic lighter). 8: a sharp chef's knife with a glint on the blade (sharp knife). 9: a small cork order board with three pinned paper tickets covered in abstract squiggles instead of writing (order board). Use the reference image only as the guide for painting style, outline and lighting; do NOT draw any food. [TECH]

### 3 · `grill_ze_da_esquina_evo1.png` (ref: `guides/guide_cart.png`)
[STYLE] Subject: "Grelha do Zé da Esquina", a humble but proud Brazilian street-corner charcoal grill: a long rectangular box grill of dark, well-seasoned, slightly greasy black steel on a sturdy wheeled metal cart frame, with a small side shelf, a short chimney at the back left corner and honest wear. [GRILL_GUIDE] [TECH]

### 4 · `grill_parrilla_chef_cisma_evo1.png` (ref: `guides/guide_box.png`)
[STYLE] Subject: "Parrilla do Chef Cisma", an elegant chef's Argentine-style parrilla: a polished mirror-finish stainless-steel firebox reflecting warm golden light, on neat legs, with a stainless side shelf, a small round thermometer on the front panel and a short stainless chimney at the back left corner. [GRILL_GUIDE] [TECH]

### 5 · `grill_fornalha_dragao_manso_evo1.png` (ref: `guides/guide_masonry.png`)
[STYLE] Subject: "Fornalha do Brasa Braba, o Dragão Manso", a big traditional Brazilian masonry barbecue built from dark red firebricks with mortar lines, a heavy stone counter lip and a short brick chimney at the back left corner topped with a small friendly wrought-iron dragon ornament. [GRILL_GUIDE] [TECH]

### 6 · `bg_espetinho_rua.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: a Brazilian street corner at night with warm light: a skewer vendor's cart under a striped awning at one side, low plastic stools, a small folding table, a street lamp casting warm orange light, a cobblestone sidewalk and the silhouettes of houses. [BG]

### 7 · `bg_trailer.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: a food-trailer park at dusk with a warm neon glow: a vintage food trailer at one side with its service window open and a flat griddle inside, a wooden prep counter, folding tables and chairs, string lights, and a glowing neon sign shaped like a flame and a sausage without any letters. [BG]

### 8 · `bg_churrascaria_bairro.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: inside a cozy neighbourhood churrascaria in the evening: wooden dining tables and chairs, a long wooden service counter, wine racks along the wall, warm pendant lights, a stainless-steel grill hood in the background and a terracotta tile floor. [BG]

### 9 · `food_contra_file.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one contra-filé (strip loin steak): a thick, flat-topped RECTANGULAR steak with straight sides and a thin, even band of white fat running along its top long edge, lying horizontally. [FOOD6] Cell 6: SERVED, sliced into thick strips on a small round wooden board, with rosy pink juicy centres. Raw contra-filé is deep red with fine marbling. [REF_FOOD: a rectangular strip-loin steak with a thin fat edge only; do NOT copy the wedge shape or the thick fat cap of the reference] [TECH]

### 10 · `food_maminha.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one maminha (tri-tip): a THICK WEDGE-shaped steak, clearly triangular in outline — broad and blunt at the left end, tapering to a narrow point at the right end — with a coarse long grain running along its length and NO fat band on top, lying horizontally. [FOOD6] Cell 6: SERVED, sliced against the grain into overlapping fan-shaped slices on a small round wooden board, wide slices at one end and short ones at the other, with rosy pink juicy centres. Raw maminha is a deeper, darker red than a strip loin, with visible coarse fibres. [REF_FOOD: a triangular wedge steak only; the shape must be obviously different from a rectangular strip loin] [TECH]

---

## Reforço (roda no lote 05, prompts já gravados aqui)

Três imagens do lote 04 voltam. Duas são as grelhas de aço: o guia pedia uma boca de 92 % da
largura do objeto e o modelo devolveu 64 % e 66 % — ele leu "construa tudo em volta da boca"
como "faça uma churrasqueira que caiba no desenho". A correção é descrever a boca como a própria
referência, célula a célula, e não como proporção:

**[MOUTH_IS_THE_REF]**
> The magenta rectangle in the reference is not a region to leave free: it IS the cooking opening, and it is the most important part of the image. Paint the grill so that its top opening covers exactly that magenta rectangle - same left edge, same right edge, same top edge, same bottom edge, same width and height, top edge perfectly horizontal. Do not shrink it, do not move it, do not draw a smaller opening inside the frame. The opening stays empty magenta: no grate, no coals, no ash, no food, no gloss over it. Everything the grill has - rim, body, legs, shelf, chimney - is built around that opening, not instead of it.

### R1 · `grill_ze_da_esquina_evo1.png` (ref: `guides/guide_cart.png`)
[STYLE] Subject: "Grelha do Zé da Esquina", a humble Brazilian street-corner charcoal grill: a long rectangular firebox of dark, well-seasoned, slightly greasy black steel with faded red-brown paint on its front panel, on a sturdy metal cart frame with two wheels and a small side shelf, a short chimney at the back left corner, honest wear. [MOUTH_IS_THE_REF] Wide 16:9 image, one single object, seen from the front and above at about 55 degrees. [TECH]

### R2 · `grill_parrilla_chef_cisma_evo1.png` (ref: `guides/guide_box.png`)
[STYLE] Subject: "Parrilla do Chef Cisma", an elegant chef's Argentine-style parrilla: a polished mirror-finish stainless-steel firebox reflecting warm golden light, on four neat steel legs, with a stainless side shelf, a small round thermometer on the front panel and a short stainless chimney at the back left corner. [MOUTH_IS_THE_REF] Wide 16:9 image, one single object, seen from the front and above at about 55 degrees. [TECH]

### R3 · `food_maminha.png` — só a célula 6 (ref: `ref_food_picanha.png`)
A folha de revisão mede o sprite antes e depois; a grade inteira é refeita porque o modo `grid`
pede as 6 células juntas e os 5 estados não podem mudar de forma entre si.

[STYLE] Subject: one maminha (tri-tip): a THICK WEDGE-shaped steak, clearly triangular in outline — broad and blunt at the left end, tapering to a narrow point at the right end — with a coarse long grain running along its length and NO fat band on top, lying horizontally. [FOOD6] Cell 6: SERVED — this is the one cell that failed last time: the maminha sliced against the grain into 5 overlapping fan-shaped slices **on a small round wooden board**, wide slices at the left and short ones at the right, rosy pink juicy centres, no charred crust anywhere on it, the board clearly visible around the meat. Raw maminha is a deeper, darker red than a strip loin, with visible coarse fibres. [REF_FOOD: a triangular wedge steak only; the shape must be obviously different from a rectangular strip loin] [TECH]

**Aceite do reforço:** as duas grelhas só entram quando a boca medir ≥ 20 % do sprite e inclinação
≤ 5° — medidos por `node tools/art/process-sprites.mjs art/lote-05.json --dry-run` com o `out`
apontando para um diretório descartável, e o `spr_food_maminha_served` só é aprovado quando o
quadro do prato tiver a tábua visível em volta da carne.
