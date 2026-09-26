# Lote 09 — as três grelhas "sem nenhuma inclinação na imagem"

Veredito dele sobre o lote 08: **"queimadores a gás, grelha de prata e defumador com tampa, esses três não
tem nenhuma inclinação na imagem, pode refazer, os outros estão aprovados."** Traduzido para arquivo:

| como ele chamou | sprite | inclinação medida da boca |
|---|---|---|
| queimadores a gás | `spr_grill_fornalha_dragao_manso_evo1` | **−0,3°** |
| grelha de prata (o bidão de chapa soldada da praça) | `spr_grill_grelha_de_praca_evo1` | **0°** |
| defumador com tampa | `spr_grill_tambor_vertical_evo1` | **0°** |
| tijolo seco · quintal (os outros) | `spr_grill_ze_da_esquina_evo1` · `spr_grill_espeto_do_neno_evo1` | +1,7° · −2,6° → **aprovadas** |

A medição dele bate com a minha ao décimo de grau: as três que ele recusou são exatamente as três bocas em
nível do lote 08 (0° e −0,3°), e as duas que ele aprovou são as duas que saem do nível. As grelhas que ele
carimbou como "o ângulo certo" — a foto colada na conversa do lote 07 — medem −8,6° (lata), −6,7°
(fornalha da orla), −6,1° (parrilla do cisma).

## A causa é minha, e está escrita no meu próprio prompt

O bloco `[CAMERA]` do lote 08 (e do 07) diz:

> The cooking opening is an **axis-aligned rectangle whose top and bottom edges are horizontal lines
> parallel to the top of the image** and whose left and right edges are vertical.

Eu escrevi essa frase para matar a deriva isométrica dos lotes 03/05 e ela fez o que foi pedida: entregou
uma planta baixa. Depois reclamei que a planta baixa não era uma foto. O defeito que ele viu nas três é a
minha frase, não a obediência do modelo. Correção no padrão, não só no lote:

- `tools/art/grill-geometry.mjs`: `MOUTH_TILT_MIN_HINT = 4` — boca com |inclinação| abaixo disso é marcada
  `flatMouth`. Aviso, não reprovação: 11 grelhas hoje (duas aprovadas por ele antes desta régua) medem 0°.
- `tools/art/check-grill-geometry.mjs`: o aviso sai por linha e no rodapé ("planta baixa, não foto").
- `tools/art/make-ref.mjs guide … --roll <graus>`: o guia de composição agora é desenhado **rolado**, corpo,
  boca e base juntos, e o quadro cresce o tanto necessário para nenhum canto ser cortado. A boca continua
  com os pixels que o padrão exige — o magenta extra é aparo. Guia de hoje: `--roll 7`.

## Bloco comum (as três)

```
[CAMERA] This is a photograph, not a technical drawing. The camera is about 15–20 degrees above the object
AND ROLLED: the whole drawing is tipped counter-clockwise by about 7 degrees, exactly as the LAYOUT GUIDE
is tipped, so the right end of the object sits higher than the left end. Nothing in the picture is level —
not the base, not the rim, not the opening. Seen from that height you look slightly DOWN INTO the bed: the
far edge of the cooking opening is a line that rises toward the right, and it is a little shorter than the
near edge. This is NOT isometric and NOT aerial: the opening stays a four-sided window, the object has only
one visible face plus the top rim — no parallelogram floor, no diamond, no oval bed.
[MOUTH] The FIRST reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta quadrilateral inside it, tipped by the same 7 degrees. That quadrilateral IS the cooking opening:
paint the object so its opening covers exactly that magenta shape — same four corners, same width, same
height, same tilt. Do not shrink it, do not level it, do not straighten the drawing back to horizontal and
do not draw a smaller opening inside the frame. The opening stays EMPTY MAGENTA: no grate, no bars, no
coals, no ash, no food, no gloss, nothing crossing it — the game draws the food and the heat bands there.
[ROWS] The height of the opening IS the row count the shop promised, one band per row. Never fill leftover
height with a taller rim, a splash guard or a shelf inside the opening.
[NO SIDE FURNITURE] The magenta opening must span 80–89 % of the width of the FINISHED DRAWING, the way it
does in the proportion reference image. Everything the object has — side trays, tool racks, coal hoppers,
cutting boards, salt cellars, chimneys, awnings, baskets — must stay INSIDE the width of the body's own
silhouette, tucked under the opening or behind it; nothing may stick out to the left or to the right of the
opening. If a detail does not fit inside that width, leave the detail out: a narrower, cleaner object beats
a wide one with a small opening. The trim of the drawing must hug the body, so the opening stays wide.
[SIZE OF THE DRAWING] The entire finished drawing — body, lid, legs, wheels, chimney — must fit inside one
rectangle only 10 % wider than the magenta opening. That is the frame of the second reference image; the
object fills it the way that one fills its frame.
[ENCLOSED] The opening is a hole surrounded on all four sides by the object's own material: the magenta of
the opening must never touch the magenta of the background anywhere, not at the top, not at a corner. A lid
that is removed or an opening that runs to the edge of the body is NOT what is wanted — the rim, the hood or
the lid above the opening has to be painted, so the opening reads as a hole in a solid object.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no floor,
no cast shadows, no grid lines, no cell borders, no frames. Nothing in the artwork itself is magenta or hot
pink. Premium 2D mobile game art for a Brazilian churrasco game: stylized hand-painted look with soft 3D
volume, subtle dark-brown outline, rich saturated natural colours, glossy highlights, warm golden-hour key
light from the upper left. One single object, centred, filling the frame. [NO TEXT] No letters, numbers,
words, signboards, logos, chalkboards or menu boards anywhere.
```

