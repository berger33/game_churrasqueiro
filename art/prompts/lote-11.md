# Lote 11 — as duas evo 3 que a régua reprovou, e a maminha inteira

Veredito do dono sobre o lote 06, lido na régua (não na folha): as 6 evoluções pintadas passaram 4, e
duas **não comportam a grade que o dado promete**. Como `set-status.mjs <lote> approved` roda a mesma
régua antes de assinar, um `set-status lote-06 approved` inteiro seria recusado — aprovar por nome os 4
sadios e repintar as 2 tortas é o caminho. É o que este lote faz, mais a maminha, que está presa na regra
"comida entra inteira ou não entra" desde o lote 05 (os 6 quadros seguem `pending`, então a carne hoje não
tem arte nenhuma no jogo).

| item | o que a régua mediu no lote 06 | por que reprova |
|---|---|---|
| `spr_grill_ze_da_esquina_evo3` | boca **9,23:1**, faixa de **19 px**, topo 0° | a grade é 2×3 e exige 60 px por fileira; e boca em nível = planta baixa |
| `spr_grill_parrilla_chef_cisma_evo3` | boca **3,46:1**, faixa de **35 px**, topo 0° | mesma régua, 3×3 exige 180 px de vão; saiu com metade |
| `food_maminha` (6 quadros) | desenho ok, mas não assinado | `spr_food_maminha_served` virou "mais um bife queimado" no lote 04; o reforço do 05 não foi assinado e a comida inteira ficou de fora |

## Geometria de cada item (sai do dado, não da minha prosa)

Gerada por `node tools/art/make-ref.mjs guide … --roll 7` e conferida pelo MESMO detector que julga o
sprite pintado (`process-sprites.mjs --dry-run`):

| item | quadro do guia | boca do guia | grade prometida | vaga |
|---|---|---|---|---|
| `ze_da_esquina` evo 3 | 1408×912 | 1126×377 px = **2,99:1** (80 % da largura) | 2 fileiras × 3 vagas | 86×60 px |
| `parrilla_chef_cisma` evo 3 | 1408×1360 | 1126×565 px = **1,99:1** (80 % da largura) | 3 fileiras × 3 vagas | 86×60 px |

Aceite (as mesmas réguas do lote 09/10, sem exceção): faixa de brasa ≥ 60 px por fileira · boca entre
0,72 e 0,90 da largura do recorte · `cheio` ≥ 0,85 · |rolo do vão| entre 4° e 12° · altura da boca ≤ 248 px
na tela · conform necessário ≤ ×1,4 (passou disso, regenera — esticar a boca 2,3× é redesenhar a grelha).

**O que a régua do lote 06 não via e esta agora cobra:** o vão dessas duas é *parede vertical* (a janela
recortada na frente do corpo, como a porta de um forno), não a cama de brasa vista de cima. Pedir elevação
alta fecha o vão na tela — foi a lição da sexta rodada da grelha a gás (docs/22 §6.10.4), e é exatamente o
que produziu a boca de 9,23:1 da chapa. Elevação baixa (10–15°), profundidade pelo resto: guinada do corpo,
tira da lateral, face interna da tampa, brilho de calor no vão.

## Bloco comum (as duas grelhas)

