# Lote 02 — prompts (texto exato, gravado antes da geração)

Data: 2026-09-25 · ferramenta: `generate_image`, 10 chamadas · saída: `art/source/lote-02/`
(fora do git; cópia dos brutos em release de rascunho, ver `docs/22-ARTE_2D_PLANO.md` §8).

**Referências:** montadas a partir dos masters aprovados do lote 01 com
`tools/art/make-ref.mjs`, porque os brutos do lote 01 se perderam num reset do ambiente:

| Arquivo de referência | Comando |
|---|---|
| `art/source/refs/ref_food_picanha.png` | `make-ref.mjs grid … 848 1264 2 3 spr_food_picanha_{raw,rare,medium,well,burned,served}` |
| `art/source/refs/ref_food_espetinho.png` | `make-ref.mjs grid … 848 1264 2 3 spr_food_espetinho_misto_{…}` (já na horizontal) |
| `art/source/refs/ref_customers.png` | `make-ref.mjs grid … 1376 768 4 2 spr_char_customer_{comum,…,turista}` |
| `art/source/refs/ref_grill_lata_evo1.png` | `make-ref.mjs single … 1408 768 spr_grill_lata_valente_evo1` |

Cada prompt abaixo é a concatenação literal dos blocos, na ordem indicada.

## Blocos

**[STYLE]**
> Premium 2D mobile game art for a Brazilian churrasco cooking game. Stylized semi-realistic hand-painted look with soft 3D volume, like top-grossing casual cooking games. Subtle dark-brown outline, rich saturated but natural colours, glossy highlights. Warm golden-hour key light from the upper left; no cold light.

**[FOOD6]**
> Portrait 2:3 sprite sheet with exactly 6 cells in 2 columns and 3 rows, read left to right, top to bottom; one item per cell, each fully inside its cell and centred. Camera: three-quarter top-down view at about 55 degrees, the item lying horizontally with its long axis left to right. Cells 1 to 5 show the SAME single piece with an identical shape, size and position; only the cooking changes: 1 RAW; 2 RARE, just seared, pale with faint first grill marks; 3 PERFECT, golden-brown crust, dark crisp grill marks, glistening juices; 4 WELL DONE, darker and drier; 5 BURNED, charred black with cracks and grey ash.

**[TECH]**
> The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no floor, no cast shadows, no grid lines, no cell borders, no frames. Items are separated only by empty magenta space; leave generous magenta space around every item. No letters, numbers, captions, labels or watermark anywhere in the image. Nothing in the artwork itself is magenta or hot pink (natural meat reds and pinks are fine).

**[REF_FOOD: x]**
> Use the reference image only as the guide for art style, camera angle, cell layout and item size; do NOT copy its food: x.

## Imagens

### 1 · `food_espetinho_frango.png` (ref: `ref_food_espetinho.png`)
[STYLE] Subject: one espetinho de frango, a wooden skewer threaded with five cubes of juicy chicken thigh and nothing else; a short stick end shows on the left and the pointed tip on the right. [FOOD6] Cell 6: SERVED, the same skewer resting on a small rectangular wooden board with a lime wedge. Raw chicken is pale beige-pink and moist. [REF_FOOD: chicken cubes only, no beef, no sausage, no onion, no pepper] [TECH]

### 2 · `food_coracao_frango.png` (ref: `ref_food_espetinho.png`)
[STYLE] Subject: one espeto de coração de frango, a wooden skewer threaded tightly with eight small whole chicken hearts (the classic Brazilian coraçãozinho); a short stick end shows on the left and the pointed tip on the right. [FOOD6] Cell 6: SERVED, the same skewer on a small rectangular wooden board with a pinch of coarse salt and a lime wedge. Raw hearts are a deep, glossy dark red. [REF_FOOD: chicken hearts only, no beef, no sausage, no onion, no pepper] [TECH]

### 3 · `food_frango_coxa.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one chicken drumstick (coxa de frango) with the skin on, lying horizontally, the meaty end on the left and the clean bone knob pointing right. [FOOD6] Cell 6: SERVED, two grilled drumsticks on a small round wooden board with a lime wedge. Raw skin is pale beige-pink and slightly moist. [REF_FOOD: a chicken drumstick only, no steak] [TECH]

### 4 · `food_asinha_frango.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one whole chicken wing (asinha de frango), drumette and flat still joined in a shallow V, skin on, lying horizontally. [FOOD6] Cell 6: SERVED, three grilled wings on a small round wooden board. Raw skin is pale beige-pink. [REF_FOOD: a chicken wing only, no steak] [TECH]

### 5 · `food_fraldinha.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: one fraldinha (flank steak), a long, flat, fairly thin strip of beef with a coarse grain running along its length and almost no fat, lying horizontally. [FOOD6] Cell 6: SERVED, sliced against the grain into strips fanned out on a small round wooden board, with rosy pink juicy centres. Raw fraldinha is deep red with a pronounced coarse grain. [REF_FOOD: fraldinha only, without the thick fat cap of the reference steak] [TECH]