## As três

1. **`spr_grill_grelha_de_praca_evo1`** — tambor/lata cortada ao meio (2×2, boca 2,75:1, quadro 1408×976)
   > [STYLE] An oil drum cut in half lengthways and standing on two rebar legs, one cinder block under the
   > low end: dark dented blue-grey steel, the cut rim welded rough and bright silver, a welded handle at
   > each end, soot and heat-blued paint. The half-open lid of the drum hangs at the back edge, inside the
   > width of the body. Three cinder-block chips and a couple of loose bricks at the base, a small sheet
   > metal shelf bolted at the right end INSIDE the body's width. A wide shallow band of glowing embers in
   > the front face below the opening — the fire is never inside the opening. This is the humble first
   > real grill: improvised, dented, loved. The second reference image is the approved
   > art of a similar cut drum and it carries the camera: same tipped object, same look down into the
   > cut, same width of opening relative to the drawing. Copy its camera, not its colours.

2. **`spr_grill_tambor_vertical_evo1`** — defumador com tampa (3×3, boca 1,99:1, quadro 1408×1360)
   > [STYLE] An offset smoker built from a big horizontal black-painted steel barrel: the barrel's front
   > is cut open into a tall near-square opening (1,99 times wider than tall). The domed lid is only
   > HALF-OPEN — it tilts up about 30 degrees behind the opening, low and short, so it reads as a lid and
   > not as a big dark panel, and its silhouette stays within the barrel's width. A compact firebox box at
   > the left end with its own door, a short chimney at the right end with a butterfly damper, one blank
   > round gauge on the barrel front, two small wheels under the middle. Soot and heat-blued paint; three
   > rows of embers in the firebox front below the opening. The whole smoker is tipped with the camera:
   > the barrel axis runs uphill to the right, and the top of the barrel shows a sliver of its round
   > shoulder because the camera is above it. The second reference image carries that camera.

3. **`spr_grill_fornalha_dragao_manso_evo1`** — a gás com queimadores (3×3, boca 1,99:1, quadro 1408×1360)
   > [MOUTH-AGAIN] The opening is a BIG, TALL, nearly SQUARE window: 1,99 times wider than tall, as tall
   > as the front panel plus the cabinet below it. A wide shallow slit is a failed drawing — that is the
   > single reason this item was refused twice.
   > [STYLE] A modern stainless-steel gas grill: brushed-steel body with a rolled rim and a DEEP open
   > cooking box on top; a hinged lid standing open behind the opening, its inner brushed face toward the
   > viewer, its width inside the width of the body; a front control panel with three chunky black blank
   > knobs and one red ignition button; a black two-door cabinet below with two chunky wheels. The side
   > shelves are FOLDED DOWN (not sticking out to the sides) so the drawing hugs the grill. Warm flame glow
   > behind a steel grille band in the cabinet front — three rows. Clean, precise, no brick, no soot: this
   > level sells speed. You look DOWN INTO the deep cooking box: the far wall of the box is visible as a
   > narrow lit band above the opening, and the whole grill is tipped with the camera, the right side
   > higher. The second reference image carries that camera.

Referências montadas (o `art/source/` não é versionado; o comando refaz tudo a partir do atlas):

```
node tools/art/make-ref.mjs guide  art/source/lote-09/guides/g_<id>_e1.png 1408 --grill <id> --evo 1 --roll 7
node tools/art/make-ref.mjs single art/source/lote-09/refs/ref_cameras_lata_976.png  1408 976  spr_grill_lata_valente_evo1
node tools/art/make-ref.mjs single art/source/lote-09/refs/ref_cameras_lata_1360.png 1408 1360 spr_grill_lata_valente_evo1
```

