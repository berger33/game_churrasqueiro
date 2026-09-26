# Lote 06 — escada das churrasqueiras: as 6 evoluções que nunca tiveram arte

Padrão: `shared/data/grill.json` → `art` (docs/04 §5.1, docs/22 §6.8). Guia de cada arte:
`node tools/art/make-ref.mjs guide <out.png> 1408 --grill <id> --evo <n>`; régua:
`node tools/art/check-grill-geometry.mjs --all`. Conform de boca quando o modelo erra a razão:
`node tools/art/conform-mouth.mjs --all` (documentado no lote 05 — aqui ele é previsto, não escondido).

Regras que valem para as seis, e que vieram das três rondas do lote 05:

- **a boca é vazio magenta.** Brasa dentro da boca apaga a boca (foi o erro da ronda 1: fornalha
  voltou sem furo, as duas de aço com um vão de perna de 65×72 px como falso buraco). O fogo vai na
  **frente do corpo**, abaixo da boca.
- **o degrau acrescenta em cima, nunca dentro.** Boca e razão são as do guia; o que muda é
  toldo, fritadeira, manivela, termômetro, bancada. `2×2 → 2×2` (Toldo Novo) mantém o leito.
- **sem letreiro.** A chapa do lote 05 veio com "GRELHA DO ZÉ DA ESQUINA" pintado na lateral — o
  prompt proibia texto e mesmo assim o modelo escreveu. Aqui a proibição é nomeada.
