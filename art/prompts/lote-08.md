# Lote 08 — as quatro regravações que o dono mandou refazer (3, 4, 6 e 7 do lote 07)

Veredito dele sobre o lote 07: **"3, 4, 6 e 7 pode refazer, as outras estão aprovadas."** Aprovadas e
já no `approved` do registro: o bidão cortado (`grelha_de_praca`), o espeto motorizado
(`parrilla_chef_cisma`), a parrilla argentina (`parrilla_do_cais`), o inox multi-nível
(`fornalha_da_orla`) e a robótica (`cozinha_do_campeao`). A fogueira do nível zero **não pôde ser
aprovada**: o `set-status.mjs` exige medição de boca/leito para grelha, e sem id em
`churrasqueiras.json` não há o que medir — a trava é do próprio pipeline, e ela existe para ninguém
assinar arte que o motor não consegue usar. Ela vira `approved` no commit em que o slot do nível zero
entrar no dado.

As quatro rejeitadas por ele, e o defeito de cada uma medido por mim (não pelo olho):

| item do lote 07 | sprite | boca × recorte | faixa | o que fazer |
|---|---|---|---|---|
| 3 tijolo a seco | `spr_grill_ze_da_esquina_evo1` | 0,48 | 61 px ✓ | boca no tamanho certo, **recorte largo demais** (vergalhão + tijolo de apoio + tábua esticaram os lados) |
| 4 quintal de alvenaria | `spr_grill_espeto_do_neno_evo1` | 0,42 | 71 px ✓ | idem: bancada lateral, tábua e saleiro para fora do corpo |
| 6 defumador com tampa | `spr_grill_tambor_vertical_evo1` | 0,51 | 60 px ✓ | a tampa aberta virou um painel escuro alto que pesa mais que a grelha |
| 7 a gás | `spr_grill_fornalha_dragao_manso_evo1` | 0,49 | **21 px ✗** | boca rasa (5,6:1 contra 1,99:1) + side shelves; o conform pediria ×2,81 (teto ±70 %) |

A régua nova do lote 07 entra como piso: **`MOUTH_WIDTH_HINT = 0,72`** — a boca tem que ocupar ao menos
72 % da largura do *recorte final*. A lata aprovada ocupa 0,83; as quatro acima, 0,42–0,51. Como o
motor escala a grelha inteira na loja (`s = min(bedW / spriteW, …)`) e limita a escala do jogo pela
tela (`s = min(bedW / mouthW, (W − 12) / spriteW)`), recorte largo com boca parada = leito apertado no
cartão e comida encostando na partida. É por isso que o bloco abaixo existe:

```
[NO SIDE FURNITURE] The magenta opening must span 80–89 % of the width of the FINISHED DRAWING, the way
it does in the proportion reference image. Everything the object has — side trays, tool racks, coal
hoppers, cutting boards, salt cellars, chimneys, awnings, baskets — must stay INSIDE the width of the
body's own silhouette, tucked under the opening or behind it; nothing may stick out to the left or to
the right of the opening. If a detail does not fit inside that width, leave the detail out: a narrower,
cleaner object beats a wide one with a small opening. The trim of the drawing must hug the body, so the
opening stays wide.
```

Guias (do dado, boca derivada da grade de cada grelha) e a âncora de proporção:

```
node tools/art/make-ref.mjs guide art/source/lote-08/guides/g_<id>_e1.png 1408 --grill <id> --evo 1
node tools/art/make-ref.mjs single art/source/lote-08/refs/ref_proporcao_lata_976.png 1408 976 spr_grill_lata_valente_evo1
node tools/art/make-ref.mjs single art/source/lote-08/refs/ref_proporcao_lata_1360.png 1408 1360 spr_grill_lata_valente_evo1
```

## Bloco comum (as quatro)

