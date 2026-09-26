# Lote 10 — a grelha a gás, pela sexta vez: profundidade em vez de mais rolo

Veredito dele sobre o lote 09: **"somente a gás precisa ser refeita. As outras estão aprovadas."** As duas
aprovadas (bidão da praça, defumador com tampa) medem −10,4° e −10,3° e já estão no atlas. A reprovada, a
r5 da gás, media −7,0° com a boca 1,73:1 e o recorte 0,77 — verde nas três réguas do padrão e mesmo assim
fora. Então a régua não é o que ele está olhando.

O que muda de diagnóstico, lendo as seis rodadas da identidade contra as artes que ele assinou:

| rodadas da gás | o que foi pedido | o que veio |
|---|---|---|
| L07 r1 · L08 r1–r3 · L09 r1–r5 | boca funda e/ou objeto rolado dentro do teto de 12° | 5,6:1 rasa · 0° de rolo · −15° · 3,5:1 · −18,3° · −4° · **−7° ✓** |

Todas as versões "aprováveis" da gás são **uma caixa vista de frente**: rolada ou não, uma caixa retangular
lê *planta*, porque nada nela curva. As três artes que ele assinou nesta mesma leva (bidão, defumador, lata)
têm em comum o cilindro: a tampa/redação do corpo mostra a **parede interna** e o **aro visto de cima**, e é
isso que o olho dele chama de "inclinação na imagem". Pedir mais rolo para uma caixa é encher o vão de
comida torta; o eixo certo é **virar o objeto** e deixar a profundidade aparecer:

- **guinada (yaw) de ~18°** em torno do eixo vertical: a face frontal inteira + uma tira da lateral
  esquerda, que é o que faz um eletrodoméstico parecer ocupando espaço;
- **câmera 25–30° acima do aro**: o vão vira um trapézio com a borda de trás ~20 % mais curta que a de
  frente, e a parede interna funda da caixa aparece como uma faixa escura com calor — sem nada pintado
  *dentro* do magenta, que continua sendo o vão;
- **rolo de 5°** só (o guia já vem rolado 5°, `make-ref --roll 5`), para o chão da foto não estar
  endireitado;
- a âncora de câmera é a **folha das duas aprovadas agora** (`ref_cameras_aprovadas.png`: defumador −10,3°
  e lata −8,6°) — copiar a quantidade de mundo que elas mostram, não o objeto.

Dois candidatos, porque a decisão é dele e a régua já provou que não mede o que ele vê:

- **A — capô fechado, guinada e parede interna.** Menos risco na boca (foi a configuração que passou em
  tudo na r5) e a leitura de inox de catálogo, com profundidade.
- **B — tampa entreaberta a ~45°, guinada e parede interna.** A face interna da tampa escovada é o maior
  plano de profundidade disponível para uma grelha a gás; o risco conhecido é o modelo fechar a boca para
  acompanhar a tampa (foi assim que ela virou 3,5:1 na r2), então o bloco `[MOUTH]` vem repetido duas vezes.

## Bloco de câmera comum (os dois)

```
[CAMERA] A photograph of a real appliance, not a catalogue elevation. The grill is TURNED about 18 degrees
around its vertical axis, so we see its whole front face AND a narrow strip of its left side panel
receding away from us; the camera sits 25–30 degrees ABOVE the cooking rim, looking slightly down into the
deep cooking box; and the whole frame is tipped by only about 5 degrees, the way a phone photo is tipped,
so the base runs gently uphill to the right. Because of that height the cooking opening is a TRAPEZOID seen
in perspective: its far edge is about 20 % shorter than its near edge, and a dark band of the box's inner
back wall is visible above the far edge, warmed by the fire below. This is the same amount of world the
two approved grills in the last reference image show — copy how much depth they show, not what they are.
This is NOT isometric: one front face, one side sliver, one rim; no diamond floor, no oval bed.
[MOUTH] The FIRST reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta quadrilateral inside it, tipped by those few degrees. That quadrilateral IS the cooking opening:
paint the object so its opening covers exactly that magenta shape — same four corners, same width, same
height, same tip. The opening is 1.99 times wider than tall: its height is HALF its width, tall enough for
three rows of food with room to spare. Do not shrink it, do not flatten it into a wide slit, do not draw a
smaller opening inside the frame. The opening stays EMPTY MAGENTA: no grate, no bars, no flames, no coals,
no ash, no food, no gloss, nothing painted there — the game draws the food and the heat bands itself.
[SIZE OF THE DRAWING] The magenta opening must span 80–89 % of the width of the FINISHED DRAWING, and the
whole grill — hood or open lid, control panel, cabinet, wheels, side sliver — must fit inside one rectangle
only 10 % wider than the opening. Folded-down side shelves stay inside the body's width; a towel bar, tool
hook, bottle or cover that widens the drawing is left out. [ENCLOSED] the magenta never touches the
background magenta on any side: rim above, panel below.
[TECH] Flat uniform pure magenta (#FF00FF) background: no gradient, no floor, no cast shadow, no grid, no
frame. Nothing in the artwork is magenta or hot pink. Premium 2D mobile game art for a Brazilian churrasco
game: stylized hand-painted look, soft 3D volume, subtle dark-brown outline, rich saturated colour, glossy
highlights, warm golden-hour key light from the upper left. One single object, centred, filling a portrait
frame. [NO TEXT] no letters, numbers, words, logos or chalkboards anywhere.
```

## A — capô fechado

