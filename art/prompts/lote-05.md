# Lote 05 — prompts (reforços do lote 04)

Data: 2026-09-26 · `generate_image` · saída `art/source/lote-05/`.

## O que a primeira tentativa do reforço ensinou

Rodadas com `MOUTH_IS_THE_REF` + o guia chapado (`guide_cart`, `guide_box`), as duas grelhas de
aço **pioraram**:

| versão | boca | inclinação do topo |
|---|---|---|
| lote 04 (guia + "pinte em volta") | 15 % | +4,3° / +6° |
| lote 05 pass 1 (guia + "a boca É o retângulo") | **6 % / 9 %** | **−29,9° / −27,3°** |
| fornalha **aprovada** no lote 04 | 25 % | **0°** |

O modelo atendeu ao "vistas de cima a 55°" e pintou a grelha quase de lado: a boca virou um
paralelogramo fino e inclinado. **E é exatamente isso que o jogo não quer**: `toGrillScreen`
mapeia as vagas sobre o quadrilátero e as faixas de calor são horizontais, então boca torta
desperdiça tela e boca rasa mal tem onde colocar comida. A régua real é a da fornalha aprovada —
**retângulo grande, virado para quem olha, topo horizontal** — e não uma perspectiva área.

Correção aplicada a partir daqui:

- a câmera pedida passa a ser **quase de frente, levemente de cima (~20°)**;
- a referência deixa de ser o desenho chapado do `make-ref guide` e passa a ser o **master
  aprovado da fornalha** (`make-ref single … spr_grill_fornalha_dragao_manso_evo1`): o modelo
  copia a composição de uma arte que já foi aceita, em vez de interpretar uma instrução.

**[CAM_FRONT]** *(novo)*
> Camera: almost straight on from the front, tilted down by only about 20 degrees, so the cooking opening reads as one large flat rectangle facing the viewer, its top edge and bottom edge perfectly horizontal. The opening is big: at least half the width of the whole image and about a quarter of its area.

**[MOUTH_MATCHES_REF]** *(novo, substitui o MOUTH_IS_THE_REF para as grelhas de aço)*
> The reference image is an approved grill from this same game: a masonry barbecue whose firebox opening is a large dark rectangle facing the viewer, with its top edge perfectly horizontal. Copy that composition, not that object: your grill's opening must have the same size, the same position in the frame and the same horizontal top edge as the reference's opening, and the same amount of empty space around the object. Do not tilt the opening, do not draw the grill seen from above, do not make the opening a narrow sliver. Leave the opening empty and dark (no grate, no coals, no food inside it).

## Imagens

### G1 · `grill_ze_da_esquina_evo1.png` (ref: `guides/ref_grill_fornalha.png`)
[STYLE] Subject: "Grelha do Zé da Esquina", a humble Brazilian street-corner charcoal grill: a long rectangular firebox of dark, well-seasoned, slightly greasy black steel with faded red-brown paint on its front panel, on a sturdy metal cart frame with two wheels, a small side shelf, a short chimney at the back left corner, honest wear. [CAM_FRONT] [MOUTH_MATCHES_REF] [TECH]

### G2 · `grill_parrilla_chef_cisma_evo1.png` (ref: `guides/ref_grill_fornalha.png`)
[STYLE] Subject: "Parrilla do Chef Cisma", an elegant chef's Argentine-style parrilla: a polished mirror-finish stainless-steel firebox reflecting warm golden light, on four neat steel legs, with a stainless side shelf, a small round thermometer on the front panel and a short stainless chimney at the back left corner. [CAM_FRONT] [MOUTH_MATCHES_REF] [TECH]

## Pass 2 das grelhas de aço — o que as duas tentativas anteriores provaram

| tentativa | boca | inclinação | por que falhou |
|---|---|---|---|
| lote 05 pass 2 (câmera de frente + referência fornalha) | chapa **642×25 px**; inox **sem furo** | — | descrita como "caixa de aço retangular longa", o modelo pinta uma grelha realista: a boca de fogo é uma **fresta**, e a grelha de verdade vem desenhada por cima (por isso o detector não achou área magenta fechada no inox) |

Ou seja: o problema não é mais a câmera nem a proporção — é o **assunto**. "Firebox retangular de
aço" não tem leito grande na cabeça do modelo. O único caminho que funcionou neste projeto em
todas as vezes é o das evoluções da lata (lote 02): **pedir o mesmo objeto da referência, trocando
só o material** — a referência é a lata aprovada (boca 89 % da largura, 21 % do sprite), não uma
descrição de composição.

**[RECLASS]** *(novo)*
> Reclassify the subject for the player: this is not a real barbecue, it is the game's COOKING BED — the whole top of the object is one wide open shallow basin of empty dark space where the food sits, exactly like the open drum in the reference image. The reference is an approved asset from this game (a grill made from a cut-open 18-litre drum): keep its silhouette, its proportions, the size and position of its opening and its horizontal top edge; change the material, the paint and the base only. Your opening must stay as large as the reference's: same width, same height, same place in the frame. Do not fill it with a grate, coals, ash or food, and do not turn it into a narrow fire slot or a small window.

### G1b · `grill_ze_da_esquina_evo1.png` (ref: `guides/ref_grill_lata_evo1.png`)
[STYLE] Subject: the same open-bed grill as the reference image, rebuilt as "Grelha do Zé da Esquina": the long half-barrel body painted in faded red-brown enamel over dark seasoned steel, greasy wear and soot, on a sturdy metal cart frame with two wheels and a small side shelf, a short chimney at the back left. [RECLASS] [TECH]

### G2b · `grill_parrilla_chef_cisma_evo1.png` (ref: `guides/ref_grill_lata_evo1.png`)
[STYLE] Subject: the same open-bed grill as the reference image, rebuilt as "Parrilla do Chef Cisma": the long half-barrel firebox in polished mirror-finish stainless steel reflecting warm golden light, on four neat steel legs with a stainless side shelf and a small round thermometer on the front panel, a short stainless chimney at the back left. [RECLASS] [TECH]

## Pass 3 das grelhas — "é o leito do jogo", referência = a lata aprovada

| tentativa | boca medida |
|---|---|
| chapa | 416×113 px em 1058×706 → **6,3 %** do sprite, topo a −12,4° |
| inox | **32×31 px** — o modelo pintou a grelha por cima da boca; quase não há furo |

Nem o re-skinning do tambor (o único objeto que sempre funcionou) segurou a boca grande nas duas
grelhas de aço. **Três rotas esgotadas** — a melhor arte disponível continua sendo a do lote 04
(15 % do sprite, topo a +4,3° / +6°, ou seja, mais horizontal que a lata aprovada, que tem −8,6°).
As duas artes do lote 04 foram restauradas do commit `f26f0c4` e continuam `rejected`, com a
medição na nota do registro, para decisão do dono: aceitar 15 %, ou pedir as duas como objetos
novos (não como "grelha realista") num lote dedicado.

## O que este lote descobriu na ferramenta (não na arte)

Ao rodar a grade da maminha inteira, as 5 linhas `approved` do lote 04 mantiveram o status
enquanto os **pixels mudavam**: o congelamento protegia a decisão, não a arte. `process-sprites`
agora recusa o repaint de linha `approved`/`superseded` e manda registrá-la como `pending` antes
(`--allow-repaint` para quando só se quer re-codificar os mesmos arquivos). Verificado nos três
caminhos: 28 linhas do lote 04 → recusa com exit 1; lote com tudo `pending` → processa;
`--allow-repaint` → processa.
