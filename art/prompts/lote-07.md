# Lote 07 — as dez churrasqueiras do jogo, na ordem que o dono escreveu (10 imagens, validação antes do lote 08)

O dono deu a lista das dez identidades e a foto de uma arte minha para cravar a câmera:

> "Colei uma foto de uma das suas criações para você entender que acertou no ângulo da churrasqueira
> dessa foto. Somente depois de recriarmos todas as imagens que estão pendentes no jogo para o
> correto funcionamento mecânico e visual é que iremos corrigir os outros erros. Para as imagens da
> churrasqueira, use essas ideias: [1 fogueira de chão com pedras · 2 tambor/lata cortada ·
> 3 tijolo simples sem reboco · 4 quintal comum de alvenaria com chaminé e bancada · 5 espeto
> giratório motorizado · 6 com tampa (defumação/offset smoker) · 7 a gás com queimadores ·
> 8 parrilla argentina com regulagem de altura · 9 inox profissional multi-nível ·
> 10 robótica automatizada]"

E a regra de lote dele: **dez imagens geradas, depois a validação dele antes do lote seguinte**.

## A câmera da foto, escrita em palavras (vale para as dez)

A foto aprovada é o `spr_grill_grelha_de_praca` deste mesmo lote: frontal, levemente de cima
(15–20°), corpo = caixa rasa com borda grossa arredondada, **a boca é o vão magenta no topo do corpo,
larga como o corpo inteiro**, e logo **abaixo** dela há **uma janela horizontal com brasa acesa** — o
fogo nunca aparece dentro da boca. Bandeja lateral numa ponta, cesto/trejunto pendurado embaixo, pés
finos. Isso é o que o motor desenha (`drawGrillSprite` põe comida e faixas de calor no vão), e é o que
a régua mede. O resto do prompt só muda o material e o acessório que o degrau promete.

## As dez, com a geometria medida no guia

Guia por grelha: `node tools/art/make-ref.mjs guide art/source/lote-07/guides/g_<id>_e1.png 1408 --grill <id> --evo 1`.

| # | slot (id no dado) | conceito do dono | fileiras × vagas | quadro | boca | razão | o que a arte tem que contar |
|---|---|---|---|---|---|---|---|
| 1 | `lata_valente` | fogueira no chão com pedras | 1×2 | 1408×768 | 1126×205 | 5,50:1 | buraco raso, pedra solta, brasa no fundo, espeto de graveto |
| 2 | `grelha_de_praca` | tambor/lata cortada ao meio | 2×2 | 1408×976 | 1126×410 | 2,75:1 | bidão de 200 L cortado, grelha improvisada, tijolo de apoio |
| 3 | `ze_da_esquina` | tijolo simples sem reboco | 2×2 | 1408×976 | 1126×410 | 2,75:1 | tijolo empilhado a seco, vergalhão, fumaça de queixo |
| 4 | `espeto_do_neno` | quintal comum de alvenaria | 2×3 | 1408×912 | 1126×377 | 2,99:1 | reboco, chaminé, bancada lateral — o "padrão" reconhecível |
| 5 | `parrilla_chef_cisma` | espeto giratório motorizado | 3×2 | 1408×1472 | 1126×614 | 1,83:1 | a alvenaria + motor elétrico e dois espetos longos |
| 6 | `tambor_vertical` | com tampa, defumação | 3×3 | 1408×1360 | 1126×565 | 1,99:1 | offset smoker: barril deitado, tampa aberta, caixa de fogo ao lado |
| 7 | `fornalha_dragao_manso` | a gás com queimadores | 3×3 | 1408×1360 | 1126×565 | 1,99:1 | botões de ignição, controle de chama, rapidez |
| 8 | `parrilla_do_cais` | parrilla argentina com altura | 4×3 | 1408×1808 | 1126×753 | 1,50:1 | grelha em cruz sobe/desce por manivela e corrente |
| 9 | `fornalha_da_orla` | inox profissional multi-nível | 4×4 | 1408×1584 | 1126×663 | 1,70:1 | vários níveis, termômetro embutido, cara de rodízio |
| 10 | `cozinha_do_campeao` | robótica automatizada | 4×5 | 1408×1584 | 1126×663 | 1,70:1 | sensor, painel, giro e virada automáticos, tier futurista |