### 6 · `food_legumes_grelhados.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: grilled vegetables on one small rectangular dark cast-iron grill tray: zucchini rounds, red and yellow bell pepper strips, white onion rings and a short piece of corn on the cob, arranged neatly; the tray keeps exactly the same shape in every cell. [FOOD6] Cell 6: SERVED, the grilled vegetables arranged on a small round wooden board with a sprig of parsley, without the tray. Raw vegetables are fresh, bright and glossy; burned vegetables are black and shrivelled. [REF_FOOD: vegetables only, no meat] [TECH]

### 7 · `food_vinagrete.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: vinagrete, the Brazilian tomato-and-onion salsa served with churrasco; it is prepared, never grilled. Square 1:1 sprite sheet with exactly 4 cells in 2 columns and 2 rows, read left to right, top to bottom; one item per cell, each fully inside its cell and centred. Camera: three-quarter top-down view at about 55 degrees. Cell 1 INGREDIENTS: one whole ripe tomato, half a white onion and one green bell pepper together on a small wooden cutting board. Cell 2 CHOPPED: the same cutting board with the tomato, onion and pepper finely diced in three small neat piles. Cell 3 READY: a small round cream ceramic bowl full of fresh vinagrete, diced tomato, onion, green pepper and chopped parsley glistening with vinegar and olive oil. Cell 4 SERVED: the same bowl on a small round wooden board with a wooden spoon. Use the reference image only as the guide for art style, camera angle and item size; do NOT copy its food: no meat. [TECH]

### 8 · `char_clientes_b.png` (ref: `ref_customers.png`)
[STYLE] Subject: customer portraits for the game. Wide 16:9 image with exactly 6 bust portraits arranged in 2 rows of 3, read left to right, top to bottom; each portrait shows head and shoulders facing the viewer and sits fully inside its own area with wide magenta gaps, never touching or overlapping another. Friendly, expressive, appealing, family-friendly faces. 1: a thrifty penny-pincher, an older Brazilian man with short grey hair and medium-brown skin, a plain grey t-shirt, hugging a folded reusable shopping bag, a sly, suspicious little smile. 2: a generous customer, a Black Brazilian man with dark-brown skin and curly hair, a mustard-gold dress shirt and a gold wristwatch, a big warm smile, one open hand raised as if saying keep the change. 3: a rival grill master, a confident Brazilian woman with tan skin and a dark-red bandana over her hair, a brown leather apron over a dark shirt, arms crossed, a challenging smirk, a chef's knife sheathed in the apron pocket. 4: a VIP guest, an elegant woman with fair skin and a sleek updo, a tailored cream suit with gold details and a small gold star brooch, sunglasses pushed up on her head, a poised smile. 5: a friendly neighbour, a cheerful man with light-tan skin and short curly hair, a light-blue tank top, waving hello. 6: the same sunburned tourist as in the reference, with red hair and a straw sun hat with sunglasses on it, now wearing a buttoned teal Hawaiian shirt with a floral pattern that fully covers his chest, a camera on a strap around his neck, an excited smile. Use the reference image only as the guide for art style, rendering, line weight, lighting and bust framing; apart from the tourist, draw new people. No pink or magenta clothing. [TECH]

*Aparência de cada um = `look` de `shared/data/customers.json` (pele, cabelo, roupa, acessório, cor-assinatura). O `chinelo` do vizinho não aparece num busto.*

### 9 · `grill_lata_valente_evo2.png` (ref: `ref_grill_lata_evo1.png`)
[STYLE] Subject: the upgraded version of the grill in the reference image. Keep the SAME halved rusty steel-drum grill: same camera angle, same size, same proportions and the same position in the frame; its cooking opening is left empty so the flat magenta background shows through it, exactly like the reference. Upgrade, brick support: the wobbly rebar legs are gone; the drum now rests firmly on two neat stacks of red bricks, one under each end, and a couple of riveted metal patches cover the worst rust spots. Wide 16:9 image, one single object, centred. [TECH]

### 10 · `grill_lata_valente_evo3.png` (ref: `ref_grill_lata_evo1.png`)
[STYLE] Subject: the fully upgraded version of the grill in the reference image. Keep the SAME halved steel-drum grill: same camera angle, same size, same proportions and the same position in the frame; its cooking opening is left empty so the flat magenta background shows through it, exactly like the reference. Upgrade, grandma approved: the drum is cleaned and freshly painted in a warm deep-red heat-resistant paint with a few honest scuffs, with sturdy welded handles, and sits on a tidy mortared red-brick base; a red-and-white checkered kitchen towel hangs from one handle and a small clay pot of fresh herbs sits on the brick base. Wide 16:9 image, one single object, centred. [TECH]