- o modelo não mede pixels: a razão é dita por **comparação interna** ("a altura da boca é a altura
  de tudo que existe abaixo dela"), que é como o guia é montado.

| # | sprite | grade | boca no guia | razão |
|---|---|---|---|---|
| 1 | `spr_grill_ze_da_esquina_evo2` | 2×2 (4) | 1126×410 | 2,75:1 |
| 2 | `spr_grill_ze_da_esquina_evo3` | 2×3 (6) | 1126×377 | 2,99:1 |
| 3 | `spr_grill_parrilla_chef_cisma_evo2` | 3×2 (6) | 1126×614 | 1,83:1 |
| 4 | `spr_grill_parrilla_chef_cisma_evo3` | 3×3 (9) | 1126×565 | 1,99:1 |
| 5 | `spr_grill_fornalha_dragao_manso_evo2` | 3×3 (9) | 1126×565 | 1,99:1 |
| 6 | `spr_grill_fornalha_dragao_manso_evo3` | 3×4 (12) | 1126×497 | 2,27:1 |

## Bloco comum

```
[GUIDE] The reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta rectangle inside it. That rectangle is the cooking opening — keep its place, its size, its
straight horizontal top and bottom edges. The opening stays EMPTY MAGENTA: no grate, no bars, no
coals, no ash, no food, no gloss inside it; the game draws the food there itself. Everything the
grill has — rim, body, legs, wheels, shelf, chimney, firebox front — is built AROUND that opening,
not instead of it.
[RATIO] The opening's height equals the combined height of everything below it (front panel + base).
That is the proportion to copy; do not make the opening square and do not make it a narrow slit.
[NO TEXT] No letters, numbers, words, signboards, logos or menu boards anywhere in the image.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no
floor, no cast shadows, no grid lines, no cell borders, no frames. Nothing in the artwork itself is
magenta or hot pink. Pixel art, isometric 2:1 feel, three-quarter view from the front and above at
about 55 degrees, dark flat outlines, light from above, one single object standing level.
```

## As seis

1. **`spr_grill_ze_da_esquina_evo2.png`** — "Toldo Novo" (2×2, o leito NÃO muda)
   > [STYLE] Same cart as the level-1 "Grelha do Zé da Esquina": long dark seasoned-steel firebox,
   > faded red-brown painted front panel, two spoked wheels, small side shelf, short chimney back
   > left. The one upgrade: a striped cloth awning on two thin poles, open above and behind the
   > grill, casting no shadow onto the opening. Fire in the FRONT FACE below the opening: two rows of
   > glowing embers behind a steel vent.

2. **`spr_grill_ze_da_esquina_evo3.png`** — "Com Fritadeira" (2×3 = 6 vagas, boca mais larga e rasa)
   > [STYLE] The same cart, now busier: a deep round frying basket and a small oil pot bolted to the
   > right end of the body, a stack of paper cones on the lower shelf. The opening grows WIDER (three
   > slots per row) and stays a strict rectangle. Two rows of embers in the front face.

3. **`spr_grill_parrilla_chef_cisma_evo2.png`** — "Altura Regulável" (3×2, mesma boca do e1)
   > [STYLE] The same stainless parrilla firebox on its four legs and two wheels, but the whole
   > grate assembly hangs one notch higher, with the crank handle extended and a bright turn of cable
   > visible; a tubular shelf added under the firebox. Opening unchanged in size — the chef raises
   > the food, he does not eat the workspace. Three rows of embers behind steel vents in the front
   > face.

4. **`spr_grill_parrilla_chef_cisma_evo3.png`** — "Termômetro que Não Mente" (3×3)
   > [STYLE] The same parrilla, third level: a large round dial thermometer mounted prominently on
   > the front right of the firebox (blank dial, no numbers), a wider firebox with three separate vent
   > columns, a small side burner box on the left. Opening wide and level, three rows of embers.

5. **`spr_grill_fornalha_dragao_manso_evo2.png`** — "Dragão Acordado" (3×3, mesma boca do e1)
   > [STYLE] The same firebrick masonry barbecue of the level-1 fornalha — light warm bricks, thick
   > mortar joints, flat stone counter lip, plinth base with ash door, short brick chimney back left
   > with the little wrought-iron dragon weathervane. The upgrade is character, not geometry: the
   > dragon is now mid-roar with a small flame curl above the chimney, and the front brick face gets
   > a second, wider ember vent. Same big rectangular opening, three rows of embers in the front face.

6. **`spr_grill_fornalha_dragao_manso_evo3.png`** — "Inferno Bom" (3×4 = 12 vagas, a boca mais larga do jogo)
   > [STYLE] The fornalha at full size: the same brick, but now a double-wide wall with a stone
   > worktop running along the front, the chimney taller, the dragon weathervane with two flame
   > curls. The opening is the widest in the game (four slots per row), a long strict rectangle,
   > about twice as wide as it is tall; four ember vents stacked in the front face below it.

## Aceite

Nada entra no runtime sem o dono aprovar. O portão mede as seis na hora (`check-grill-geometry.mjs
--all`): boca ≥ 60 px por faixa, vaga ≥ 86 px (73 px no 3×4, que é o piso do procedural), topo ≤ 12°,
e a escada de vagas monotônica. Arte que precisar de conform acima de ±70 % é regenerada, não
espremida.

---

## Ronda 2 — a câmera estava no meu prompt, não no modelo

Medido na primeira passada (`process-sprites` com conform ligado):

| arte | boca | razão | topo | veredicto |
|---|---|---|---|---|
| chapa e2 | 284×131 | 2,17:1 | dentro | **ok, sem conform** |
| inox e3 | 753×397 | 1,90:1 | dentro | **ok, sem conform** |
| inox e2 | 504×275 | 1,83:1 após ×1,353 | dentro | ok conformado |
| chapa e3 | — | — | **−40°** | FALHA — boca em losango |
| fornalha e2 | — | 1,45:1 após ×0,752 | **−16,3°** | FALHA |
| fornalha e3 | — | 1,64:1 após ×0,775 | **−20,1°** | FALHA |

A culpa é minha: o bloco pedia `isometric 2:1 feel` **e** "topo e base horizontais". Numa projeção
isométrica a face de cima de uma caixa É um paralelogramo — as três reprovas são o modelo obedecendo
à primeira frase e traindo a segunda. A régua não se move (12° é a diferença de câmera tolerada entre
a lata aprovada a −8,6° e o resto da escada); o que se move é a descrição da câmera, que passa a ser
explícita e a primeira coisa lida:

```
[CAMERA] Straight-on front view, only slightly from above (about 15–20 degrees): the cooking opening
is an axis-aligned rectangle in the image — its top edge and its bottom edge are HORIZONTAL lines,
parallel to the top of the image, and its left and right edges are vertical. This is NOT an
isometric or aerial drawing: do not slant the opening into a parallelogram or a diamond; the grill
stands level like a photograph of a wall.
```

Regeradas: `spr_grill_ze_da_esquina_evo3`, `spr_grill_fornalha_dragao_manso_evo2`,
`spr_grill_fornalha_dragao_manso_evo3`. Conform continua ligado na entrada — mas ele conserta
*proporção* de boca, nunca *inclinação*: cisalhar o desenho para endireitar a boca deformaria roda,
tacho e tijolo junto, e três artes de nove não podem redefinir o que é a câmera do jogo.

### Ronda 2 — prompts exatos (gravados antes de gerar)

`[CAMERA]` + `[GUIDE]` + `[RATIO]` + `[NO TEXT]` + `[TECH]`, mesma estrutura de cima. O que muda é o
eixo da câmera: `"the top edge and the bottom edge of the opening are HORIZONTAL lines in the image,
parallel to the top edge of the image"` vem antes de qualquer descrição de estilo, e a frase
`isometric 2:1` sai do bloco [TECH] destas três (fica apenas `three-quarter view from slightly above,
about 15–20 degrees`).

### Ronda 3 — `spr_grill_parrilla_chef_cisma_evo3` (única geração restante no turno)

Motivo da regia: na primeira passada esta arte veio com a **razão certa** (1,90:1, célula 86×63) e
reprovou só pelo topo a −17,1° — câmera torta, não boca errada. É o item de maior probabilidade por
geração gasta. A chapa e3 continua fora (boca 9,23:1, faixa de 19 px): o conform precisaria de
×3,08, e a recusa de espremer em mais de ±70 % é exatamente o portão dizendo "regenere" — fica para
a próxima rodada, com o dono decidindo o resto do lote.
Prompt enviado (roda 3): [CAMERA] com `the whole cart stands perfectly LEVEL — do not tip it, do
not rotate it, do not slant the opening into a parallelogram`, [GUIDE]/[RATIO]/[NO TEXT]/[TECH] da
seção anterior, e o delta do nível 3 (termômetro grande de disco em branco à direita, tacho de
gordura, três colunas de ventilação, queima-chamas lateral à esquerda).