```
[CAMERA] This is a photograph of a real object, not a technical drawing. The camera sits only 10–15
degrees above the cooking opening, and the WHOLE FRAME is rotated counter-clockwise by about 8 degrees —
the way a phone photo is tipped, nothing in it is level: the floor under the wheels runs uphill to the
right, and the top edge of the opening rises toward the right by those same 8 degrees. Do NOT raise the
camera higher and do NOT look down into the box. The cooking opening is a VERTICAL WINDOW cut into the
FRONT WALL of the object, like the door of an oven — never a horizontal coal bed seen from above, never
an ellipse, never a parallelogram floor. Because it is a vertical plane, it keeps its height. You may
also see a narrow strip of one side panel, which is what makes the object read as three-dimensional.
This is the same amount of world the reference grills show — copy how much depth they show, not what
they are.
[MOUTH] The FIRST reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta quadrilateral inside it, tipped by those same degrees. That quadrilateral IS the cooking
opening: paint the object so its opening covers exactly that magenta shape — same four corners, same
width, same height, same tip. For this grill the opening is 2.99 times wider than tall (the chapa) /
1.99 times wider than tall (the parrilla): that ratio is the whole job, because the game places the
food inside it, one row of embers per band. Do not shrink it, do not flatten it into a letterbox slit,
do not draw a smaller window inside the frame, and do not straighten the drawing back to horizontal. The
opening stays EMPTY MAGENTA: no grate, no bars, no flames, no coals, no ash, no food, no gloss, nothing
painted there — the game draws the food and the heat bands itself. Its height IS the row count: 2 rows
of food for the chapa, 3 rows for the parrilla, and never a taller rim or a splash guard eating the
leftover height.
[ENCLOSED] The opening is a hole surrounded on all four sides by the object's own material: the magenta
of the opening must never touch the magenta of the background anywhere, not at the top, not at a corner.
[SIZE OF THE DRAWING] The magenta opening must span 80–89 % of the width of the FINISHED DRAWING, and
the whole object — hood, lid, panel, legs, wheels, awning, fryer — must fit inside one rectangle only
10 % wider than the opening. [NO SIDE FURNITURE] Nothing may stick out to the left or right of the
opening: a side shelf, a folded table, a tool rack or an awning that widens the drawing is left out or
tucked under the body. A narrower, cleaner object beats a wide one with a small opening.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no
floor, no cast shadow, no grid lines, no cell borders, no frame. Nothing in the artwork itself is
magenta or hot pink. Premium 2D mobile game art for a Brazilian churrasco game: stylized hand-painted
look with soft 3D volume, subtle dark-brown outline, rich saturated natural colours, glossy highlights,
warm golden-hour key light from the upper left. One single object, centred, filling a portrait frame.
[NO TEXT] No letters, numbers, words, signboards, logos, chalkboards or menu boards anywhere.
```

## 1) `spr_grill_ze_da_esquina_evo3` — "Com Fritadeira" (2 fileiras × 3 vagas)

```
[STYLE] The SAME street churrasco cart the previous level painted, one rung richer: a dry-stacked brick
wall — red bricks laid WITHOUT mortar, visibly offset and chipped, four courses wide at each end — with
a WIDE rectangular opening cut through it, three bricks per row of the opening's width, so the window is
nearly three times as wide as it is tall. Above the opening a striped canvas awning on two slim poles,
its edge tucked INSIDE the width of the brickwork; below the opening a rough concrete lintel course, and
set into the front face under it a small black deep-fryer with one wire basket hanging on its rim and a
blue gas ring beside it, both painted flat on the front, never sticking out sideways. Two cinder blocks on
the ground at the feet. Warm ember light leaks through the gaps in the lowest brick course and glows up
onto the underside of the lintel. The brickwork on the left shows its narrow side face, so the wall reads
as thick. Soot, heat-blued brick, one fraying towel over a corner brick.
[IDENTITY] This is a brick street cart, not a stainless appliance: no chrome, no glass, no knobs.
```

Guia: `art/source/lote-11/guides/g_ze_da_esquina_e3.png` · referências: a evo 1 aprovada da mesma
identidade (`ref_mesma_familia_e1.png`, à esquerda) e as duas assinadas com a câmera que ele gosta
(`ref_cameras_aprovadas.png`).

## 2) `spr_grill_parrilla_chef_cisma_evo3` — "Termômetro que Não Mente" (3 fileiras × 3 vagas)

```
[STYLE] The SAME chef's parrilla the previous level painted, now the professional one: a tall
cream-rendered masonry body with a dark brick firebox recess, brushed stainless steel everywhere it is
metal. The opening is a TALL rectangular window in the front wall, three bands high, its steel frame
rolled and riveted, carrying inside its top edge a set of parallel spit rods with forks and a crank
chain-and-sprocket on the left cheek. On the steel hood above the window, one large blank round
thermometer dial with a red needle — the size of a dinner plate, mounted flat, no letters. A row of
adjustment holes with a steel handle in one of them runs down each cheek: the grate height is adjustable
and the drawing must show the mechanism. Below the window, a dark brick front with a narrow horizontal
firedoor full of orange embers, and a small ash drawer under it. Everything sits on four chunky legs on
a puddle of warm light. Clean, engineered, slightly show-off: this is the grill that measures doneness.
[IDENTITY] Masonry plus brushed steel, warm not cold: the only silver is the frame, the hood and the
dial.
```

Guia: `art/source/lote-11/guides/g_parrilla_chef_cisma_e3.png` · mesmas duas referências de câmera, e a
evo 1 da identidade ao lado no `ref_mesma_familia_e1.png`.

