# Lote 05 — prompts (texto exato, gravado antes da geração)

Data: 2026-09-26 · ferramenta: `generate_image`, 10 chamadas · saída: `art/source/lote-05/`
(fora do git; brutos são descartáveis, ver `docs/22-ARTE_2D_PLANO.md` §8).
Plano: `docs/23-PLANO_IMPLEMENTACAO.md` §3 passo 1.1.

**Por que este conteúdo.** Ordem pela primeira aparição no jogo (docs/22 §2), fechando
famílias inteiras: as 2 últimas comidas (costela nv.34, cupim nv.44) · os 18 ícones de
upgrade restantes (nomes = `icon` de `upgrades.json`) · os 5 cosméticos · os 5 funcionários
de `employees.json` · os 3 últimos fundos (premium nv.34, festival nv.46, rede nv.60) ·
as 10 categorias de `collection.json`. Ao aprovar: 16/16 comidas · 27/27 upgrades ·
5/5 funcionários · 7/7 fundos · 5/5 cosméticos · 10/10 categorias.

**Referências** (montadas a partir dos masters com `tools/art/make-ref.mjs`):

| Arquivo de referência | Comando |
|---|---|
| `art/source/refs/ref_food_picanha.png` | `make-ref.mjs grid … 848 1264 2 3 spr_food_picanha_{raw,rare,medium,well,burned,served}` |
| `art/source/refs/ref_icons_a.png` | `make-ref.mjs grid … 1200 1200 3 3 ic_{grill_size,heat,stability,speed,charcoal,charcoal_quality,auto_refill,knife,board}` (masters do lote 03, ainda `pending`: é a única guia da família de ícones) |
| `art/source/refs/ref_customers.png` | `make-ref.mjs grid … 1376 768 4 2 spr_char_customer_{comum,familia,generoso,influencer,tio_do_churrasco,vip,vizinho,turista_a}` |
| `art/source/refs/ref_bg_quintal.png` | cópia do master aprovado `bg_restaurant_quintal` |

Blocos **[STYLE]**, **[FOOD6]**, **[TECH]** e **[REF_FOOD: x]**: idênticos a `art/prompts/lote-02.md`.
Blocos **[ICONS9]** e **[BG]**: idênticos a `art/prompts/lote-03.md`.

**[ICONS5]**
> Wide icon strip with exactly 5 game UI icons in a single horizontal row, read left to right; one icon per position, each fully inside its own area and centred, all at the same scale. Bold, chunky, instantly readable silhouettes that still read at 32 pixels; soft 3D volume, glossy highlights, thick dark-brown outline; no background plates, no frames, no badges behind the icons.

**[ICONS10]**
> Wide 5:2 icon sheet with exactly 10 game UI icons in 5 columns and 2 rows, read left to right, top to bottom; one icon per cell, each fully inside its cell and centred, all at the same scale. Bold, chunky, instantly readable silhouettes that still read at 32 pixels; soft 3D volume, glossy highlights, thick dark-brown outline; no background plates, no frames, no badges behind the icons.

**[STAFF5]**
> Wide 16:9 image with exactly 5 bust portraits in a single horizontal row, read left to right; each portrait shows head and shoulders facing the viewer and sits fully inside its own area with wide magenta gaps, never touching or overlapping another. Friendly, expressive, appealing, family-friendly faces. No pink or magenta clothing.

## Imagens

### 1 · `food_costela.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one costela (beef short-ribs rack), a rectangular rack of three thick meaty beef ribs with clean white bone ends showing along one long edge, lying horizontally. [FOOD6] Cell 6: SERVED, the whole rack on a large oval wooden board with coarse salt flakes. Raw costela is deep red with marbling and glossy white bones. [REF_FOOD: a rib rack only, with visible bones, no steak] [TECH]

### 2 · `food_cupim.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one cupim (zebu hump steak), a thick triangular hunk of beef with heavy marbling and a generous fat cap on top, lying horizontally with the point facing right. [FOOD6] Cell 6: SERVED, sliced into thick slices fanned on a small round wooden board, with rosy pink juicy centres. Raw cupim is deep red with a creamy fat cap. [REF_FOOD: a triangular hump cut only, not the reference steak] [TECH]

### 3 · `ui_icons_upgrades_b.png` (ref: `ref_icons_a.png`)
[STYLE] Subject: upgrade icons for the restaurant room and service. [ICONS9] 1: a wide wooden serving counter seen from the front, with two stacked white plates on top (bigger counter). 2: a tall stack of clean white plates (more plates). 3: a large oval metal serving tray carrying a covered silver cloche dish (big tray). 4: a brass hourglass with a small red heart floating in the top bulb (patient customers). 5: a round wooden dining table set with a plate and a small flower vase (more tables). 6: a green potted plant in a terracotta pot wrapped with a string of tiny warm lights (decor). 7: a glowing pendant lamp with warm light rays (lighting). 8: a wide open wooden double door with warm golden light spilling out (capacity). 9: a wooden hanging shop sign with a painted flame emblem and no letters (signage). Use the reference image only as the guide for painting style, outline, lighting and icon scale; draw the new icons listed here. [TECH]

