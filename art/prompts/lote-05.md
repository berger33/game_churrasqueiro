# Lote 05 — reforço: maminha + escada de churrasqueiras (padrão `grill.art`)

Duas frentes no mesmo lote: (a) `spr_food_maminha_served` (recusada no lote 04 e pedida de
volta em célula limpa, já gerada acima); (b) **as grelhas**, refeitas sob o padrão único de
perspectiva/leito definido em `shared/data/grill.json` → `art`. Guia de cada arte:
`node tools/art/make-ref.mjs guide <out.png> 1408 --grill <id> --evo <n>`, e a régua que mede o
resultado: `node tools/art/check-grill-geometry.mjs --all`.

> **Regra deste lote: a boca define a moldura, nunca o contrário.** A geometria de cada quadro
> (1408×976, ×1344 ou ×1456) foi calculada a partir das vagas que o dado promete para aquela
> evolução, e o guia é o próprio pixel do enquadramento. O que se exige do modelo é a razão da
> abertura; o resto é estilo.

**Identidade visual por degrau (dado em `grill.json.visual`/`evolutions`, e é isso que o dono
lê na loja):**
- **lata** (`lata_amassada`): 1 zona × 2–3 vagas, tambor de 200 L deitado.
- **chapa** (`ze_da_esquina`): 2 zonas × 2–3 vagas, carrinho de chapa com toldo e fritadeira.
- **inox** (`parrilla_chef_cisma`): 3 zonas × 2–3 vagas, carreta de parrilla com altura ajustável.
- **fornalha** (`fornalha_dragao_manso`): 3 zonas × 3–4 vagas, alvenaria com chaminé.
- A escada de vagas é `2→3→3 | 4→4→6 | 6→6→9 | 9→9→12`; nenhum degrau pode reduzir a área útil,
  e a grade do jogo já garante isso (`check-grill-geometry.mjs`, item 2).

## Bloco comum (todo item deste lote)
```
[MOUTH_IS_THE_REF] A única geometria que importa é a da abertura de cocção. Meça o quadro do
guia: a boca deve ocupar ~80% da largura e o percentual de altura indicado na razão da boca —
nem mais estreita, nem mais rasa. É dentro dela que a comida do jogo é desenhada.
[STYLE] pixel art isométrica 2:1, fonte ¾, luz vinda de cima, contornos escuros e chapados,
plano frontal de apoio.
[SEPARATION] objeto isolado, sem plate, sem sombra projetada, sem piso, fundo sólido #FF00FF.
[NEGATIVE] sem comida, sem pessoas, sem fumaça, sem texto, sem brasas por cima da boca.
```

> **O que o modelo errou e por quê (roda 1 deste lote, medida):** pedimos "faixas de brasa dentro
> da boca". Ele obedeceu, pintou brasa até a borda e a abertura deixou de existir — a fornalha
> voltou sem furo nenhum e as duas grelhas de aço com um vão de perna como falso buraco
> (65×72 px e 85×56 px, o detector medindo o vão errado). **No master a boca é vazio magenta**:
> o fogo que arde na partida é desenhado pelo motor, faixa por faixa, em `drawGrillSprite`.
> A frase que funciona continua sendo a do lote 04 — `[MOUTH_IS_THE_REF]` + "the opening stays
> empty magenta" — e o braseiro vai na **frente** do corpo, abaixo da boca.

## Blocos

```
[MOUTH_IS_THE_REF] The magenta rectangle in the reference is not a region to leave free: it IS
the cooking opening, and it is the most important part of the image. Paint the grill so that its
top opening covers exactly that magenta rectangle — same left, right, top and bottom edge, same
width and height, top edge perfectly horizontal. Do not shrink it, do not move it, do not draw a
smaller opening inside the frame. The opening stays empty magenta: no grate, no coals, no ash,
no gloss, no food over it. Everything the grill has — rim, body, legs, wheels, shelf, chimney,
firebox front — is built around that opening, not instead of it.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient,
no floor, no cast shadows, no grid lines, no cell borders, no frames. No letters, numbers,
captions, labels or watermark anywhere. Nothing in the artwork itself is magenta or hot pink.
Pixel art, isometric 2:1 feel, three-quarter view from the front and above at about 55 degrees,
dark flat outlines, light from above, one single object.
```

## 1) `spr_grill_fornalha_dragao_manso_evo1` — "Tijolo Refratário" (3×3 = 9 vagas) *(ronda 2)*
Quadro do guia 1408×1344; **boca 1126×562 px = razão 2,0:1**, 80 % da largura e 42 % da altura.
**É o item que reprova no portão hoje** (ronda 1: boca de 95×40 px na folha, 40 px para comida
de 54 px). Brasa na frente do corpo, nunca dentro da boca.

## 2) `spr_grill_ze_da_esquina_evo1` — "Dois Corações" (2×2 = 4 vagas) *(ronda 2)*
Quadro 1408×976; **boca 1126×406 px = razão 2,8:1**. R1 deu 65×72 px de falso buraco.