As três últimas ainda têm `fileiras: 4` no dado (nível 26, 36, 46). A instrução dele é "1, 2 ou 3 linhas
jogáveis", mas **a boca pintada aqui serve aos dois mundos**: o guia de 4 faixas tem altura ≥ 3 faixas,
e a razão fica dentro da tolerância (±0,7) das duas leituras — 1,50:1 pintado vs. 2,27:1 pedido em
3×5 é fator 1,51. A decisão de escada (4 fileiras no topo vira 3×5, com preço/renda reancorados no
`sim`) é o passo mecânico que ele mesmo deixou para depois das imagens.

## Bloco comum (enviado igual nas dez)

```
[CAMERA] Front view, seen from slightly above (about 15–20 degrees), exactly like the reference photo:
the object is one low, wide unit standing level. The cooking opening is an axis-aligned horizontal
rectangle as wide as the body; its top edge and bottom edge are horizontal lines parallel to the top of
the image, its left and right edges are vertical. This is NOT isometric and NOT aerial: no parallelogram,
no diamond, no oval opening.
[MOUTH] The reference image is a layout guide, not artwork: a flat dark silhouette with ONE bright
magenta rectangle inside it. That rectangle IS the cooking opening: paint the object so its opening
covers exactly that magenta rectangle — same left, right, top and bottom edge. Do not shrink it, do not
move it, do not draw a smaller opening inside the frame. The opening stays EMPTY MAGENTA: no grate, no
bars, no coals, no ash, no meat, no gloss, nothing crossing it — the game draws the food and the heat
bands there itself.
[FIRE] The fire is never in the opening. Put a wide horizontal window of glowing orange embers in the
FRONT FACE of the body, immediately BELOW the opening (one band for a one-row grill, two for two rows,
three for three), with the rim of the body between that window and the opening.
[ROWS] The height of the opening IS the row count: the game stacks its cooking rows inside it, one band
per row. Never fill leftover height with a taller rim, a splash guard or a shelf inside the opening —
everything the grill has is built AROUND the opening or BELOW it.
[NO TEXT] No letters, numbers, words, signboards, logos, chalkboards or menu boards anywhere.
[TECH] The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient, no
floor, no cast shadows, no grid lines, no cell borders, no frames. Nothing in the artwork itself is
magenta or hot pink. Premium 2D mobile game art for a Brazilian churrasco game: stylized hand-painted
look with soft 3D volume, subtle dark-brown outline, rich saturated natural colours, glossy highlights,
warm golden-hour key light from the upper left. One single object, centred, filling the frame.
```

## Os dez [STYLE]

1. `spr_grill_lata_valente_evo1.png` — **fogueira no chão com pedras** (nível zero, cocção lenta e irregular)
   > [STYLE] Subject: level zero of the ladder — a ground fire pit: a shallow round-ish hole in bare
   > trodden earth ringed by loose grey and ochre field stones, some stones cracked by heat, a few dry
   > sticks and a broken green branch at the ring, one thin improvised wooden skewer resting across the
   > stones. The ring of stones IS the body and the dark hole IS the opening: paint the stone ring around
   > the guide's magenta rectangle, wide and flat (5.5 times wider than tall), no metal at all, no grate,
   > no legs. Ash and soot stains on the stones. It must look humble and hand-made — the before picture.

2. `spr_grill_grelha_de_praca_evo1.png` — **tambor/lata cortada ao meio** (primeiro upgrade real)
   > [STYLE] Subject: level 1 upgrade — an oil drum cut in half lengthways on two rebar legs with a
   > brick under one end: dark dented blue-grey steel barrel, the cut rim bright and rough, welded
   > handles on both ends, a small improvised sheet-metal shelf bolted at the right end, a few cinder
   > blocks under the legs. The cut opening is the top half of the barrel: one long flat rectangle as wide
   > as the drum (2.75 times wider than tall) — the body, the handles and the legs go around it, never
   > over it. Two bands of embers in the curved front face below the opening, glow leaking through three
   > cut vent slots.