### 4 · `ui_icons_upgrades_c.png` (ref: `ref_icons_a.png`)
[STYLE] Subject: upgrade icons for the staff and the prestige tracks. [ICONS9] 1: a small acoustic guitar with three floating music notes (ambient music). 2: a silver serving cloche with a folded white napkin beside it (waiter). 3: a metal bucket of glowing charcoal with a small shovel leaning on it (helper). 4: a long two-pronged barbecue fork with a wooden handle and a small flame licking its tip (grill master). 5: a brass cash register with a gold coin popping out of its slot (cashier). 6: a wooden clipboard with a checklist of abstract ticks and a gold star at the top (manager). 7: a golden laurel wreath around one blazing ember (fire mastery). 8: three overlapping round badges with simple happy faces (loyal regulars). 9: a golden crown floating above three small restaurant buildings in a row (empire). Use the reference image only as the guide for painting style, outline, lighting and icon scale; draw the new icons listed here. [TECH]

### 5 · `ui_icons_cosmetics.png` (ref: `ref_icons_a.png`)
[STYLE] Subject: cosmetic skin icons for the grill master. [ICONS5] 1: a brown leather barbecue apron with a flame emblem and a front pocket. 2: a tall white chef's toque with a small flame badge. 3: a golden chef's knife with a glowing edge and a leather-wrapped handle. 4: a small charcoal grill painted deep red with gold trim. 5: a glowing neon-tube sign shaped like a flame, with no letters. Use the reference image only as the guide for painting style, outline, lighting and icon scale; draw the new icons listed here. [TECH]

### 6 · `char_funcionarios.png` (ref: `ref_customers.png`)
[STYLE] Subject: staff portraits for the game. [STAFF5] 1: the waiter, a young Brazilian man with light-brown skin and short black hair, a black vest over a white shirt with a red bow tie, a white serving towel over one shoulder, a friendly professional smile. 2: the helper, a strong young Brazilian woman with tan skin and a dark ponytail under a red bandana, a grey work t-shirt, a charcoal smudge on one cheek, a confident grin. 3: the grill master, a proud middle-aged Brazilian man with medium-brown skin and a short beard, a brown leather apron over a red checkered shirt, a long barbecue fork resting on one shoulder, a proud smile. 4: the cashier, a cheerful Brazilian woman with fair skin and curly auburn hair, a green cardigan, a small headset on one ear, a bright welcoming smile. 5: the manager, a distinguished older Black Brazilian man with dark-brown skin and a grey-flecked short beard, a navy polo shirt with a small gold flame pin, arms crossed, a calm assured smile. Use the reference image only as the guide for art style, rendering, line weight, lighting and bust framing; draw new people. [TECH]

### 7 · `bg_churrascaria_premium.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: inside an elegant Brazilian premium steakhouse dining room at night: round tables with white tablecloths and wine glasses, a crystal chandelier, a tall wine cellar wall, warm pendant lights, dark wood panels and a marble floor. [BG]

### 8 · `bg_festival.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: a Brazilian barbecue festival fairground at dusk, empty of people: a lit stage with warm spotlights at one side, canvas tents, colourful string pennant flags overhead, a row of smoking charcoal grills, hay bales and wooden benches, string lights, a deep blue-and-orange dusk sky. [BG]

### 9 · `bg_rede_nacional.png` (ref: `ref_bg_quintal.png`)
[STYLE] Subject: inside the grand flagship churrascaria of a national chain at night: a vast luxurious dining hall with many set tables, a glass-enclosed grill station with hanging skewers, floor-to-ceiling windows showing a sparkling city skyline at night, dramatic warm chandeliers, a polished marble floor. [BG]

### 10 · `ui_icons_collection.png` (ref: `ref_icons_a.png`)
[STYLE] Subject: collection category icons: one per food family. [ICONS10] 1: a thick steak with a fat cap (beef). 2: a roast chicken leg (poultry). 3: a coiled sausage ring (sausages). 4: a wedge of cheese wheel (cheeses). 5: a crusty round bread loaf (breads). 6: a bowl of golden french fries (sides). 7: two crossed wooden skewers with grilled cubes (skewers). 8: a glass jar of red sauce with a small wooden spoon (sauces). 9: crossed barbecue tongs and a spatula (equipment). 10: a small round charcoal grill with a lid (grills). Use the reference image only as the guide for painting style, outline, lighting and icon scale; draw the new icons listed here. [TECH]