```
[CAMERA] Front view, seen from slightly above (about 15–20 degrees), the whole object standing level. The
cooking opening is an axis-aligned rectangle whose top and bottom edges are horizontal lines parallel to
the top of the image and whose left and right edges are vertical. This is NOT isometric and NOT aerial:
no parallelogram, no diamond, no oval opening.
[MOUTH] The FIRST reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta rectangle inside it. That rectangle IS the cooking opening: paint the object so its opening
covers exactly that magenta rectangle — same left, right, top and bottom edge, same width, same height.
Do not shrink it, do not move it, do not draw a smaller opening inside the frame. The opening stays
EMPTY MAGENTA: no grate, no bars, no coals, no ash, no food, no gloss, nothing crossing it — the game
draws the food and the heat bands there itself.
[FIRE] The fire is never inside the opening: a wide horizontal window of glowing embers in the FRONT FACE
of the body, immediately below the opening.
[ROWS] The height of the opening IS the row count the shop promised, one band per row. Never fill leftover
height with a taller rim, a splash guard or a shelf inside the opening.
[NO SIDE FURNITURE] (o bloco inteiro, acima)
[NO TEXT] No letters, numbers, words, signboards, logos, chalkboards or menu boards anywhere.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no floor,
no cast shadows, no grid lines, no cell borders, no frames. Nothing in the artwork itself is magenta or
hot pink. Premium 2D mobile game art for a Brazilian churrasco game: stylized hand-painted look with soft
3D volume, subtle dark-brown outline, rich saturated natural colours, glossy highlights, warm
golden-hour key light from the upper left. One single object, centred, filling the frame.
```

## As quatro

1. **`spr_grill_ze_da_esquina_evo1`** — tijolo simples, sem reboco (2×2, boca 2,75:1, quadro 1408×976)
   > [STYLE] A barbecue of stacked red bricks with NO mortar and no plaster: dry-stacked, slightly uneven
   > courses, chipped corners, inside faces soot-blackened. The brick walls are exactly as wide as the
   > opening plus one brick on each side — the drawing hugs the body. Two rebar rods lie across the top
   > OUTSIDE the magenta at the left end, held by a single brick. One flat brick course below the opening
   > carries two rows of glowing embers, and an ash shelf of one brick under them. No side counter, no
   > tray, no tool rack, no chimney, no paint. The SECOND reference shows how wide the opening is
   > relative to the whole object: match that proportion.