3. `spr_grill_ze_da_esquina_evo1.png` — **tijolo simples sem reboco**
   > [STYLE] Subject: level 2 — a plain barbecue of stacked red bricks with NO mortar, dry and slightly
   > uneven, corners chipped, soot-blackened on the inside faces; two rebar rods resting across the top
   > outside the opening at the left end. The opening is the rectangular gap between the brick walls: a
   > wide flat rectangle (2.75 times wider than tall) framed by brick, empty magenta inside. Two rows of
   > glowing embers visible through the open front course of bricks below the opening. No plaster, no
   > tiles, no chimney, no paint — still exposed and provisional.

4. `spr_grill_espeto_do_neno_evo1.png` — **quintal comum de alvenaria** (o marco intermediário)
   > [STYLE] Subject: level 3 — the recognisable Brazilian backyard barbecue: plastered and whitewashed
   > masonry body with a warm terracotta trim, a flat tiled counter shelf on the right end with a small
   > salt cellar and a wooden board on it, a short plastered chimney at the back left with a thin metal
   > cap. The cooking opening is a wide flat rectangle (2.99 times wider than tall) cut into the top of
   > the masonry, tiled rim, empty magenta inside. Two rows of embers behind a blackened iron band in
   > the front face, and a small iron ash-door below. This is the first grill that looks "finished".

5. `spr_grill_parrilla_chef_cisma_evo1.png` — **espeto giratório motorizado** (automação parcial)
   > [STYLE] Subject: level 4 — the same plastered masonry barbecue, now motorised: a small grey electric
   > rotisserie motor box bolted to the LEFT end of the body with a thin drive chain, and two long steel
   > rotisserie spits with fork clamps running BEHIND and ABOVE the opening (parallel to the top edge,
   > entirely outside the magenta, never crossing it), a heat shield above the opening, and a blackened
   > brick firebox front with three rows of embers. The opening itself stays a near-square rectangle
   > (1.83 times wider than tall) and empty. A spiced beef piece is NOT to be drawn on the spit — the
   > spits are empty metal rods.

6. `spr_grill_tambor_vertical_evo1.png` — **com tampa, defumação** (offset smoker)
   > [STYLE] Subject: level 5 — a black-painted steel offset smoker: a big horizontal barrel cooking
   > chamber with a heavy domed lid hinged OPEN and standing up behind the opening (its outer face to the
   > viewer, entirely above and behind the magenta, never crossing it), a smaller firebox box bolted to
   > the LEFT end with its own door and a draft vent, a tall chimney at the far right with a butterfly
   > damper, two chunky wheels under the barrel and a temperature gauge (blank dial) on the front. The
   > opening is the front of the barrel: a big near-square rectangle (1.99 times wider than tall), empty
   > magenta, with three rows of embers glowing in the firebox front below it. Heat-blued soot and a few
   > rust freckles on the black paint.

7. `spr_grill_fornalha_dragao_manso_evo1.png` — **a gás com queimadores** (rapidez e praticidade)
   > [STYLE] Subject: level 6 — a modern stainless gas grill on a black cabinet with two doors and two
   > wheels: brushed-steel body with a rolled rim, a wide open cooking box on top (a tall rectangle
   > 1.99 times wider than tall, empty magenta, no burners and no lava rocks drawn inside it), a front
   > control panel with three chunky blank knobs and one red ignition button, two side shelves (a squeeze
   > bottle and a small thermometer on the right one), and the cabinet below glowing with three horizontal
   > flame slots behind a steel grille where the ember bands belong. Clean, practical, no brick and no
   > chimney: the difference is speed.