## 3) `food_maminha` — a folha de 6 quadros (raw · rare · medium · well · burned · served)

O motivo da repintura é um quadro só: no lote 04 a célula 6 veio como mais um bife queimado, e a regra do
build é que comida entra inteira. Então a folha inteira de 2×3 é regerada, com a **grade como contrato**:
célula 6 é um prato, não um estado de cocção.

```
[LAYOUT] Exactly six drawings, arranged in a 2-column × 3-row grid, one per cell, generous flat magenta
margin between cells and around the sheet. Row 1: cell 1 = raw, cell 2 = rare. Row 2: cell 3 = medium
(ao ponto), cell 4 = well (bem passado). Row 3: cell 5 = burned, cell 6 = SERVED. Cells 1–5 are the SAME
piece of meat at five cooking stages; cell 6 is that meat CUT AND PLATED.
[SUBJECT] Maminha (rump cap / picanha's neighbour): a distinctly TRIANGULAR wedge of beef, one long
straight edge and one tapering point, a single cap of cream-white fat along the long edge only, coarse
muscle grain running from the fat cap down to the point. Three-quarter view from about 55 degrees above,
the piece lying flat, its long axis horizontal on the grid — never standing up, never diagonal.
[STAGES] raw: deep pink-red, wet sheen, fat cap ivory and firm. rare: edges turned grey-brown one
millimetre in, the face still ruby. medium: browned crust across the top face, a pink line at the cut
edge, fat rendered and blistered. well: crust darkens to chestnut, juices bead on the surface, fat golden
and crisp-edged. burned: blackened crust with cracking, grey-brown at the cut edge, fat puckered and dark,
a thin thread of smoke.
[CELL 6 — THE ONE THAT KILLED THE LAST SHEET] NOT a whole steak. A round wooden board, seen from the same
height, carrying five THIN SLICES of the same wedge fanned against the grain: grey-pink centres with a
brown rim on every slice, the fat cap cut into matching strips laid along the fan, a pinch of coarse salt
and two green onion sprigs on the board. Nothing else on it, no knife, no hands. If cell 6 could be
mistaken for cell 5, the sheet is wrong.
[SAME OUTLINE] Cells 1–5 keep one and the same silhouette, one and the same size, one and the same
pivot: only colour, crust, juice and fat change. A griller comparing them must be able to overlay them.
[TECH] Flat uniform pure magenta (#FF00FF) background: no gradient, no floor, no cast shadow, no grid
lines, no cell borders, no frame, no captions, no letters, numbers or words anywhere. Nothing in the art
is magenta or hot pink. Premium 2D mobile game art for a Brazilian churrasco game: stylized hand-painted,
soft 3D volume, subtle dark-brown outline, glossy fat and juice highlights, warm golden-hour key light
from the upper left.
```

A referência de folha é o contra-filé aprovado (mesmo layout, mesma luz) justamente para a maminha sair
**triangular onde o contra-filé é retangular** — é a única diferença que o jogador precisa ver na bancada.
`ref_pratos_servidos.png` mostra o que "servido" quer dizer na nossa arte: tábua + fatias, nunca peça
inteira.

## Referências (o `art/source/` não é versionado; os comandos refazem tudo)

```
node tools/art/make-ref.mjs guide art/source/lote-11/guides/g_ze_da_esquina_e3.png      1408 --grill ze_da_esquina      --evo 3 --roll 7
node tools/art/make-ref.mjs guide art/source/lote-11/guides/g_parrilla_chef_cisma_e3.png 1408 --grill parrilla_chef_cisma --evo 3 --roll 7
node tools/art/make-ref.mjs grid  art/source/lote-11/refs/ref_mesma_familia_e1.png   2400 1200 2 1 spr_grill_ze_da_esquina_evo1 spr_grill_parrilla_chef_cisma_evo1
node tools/art/make-ref.mjs grid  art/source/lote-11/refs/ref_cameras_aprovadas.png  2400 1200 2 1 spr_grill_tambor_vertical_evo1 spr_grill_lata_valente_evo1
node tools/art/make-ref.mjs grid  art/source/lote-11/refs/ref_sheet_contra_file.png  1600 2400 2 3 spr_food_contra_file_raw spr_food_contra_file_rare spr_food_contra_file_medium spr_food_contra_file_well spr_food_contra_file_burned spr_food_contra_file_served
node tools/art/make-ref.mjs grid  art/source/lote-11/refs/ref_pratos_servidos.png     2400 700 4 1 spr_food_picanha_served spr_food_contra_file_served spr_food_fraldinha_served spr_food_linguica_toscana_served
```