2. **`spr_grill_espeto_do_neno_evo1`** — quintal comum de alvenaria (2×3, boca 2,99:1, quadro 1408×912)
   > [STYLE] The recognisable Brazilian backyard barbecue: plastered and whitewashed masonry body with a
   > warm terracotta-painted trim, a tiled rim around the opening, a short plastered chimney rising at the
   > BACK LEFT behind the body (its width inside the body's own width), and a small iron ash door in the
   > plinth below the ember band. The counter is a simple tile shelf at the right end that stops at the
   > body's width — no board, no salt cellar, no bottles sticking out. Two rows of glowing embers behind a
   > blackened iron band in the front face. First grill that looks finished and cared for.

3. **`spr_grill_tambor_vertical_evo1`** — defumador com tampa (3×3, boca 1,99:1, quadro 1408×1360)
   > [STYLE] An offset smoker built from a big horizontal black-painted steel barrel: the barrel's front
   > is cut open into a tall near-square opening (1,99 times wider than tall). The domed lid is only
   > HALF-OPEN — it tilts up about 30 degrees behind the opening, low and short, so it reads as a lid and
   > not as a big dark panel, and its silhouette stays within the barrel's width. A compact firebox box at
   > the left end with its own door, a short chimney at the right end with a butterfly damper, one blank
   > round gauge on the barrel front, two small wheels under the middle. Soot and heat-blued paint; three
   > rows of embers in the firebox front below the opening.

4. **`spr_grill_fornalha_dragao_manso_evo1`** — a gás com queimadores (3×3, boca 1,99:1, quadro 1408×1360)
   > [MOUTH-AGAIN] The opening is a BIG, TALL, nearly SQUARE window: 1,99 times wider than tall, as tall
   > as the front panel plus the cabinet below it. A wide shallow slit is a failed drawing — that is the
   > single reason this item was refused.
   > [STYLE] A modern stainless-steel gas grill: brushed-steel body with a rolled rim and a DEEP open
   > cooking box on top; a hinged lid standing open behind the opening, its inner brushed face toward the
   > viewer, its width inside the width of the body; a front control panel with three chunky black blank
   > knobs and one red ignition button; a black two-door cabinet below with two chunky wheels. The side
   > shelves are FOLDED DOWN (not sticking out to the sides) so the drawing hugs the grill. Warm flame
   > glow behind a steel grille band in the cabinet front — three rows. Clean, precise, no brick, no
   > soot: this level sells speed.

## Aceite

Processadas por `process-sprites.mjs art/lote-08.json` (conform ligado, recorte e medição no mesmo
turno), medidas por `check-grill-geometry.mjs --all` — que hoje imprime a coluna `b/larg` e o aviso
`⚕` — e montadas em `art/review/lote-08.jpg` + `art/review/lote-08-preview.jpg`. Linhas rejeitadas são
re-adotadas pelo lote novo com nota (`docs/04` §11). `approved` continua sendo decisão só dele.

## Ronda 2 do lote 08 — o que mudou no prompt, e o que a medição devolveu

O `[NO SIDE FURNITURE]` da primeira passada não bastou para três das quatro: o modelo obedece "nada para
os lados" pintando o corpo mais *gordo* para dentro do próprio recorte. A instrução que funcionou foi
dar a moldura como conta: **`[SIZE OF THE DRAWING]` — "o desenho inteiro cabe num retângulo 10 % mais
largo que a boca"** (o guia é 0,89 de corpo para 0,80 de boca = 1,11, o mesmo número dito em prosa). Para
a grelha a gás foi preciso um terceiro ajuste, este de detecção: `[ENCLOSED]` — "a boca é um buraco
cercado pelos quatro lados; o magenta da boca não pode tocar o magenta do fundo em lugar nenhum". A
ronda 2 tinha pedido "tampa removida, só fundo magenta acima da boca" e o `process-sprites` voltou com
**704×963 sem furo nenhum**: boca encostada na borda de recorte é fundo, não boca.

| sprite | r1 | r2/r3 | leito | b/larg | veredito meu |
|---|---|---|---|---|---|
| `spr_grill_tambor_vertical_evo1` | 0,51 | **1,99:1 · faixa 60 px · 0,85** | ok | ✓ acima do piso | **a melhor do lote**: tampa entreaberta baixa, boca quadrada no ponto exato do guia. Aprovável sem ressalva. |
| `spr_grill_fornalha_dragao_manso_evo1` | sem furo (704×963) | 1,45:1 · faixa 83 px · 0,64 (conform ×0,889) | ok | ⚕ | **a boca alta que o item pedia**: veio até alta demais e o conform ajeitou. Falta só encolher o recorte — se ele aceitar 0,64, ela serve; se não, a r4 tem um caminho claro (tampa fechada mais rasa). |
| `spr_grill_ze_da_esquina_evo1` | 0,48 | 1,72:1 · faixa 96 px · 0,48 | ok | ⚕ | boca confortável (96 px é folgado), mas o modelo pintou tijolo e chão de areia para os lados; o recorte continua largo. Rejeitável com razão, ou aprovável: mecanicamente segura. |
| `spr_grill_espeto_do_neno_evo1` | 0,42 | 2,23:1 · faixa 81 px · 0,44 | ok | ⚕ | mesma história: leito resolvido, recorte não. O "quintal acabado" que ele descreveu está aqui, e a boca está em 2,23:1 contra 2,99:1 do guia (ainda dentro da tolerância). |

## O que este lote expôs no pipeline (e foi consertado aqui)

Rodar `build-runtime` sem `--dry-run` — que é o que se faz quando o dono **aprova** — apagou o atlas e o
re-codificou a partir do que é aprovado: 124 sprites. O `check-art-registry` caiu com seis linhas
dizendo que `art/frozen-atlas.json` prometia bytes que não estavam mais lá. Lendo a promessa: ela dizia
"o atlas continua servindo os **bytes antigos aprovados**" para cinco estados da maminha e a fornalha do
lote 05, e nenhuma das seis passou por `approved` em commit nenhum (conferido em `0479ed7` e `a26408d`).
O atlas em serviço embarcava **`pending`** — 125 sprites para 119 aprovados — e o congelamento declarado
era a frase que escondia isso.

Ficou assim: lista de congelamento esvaziada com a história escrita dentro do arquivo (versão 2), e o
`build-runtime` passa a **recusar** lista declarada sem os PNGs correspondentes em `art/frozen-atlas/`.
"O atlas continua servindo" ou é verdade verificável ou não é argumento. O atlas de hoje é aprovado-only
(124) e as grelhas sem aprovação caem no fallback procedural, que é o contrato honesto até ele decidir.