8. `spr_grill_parrilla_do_cais_evo1.png` — **parrilla argentina com regulagem de altura**
   > [STYLE] Subject: level 7 — a Argentine-style parrilla on polished steel legs with two solid wheels:
   > the firepit is a deep V-shaped steel trough, and above it the grate hangs from two chains that run
   > up to a crank wheel mounted on the right post (the crank has one bright turn of cable). The opening
   > is the tall rectangle between the trough and the crank post: 1.50 times wider than tall, framed in
   > steel, empty magenta. Three rows of embers glow in the front of the trough, an ash drawer below, and
   > a small side shelf with an asador's long fork hanging on the left post. No meat, no chorizo drawn.

9. `spr_grill_fornalha_da_orla_evo1.png` — **inox profissional multi-nível** (cara de rodízio)
   > [STYLE] Subject: level 8 — professional stainless multi-level barbecue of a churrascaria: a long
   > mirror-steel body on four thick legs with a lower warming shelf and an upper rail holding a blank
   > round built-in thermometer and a heat lamp; the cooking opening is a tall wide rectangle (1.70 times
   > wider than tall) with a rolled steel rim, empty magenta, and behind it two additional empty steel
   > grate levels visible at the back edge (the multi-level look), never inside the opening. Four rows of
   > embers glow behind the front vent band, a grease trough running the full length underneath, and a
   > hanging tool set (two forks and a brush) on the left post.

10. `spr_grill_cozinha_do_campeao_evo1.png` — **robótica automatizada** (tier final, futurista)
    > [STYLE] Subject: level 9 — an automated competition-grade barbecue: a black-chrome and glass monolith
    > on a low plinth with flush steel handles, its top opening a tall rectangle (1.70 times wider than
    > tall) with a clean machined rim, empty magenta inside; above and behind the opening two slim
    > articulated turning arms on rails (empty clamps, no food), a short sensor mast with a blank lens on
    > the left, a dark tablet-sized control panel with a blank screen on the right post, and cold cyan LED
    > strips lighting the front face where the ember bands go, mixed with a warm ember glow behind the
    > lower vents. Precise, expensive, quiet. No logo, no brand, no readable screen.

## O que este lote muda no repositório (e por quê)

- As artes novas entram com os **nomes canônicos por slot** (`spr_grill_<id>_evo1`), porque é assim que
  `build-runtime` e o atlas falam com o motor; a identidade visível troca, a chave não.
- Os quatro `approved` que este lote substitui (`lata_valente`, `ze_da_esquina`, `parrilla_chef_cisma`,
  `fornalha_dragao_manso` no evo1) são **baixados para `pending` antes de processar** — o
  `process-sprites.mjs` recusa pisar pixel de linha aprovada sem isso (docs/04 §11). Nada entra no
  runtime sem a validação dele. Enquanto `pending`, o protótipo mostra o fallback procedural daqueles
  quatro evo1: é o preço de trocar identidade com honestidade, e some no instante em que ele aprovar.
- Os arquivos brutos ficam em `art/source/lote-07/` (gitignored, como sempre) — por isso este lote é
  **gerado, processado e medido no mesmo turno**, sem deixar master órfão para o próximo turno.

## Pendência assumida para o próximo passo (depois das imagens)

`visual.style`, `material`, `color` e os ~60 textos de loja (`grill.*.name/subtitle/desc/evo*`) ainda
descrevem a escada antiga ("Tijolo Refratário", "O Foguete de Quintal"). Trocar a identidade das dez sem
trocar o texto é a máquina de mentir que já consertei duas vezes neste projeto — assim que ele validar as
imagens, o dado e o l10n acompanham, com `validate-data`, `sync-data`, `gen-vectors` e o `sim` rodando de
novo, e as fileiras 4→3 do topo entram nesse mesmo commit se ele quiser o teto de 3 linhas.

---

## Medição do lote (o veredito que eu dou por item, antes dele decidir)

Processado com o conform ligado, medido com a régua do guia (`check-grill-geometry.mjs --all`) e
montado na prévia do layout real (`art/review/lote-07-preview.jpg`).