## Aceite

Cada uma das três tem de medir, no `check-grill-geometry.mjs --all`:

- |inclinação| entre 4° e 12° (piso novo `MOUTH_TILT_MIN_HINT`, teto `grill.json.art.maxTiltDeg`);
- boca entre 0,72 e 0,90 da largura do recorte (`MOUTH_WIDTH_HINT`);
- `cheio` ≥ 0,85 (`MOUTH_FILL_HINT`) e faixa de brasa ≥ 60 px por fileira, sem conform acima de ×1,4;
- a razão da boca dentro de ±25 % da pedida pelo guia.

Inclinação aqui não é gosto: é a câmera que ele carimbou na foto do lote 07, medida no vão magenta.

## Ronda 2 da grelha de praça — o que a folha me mostrou que a régua não mostra

A medição da `grelha_de_praca` (r1) passou na câmera (−9,1°) e o `cheio` deu 1,02, mas olhando a folha com o
contorno ciano por cima do sprite aparece uma chapa soldada **dentro** do vão, no canto direito: o quadrilátero
detectado *acompanha* o entalhe (o `process-sprites` ajusta quatro cantos ao magenta, não a um retângulo), e
por isso a área fecha com o vão e o índice não denuncia. Como o motor espalha as vagas pela **bbox** do vão
(`foodU` em x, fileiras em y), um prato de 86 px seria desenhado por cima da chapa. Regenerar é o caminho — e
a lacuna da régua fica registrada: `cheio` pega barra atravessando a boca, não pega canto comido por
entalhe; para isso o ajuste do vão teria de ser comparado a um retângulo, não ao próprio contorno (e mexer no
ajuste mexe nas 18 medições que já estão assinadas — é mudança de padrão, não de lote).

## As cinco rodadas da grelha a gás (o que cada uma devolveu)

| ronda | o que o prompt pedia de câmera | boca medida | inclinação | recorte | virada |
|---|---|---|---|---|---|
| r1 | guia rolado 7°, "bordas horizontais" banidas | 2:1 (após conform ×1,636) | **−15°** ✗ | 0,66 | passou na boca, estourou o teto de 12° |
| r2 | guia 4°, "sutil, sem parecer caindo" + "aparelho largo e baixo" | 3,5:1 ✗ | −9,3° ✓ | 0,63 | **o "largo e baixo" achatarou a boca**: faixa de 34 px |
| r3 | guia 4°, boca alta de novo ("altura = metade da largura") | 2:1 ✓ (×1,053) | **−18,3°** ✗ | 0,65 | a boca certa, a câmera exagerada |
| r4 | "quase nível, 3°", capô fechado | 2:1 ✓ (×1,091) | −4,0° ✓ | **0,77** ✓ | verde em tudo, mas a inclinação no chão do piso |
| **r5** | 7° pedido como foto de celular, capô fechado, guia rolado 7° | **1,73:1 ✓ · faixa 69 px · sem conform** | **−7,0°** ✓ | **0,77** ✓ | **adotada**: primeira vez que esta identidade passa em todas as réguas juntas |

O que a sequência ensina e vai para o padrão: pedir inclinação em graus *e* pedir boca funda na mesma frase faz
o modelo trocar uma pela outra — o que destravou foi tirar do prompt toda a linguagem de "olhe para dentro da
caixa" (que é o que empurrava o rolo para 15–18°) e deixar a inclinação só no **guia rolado** + numa frase de
foto ("como a foto de um celular, sem endireitar o objeto").

## Ronda 2 da praça — o que a régua nova de recorte devolveu

| | boca | inclinação | recorte | faixa | cheio |
|---|---|---|---|---|---|
| r1 | 2,39:1 (guia pedia 2,75) | −9,1° ✓ | **0,51 ✗** | 69 px | 1,02 |
| **r2** | **2,76:1** ✓ | **−10,4°** ✓ | **0,84** ✓ | 60 px (×1,101) | 1,02 |

O que mudou no texto: `[NOTHING INSIDE THE OPENING]` (a chapa de apoio, o prato de gordura, o suportes e a
mão do churrasqueiro ficam FORA do magenta; o único móvel permitido é parafusado por fora do corpo, abaixo da
linha do aro) e `[SIZE OF THE DRAWING]` dito como ordem de montagem — *"os blocos de concreto, o tijolo e as
pernas de vergalhão ficam DEBAIXO do bidão, dentro da largura do corpo"*. O recorte foi de 0,51 a 0,84 sem
tocar na boca: é a prova de que a régua de 0,72 não pedia boca maior, pedia desenho mais justo.