## 3) `spr_grill_parrilla_chef_cisma_evo1` — "Inox Brilhando" (3×2 = 6 vagas) *(ronda 2)*
Quadro 1408×1456; **boca 1126×611 px = razão 1,85:1** (quase quadrada). R1 deu 85×56 px.

## 4) `spr_grill_ze_da_esquina_evo2` — "Toldo Novo" (2×2 = 4 vagas)
Mesma boca do item 2 — o degrau acrescenta toldo, bandeja e copertura, **nunca encolhe o leito**.

## 5) `spr_grill_parrilla_chef_cisma_evo2` — "Altura Regulável" (3×2 = 6 vagas)
Mesma boca do item 3; o que muda é a manivela de altura e a prateleira tubular.

## 6) `spr_grill_ze_da_esquina_evo3` — "Com Fritadeira" (2×3 = 6 vagas)
Boca 1126×373 px = **razão 3,0:1** em quadro 1408×896 (o leito cresce para 359 px, então a
boca fica mais larga e mais rasa que a dos degraus 1–2). Acrescenta a fritadeira lateral.

## 7) `spr_grill_fornalha_dragao_manso_evo2` — "Duas Bocas" (3×3 = 9 vagas)
Razão 2,0:1 como o e1: o degrau ganha bancada de pedra e segunda chaminé, não mais vagas.

## 8) `spr_grill_parrilla_chef_cisma_evo3` — "8 espetos"? não — ver §Dados abaixo (3×3 = 9 vagas)
Razão 2,0:1 em quadro 1408×1344, tacho de gordura maior e quebra-chamas.

## 9) `spr_grill_fornalha_dragao_manso_evo3` — "Três Bocas" (3×4 = 12 vagas)
Razão 2,28:1 em quadro 1408×1184, boca de 1126×494 px: é o único degrau do jogo com 4 vagas por
zona, e por isso o mais achatado de todos.

## Dados que estes prompts corrigem
`shared/data/grill.json` prometia, em `l10n`, "3 fileiras, 7 espetos" para `parrilla_chef_cisma`
evo2 e "8 espetos" para evo3, enquanto a grade diz 3×2 = 6 e 3×3 = 9. A descrição mentiu sobre a
progressão; foi consertada na própria tabela (nada de arte cobre erro de texto).

---

## Ronda 3 (2) — as duas bocas que ainda reprovam, e o que a medição ensinou

| grelha | pedida | pintada | leitura |
|---|---|---|---|
| fornalha e1 | 1,99:1 | 2,88:1 | "WIDE" demais: o modelo abriu uma fresta comprida e a faixa ficou com 46 px |
| inox e1 | 1,83:1 | 1,32:1 | virou quadrada **e** o topo entortou 16,5° (a manivela enganou o eixo) |

A lição é que razão numérica não é instrução para modelo de difusão: ele não mede pixels. O que
funciona é amarrar a boca a **outra parte do próprio objeto**, e o guia já recorta isso — a altura
da abertura é igual à altura de tudo que existe abaixo dela. A instrução passa a ser essa, e o
"topo horizontal" volta a ser dito em palavras, com o objeto que costuma entortá-lo nomeado.

### R3.1 · `spr_grill_fornalha_dragao_manso_evo1.png` (ref: `guides/g_fornalha_e1.png`)
> [STYLE] Subject: "Fornalha do Brasa Braba, o Dragão Manso", level 1 — big Brazilian masonry
> barbecue of light warm firebricks with thick mortar joints, heavy stone counter lip around the
> opening, wide plinth base with a small ash door, short brick chimney at the back left corner with
> a small wrought-iron dragon weathervane. The fire is NOT in the opening: a broad band of glowing
> orange embers seen through a brick vent on the FRONT FACE below the opening, split into three
> stacked rows by thin brick bars. [MOUTH] The cooking opening is a rectangle twice as wide as it
> is tall, and it is EMPTY MAGENTA. Use a proportion you can see in the object itself: the height
> of the opening equals the combined height of everything below it — the ember front panel plus the
> plinth base. Its top edge and its bottom edge are straight, horizontal and parallel to each
> other. Do not draw a narrow slit, and do not draw a tall window: it is a 2 : 1 rectangle.
> [TECH] + frame 1408×1360.

### R3.2 · `spr_grill_parrilla_chef_cisma_evo1.png` (ref: `guides/g_inox_e1.png`)
> [STYLE] Subject: "Parrilla do Chef Cisma", level 1 — polished mirror-finish stainless-steel
> parrilla firebox on four neat steel legs with two solid wheels, a round fat-catching drip bowl
> hanging underneath, a small round thermometer on the front panel; the height-crank handle is
> small and must NOT tilt the firebox. The fire is NOT in the opening: three horizontal bands of
> glowing embers behind steel vents on the FRONT FACE below the opening. [MOUTH] The cooking opening
> is a WIDE rectangle — clearly wider than tall, ratio 1.85 : 1 — and it is EMPTY MAGENTA, no
> grate, no coals, no food. Its height equals the combined height of the firebox front panel plus
> the legs and drip bowl below it. Top edge perfectly horizontal: the whole cart stands level, the
> crank is an accessory, not a reason to tip the firebox. [TECH] + frame 1408×1472.