| # | sprite | leito | b/larg | veredito meu |
|---|---|---|---|---|
| 1 | `spr_grill_fogueira_no_chao_evo1` | (sem slot no dado — não mede) | 0,60 | **aprovável como conceito**: pedra, terra e graveto corretos, boca 5,4:1, parece mesmo o "antes" do jogo. Precisa do passo mecânico para entrar (id + nível 0 + textos). |
| 2 | `spr_grill_grelha_de_praca_evo1` | ok (2,75:1 · faixa 60 px · 0°) | 0,59 | bonito e no ponto; o bidão cortado lê "primeiro upgrade" sem virar sucata. Recorte um pouco largo (bandejas) → regravação no lote 08 só se ele quiser 0,72+. |
| 3 | `spr_grill_ze_da_esquina_evo1` | ok (2,71:1 · 0°) | 0,48 | tijolo a seco convence; mas boca em 48 % do recorte — a prévia mostra o leito folgado, a loja mostraria apertado. Candidato a regravação. |
| 4 | `spr_grill_espeto_do_neno_evo1` | ok (2,51:1 · −0,1°) | 0,42 | a melhor narrativa do lote (alvenaria = "acabou de ficar gente grande"), e a pior geometria relativa: bandeja + tábua + saleiro esticaram o recorte. |
| 5 | `spr_grill_parrilla_chef_cisma_evo1` | ok (1,83:1 · −6,1° · conform ×1,132) | 0,61 | motor + espetos vazios acima da boca, sem invadir o vão — é o item que mais vende automação. Aprovável. |
| 6 | `spr_grill_tambor_vertical_evo1` | ok (1,99:1 · 0° · conform ×1,040) | 0,51 | na prévia com 9 pratos de verdade a boca segura tudo; mas a tampa aberta virou um painel escuro enorme que pesa no topo do quadro. Regravaria com "tampa mais baixa e inclinada". |
| 7 | `spr_grill_fornalha_dragao_manso_evo1` | **pende — boca 5,6:1, faixa 21 px** | 0,49 | o modelo pintou uma grelha a gás *rasa*: o conform pediria ×2,81 (teto ±70 %). Reprovado por mim, não por ele — regravação já escrita no lote 08. |
| 8 | `spr_grill_parrilla_do_cais_evo1` | ok (1,5:1 · 0° · conform ×1,017) | 0,50 | a manivela e as correntes apareceram, a boca ficou alta como a parrilla manda. |
| 9 | `spr_grill_fornalha_da_orla_evo1` | ok (1,7:1 · −6,7° · conform ×1,048) | 0,42 | os níveis extras acima da boca leram "profissional" sem tocar o vão; inclinação dentro do teto. |
| 10 | `spr_grill_cozinha_do_campeao_evo1` | ok (1,7:1 · 0° · conform ×1,182) | 0,62 | o tier final: braço, sensor e painel sem texto, boca 1,7:1. É a imagem que se quer vender em anúncio. |

Regra que sai deste lote para o lote 08 (já no `check-grill-geometry.mjs` como `MOUTH_WIDTH_HINT = 0,72`
e escrita em `docs/22` §6.11): **nada de móvel lateral fora da silhueta do guia** — bandeja,
porta-faca, funil de carvão e chaminé ficam dentro da largura do corpo ou abaixo da boca, porque o
recorte cresce para os lados e a boca não, e o motor escala a grelha inteira para caber na tela.

Itens que a validação dele precisa resolver, e só ele:

1. aprovar/rejeitar por item (10 linhas `pending`; nenhuma entrou no atlas — `build-runtime` está
   `--dry-run`, `check-art-registry` continua contando a mesma história);
2. o `lata_valente_evo1` **aprovado não foi tocado**: a fogueira virou arquivo novo justamente para o
   D0 não perder arte enquanto o "nível zero" não existe no dado;
3. escada: topo 4 fileiras (hoje) ou teto de 3 (o que ele escreveu)? A régua aceita as duas, e as três
   grelhas do topo ainda não têm arte aprovada, então trocar custa só dado + textos;
4. o passo mecânico de identidade: renomear ids/`visual.style`/`material` + ~60 chaves de loja, com
   `validate-data` + `sync-data` + `gen-vectors` + `sim`. Sem isso, a loja diz "Tijolo Refratário"
   enquanto o cartão mostra um bidão — é a máquina de mentir que já consertei duas vezes.