## O que as rodadas mediram (a régua e o olho, separados)

A grelha a gás ensinou que as duas coisas não são a mesma (docs/22 §6.10.4). Este lote foi medido com
elas separadas de propósito: passar na régua com um vão que ele vai chamar de "sem inclinação" é
retrabalho, e acertar o olho com uma boca que não comporta a grade é mentira no cartão da loja.

**`spr_grill_ze_da_esquina_evo3`** — guia pede boca **2,99:1**, 2 fileiras de 86×60 px:

| rodada | boca pintada | faixa/vaga | vão | b/larg | `cheio` | conform | o que estava errado |
|---|---|---|---|---|---|---|---|
| r1 | 1,63:1 | 110 px ✓ | — | 0,33 ✗ | — | nenhum | monte de areia no chão + botijão e fritadeira alargando o recorte; **tijolo pintado dentro do vão** (a boca virou seta) |
| r2 | 2,74:1 | 66 px ✓ | −6,8° ✓ | 0,67 ⚕ | 1,02 | nenhum | toldo **flutuando** acima da parede, separado dela por um vão de fundo |
| **r3** | **2,28:1** | **79 px ✓** | **−6,7° ✓** | **0,69 ⚕** | **1,01** | **nenhum** | **adotada** — boca mais alta que o guia (sobra leito, nunca falta), toldo parafusado, tudo dentro do vão limpo |
| r4 | 2,93:1 ✓ | 61 px ✓ | −4,1° ⚕ | 0,62 ⚕ | 1,01 | nenhum | a razão exata, mas o vão no piso do que ele chama de "sem inclinação" (as assinadas medem −8,6° a −6,1°) |
| r5 | 2,98:1 ✓ | 60 px ✓ | — | 0,67 ⚕ | 1,01 | **×1,304** ✗ | o vão *pintado* veio em 3,89:1 (barra de carta) e o pipeline esticou a arte inteira 30 % para conformar — preço que a folha não precisa pagar |

**`spr_grill_parrilla_chef_cisma_evo3`** — guia pede **1,99:1**, 3 fileiras de 86×60 px:

| rodada | boca pintada | faixa/vaga | vão | b/larg | `cheio` | conform | o que estava errado |
|---|---|---|---|---|---|---|---|
| r1 | 1,49:1 | 80 px ✓ | ~0° ⚕ | 0,58 ⚕ | — | nenhum | espetos e corrente pendurados **dentro** do vão (o detector fechou o buraco embaixo deles) e a manivela do lado direito esticando o recorte |
| **r2** | **1,65:1** | **73 px ✓** | **−6,4° ✓** | **0,58 ⚕** | **1,01** | **nenhum** | **adotada** — espetos na bandeja sob o capô, corrente na bochecha externa, tijolo do fogão visível na parede interna do recesso (profundidade sem invadir o vão) |

Duas coisas que a folha de medição não resolve sozinha e ficam registradas:

1. **`b/larg` 0,58–0,69 contra o piso novo de 0,72.** É AVISO do padrão, não reprovação, e as próprias
   evo 1 assinadas dessas duas identidades medem 0,48 e 0,61 — as duas novas estão *acima* das suas
   irmãs. Baixar a moldura abaixo dos pilares de tijolo e das quatro pernas é o que faltaria para 0,72,
   e é pedir ao modelo um objeto sem pilares: a identidade custa a largura. Fica para ele decidir se
   aceita a troca.
2. **`cheio` é cego a entalhe** (a lacuna já escrita no §6.10.3): um espeto atravessando o canto do vão
   não muda o índice, porque o quadrilátero ajustado acompanha o recorte. As duas repinturas tiraram o
   que havia dentro do vão por *desenho*, não por régua — foi a frase "the rods and the crank live ABOVE
   and BESIDE the opening, never inside it" que resolveu, e ela entra no bloco comum dos próximos lotes.

Rejeitar uma rodada não é apagar a prova: as cinco chapa e as duas inox estão em `art/source/lote-11/`
(gitignored, vivas até o próximo reset). Trocar a adotada é um comando por item:

```
node tools/art/process-sprites.mjs art/lote-11.json   # com `source` apontando para a rodada escolhida
node tools/art/review-sheet.mjs art/lote-11.json
```