```
[STYLE] A modern stainless-steel gas grill, tall and substantial, brushed steel with a rolled rim: a DEEP
open cooking box under the rim; a CLOSED hinged hood above it, its lid edge carrying a blank round
thermometer dial; a control panel below the opening with three chunky black blank knobs and one red
ignition button; a black two-door cabinet below with two chunky wheels and a warm flame glow behind a steel
mesh band across the cabinet front — three rows of flame ports, the fire never inside the opening. Clean,
precise, no brick and no soot: this level sells speed, and at this price the player expects a machine.
```

## B — tampa entreaberta

```
[STYLE] A modern stainless-steel gas grill, tall and substantial, brushed steel with a rolled rim: a DEEP
open cooking box under the rim, and its hinged lid raised to about 45 degrees behind the opening, its inner
brushed face catching the light and its silhouette staying inside the width of the body — the lid is a lid,
not a wall, and it never crosses in front of the opening. A control panel below the opening with three
chunky black blank knobs and one red ignition button; a black two-door cabinet below with two chunky wheels
and a warm flame glow behind a steel mesh band across the cabinet front — three rows of flame ports, the
fire never inside the opening. Clean, precise, no brick and no soot: this level sells speed.
[MOUTH-AGAIN] Raising the lid does NOT shorten the opening: the magenta keeps its full height (half its
width). A grill whose opening became a letterbox while the lid grew is a failed drawing — that is the
single defect this item has been refused for.
```

Referências (o `art/source/` não é versionado; o comando refaz tudo):

```
node tools/art/make-ref.mjs guide art/source/lote-10/guides/g_fornalha_dragao_manso_e1.png 1408 --grill fornalha_dragao_manso --evo 1 --roll 5
node tools/art/make-ref.mjs grid  art/source/lote-10/refs/ref_cameras_aprovadas.png 2200 1000 2 1 spr_grill_tambor_vertical_evo1 spr_grill_lata_valente_evo1
```

## Aceite

As mesmas réguas do lote 09, sem exceção: |rolo| entre 4° e 12°, boca entre 0,72 e 0,90 do recorte, `cheio`
≥ 0,85, faixa de brasa ≥ 60 px por fileira, razão da boca dentro de ±25 % da pedida, e conform ≤ ×1,4. Além
delas, a que ele cobra com o olho: **a caixa tem de parecer funda** — parede interna visível, lateral do
corpo aparecendo, e nenhuma das duas coisas tocando o magenta.

## O que A e B mediram — e por que o "olhe de cima" é geometria contra a gente

| candidato | boca medida | faixa por fileira | recorte | rolo | conform necessário |
|---|---|---|---|---|---|
| A (capô fechado, câmera 25–30° acima) | **3,84:1** ✗ | 31 px ✗ | 0,75 ✓ | −5,0° ✓ | ×1,94 ✗ (teto ×1,7) |
| B (tampa a 45°, mesma câmera) | **4,59:1** ✗ | 26 px ✗ | 0,71 ⚕ | −4,4° ✓ | ×2,31 ✗ |

Os dois vieram fundos (profundidade lida) e a boca raso. Não é teimosia do modelo, é projeção: **uma grelha
horizontal vista de cima fecha verticalmente na tela** — quanto mais alto o ângulo, mais achatada a boca. Como
a grade 3×3 exige 180 px de vão, "olhe de cima para a cama de brasa" e "boca com altura" são ordens inimigas.

A solução já está nas artes que ele assinou: no defumador e na praça o vão **não é a boca de cima da caixa, é o
recorte aberto na PAREDE FRONTAL**, um plano vertical virado para a câmera (como a janela de um forno). Um plano
vertical não fecha com a elevação da câmera — ele mantém a altura — e a profundidade vem do resto: a guinada de
18°, a tira da lateral do corpo, a tampa aberta mostrando a face interna escovada, o brilho de calor no vão.
Ronda 6, portanto: `[MOUTH-PLANE]` dito como parede frontal, elevação baixa (10–15°), tampa a 45°, guinada.

## Ronda 6 e 7 — a régua dele e a minha finalmente na mesma frase

| candidata | boca | faixa | recorte | rolo do vão | veredito meu |
|---|---|---|---|---|---|
| A — capô fechado, câmera 25–30° acima | 3,84:1 ✗ | 31 px | 0,75 | −5,0° | fundo, mas boca de carta de restaurante |
| B — tampa a 45°, mesma câmera | 4,59:1 ✗ | 26 px | 0,71 ⚕ | −4,4° | a tampa comeu a altura do vão |
| r6 — vão na parede frontal, 10–15° | 2:1 ✓ | 60 px ✓ | 0,60 ⚕ | **−3,6°** ⚕ | a mais tridimensional das quatro; o vão ficou de nível e o corpo alto apertou o recorte |
| **r7 — parede frontal + rolo de 8° pedido como ordem, corpo largo** | **2:1 ✓ (×1,176)** | **60 px ✓** | **0,74 ✓** | **−7,2° ✓** | **adotada**: verde nas três réguas pela primeira vez com a câmera que ele pede |

As duas lições que ficam no padrão, uma por linha:

1. **Numa grelha de caixa, o vão é a janela da parede frontal, não a cama de brasa vista de cima.** Pedir
   elevação alta é pedir boca rasa: a projeção fecha o plano horizontal na mesma proporção em que abre a
   profundidade que eu queria. Os cilindros aprovados escapam disso porque o corpo redondo mostra a curva da
   tampa mesmo com a câmera baixa.
2. **Com o corpo em guinada (yaw), a boca de nível é o resultado geométrico correto** — as arestas verticais
   ficam verticais e as horizontais ficam horizontais quando só se gira em torno do eixo vertical. Então a
   inclinação que a régua mede precisa ser pedida como rotação do quadro inteiro, e dita com número e com o
   chão na frase ("o chão das rodas sobe para a direita"), não como adjetivo.
