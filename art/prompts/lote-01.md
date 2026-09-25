# Lote 01 — prompts

Gerado em 2026-09-25 com `generate_image`: 10 chamadas, com saída em `art/source/lote-01/`
(fora do git). O plano e o fluxo estão em `docs/22-ARTE_2D_PLANO.md`.

> **Fidelidade deste arquivo.** No lote 01 o texto de cada chamada não foi gravado antes de
> gerar. O que segue é a reconstrução fiel dos blocos usados e do assunto de cada imagem.
> A partir do lote 02, cada prompt é salvo **literalmente, antes** da geração.

## Blocos fixos

**Estilo** (início de todo prompt):

> Premium 2D mobile game art for a Brazilian churrasco cooking game. Stylized semi-realistic
> hand-painted look with soft 3D volume, like top-grossing casual cooking games. Subtle
> dark-brown outline, rich saturated but natural colours, glossy highlights on fat and juices.
> Warm golden-hour key light from the upper left; no cold light.

**Técnico** (fim de todo prompt com recorte):

> The entire background is one perfectly flat, uniform pure magenta (#FF00FF): no gradient,
> no floor, no cast shadows, no grid lines, no text, no watermark, no border. Leave generous
> magenta space around every item.

## Imagens

| # | Arquivo | Referência | Assunto e layout |
|---|---|---|---|
| 1 | `food_picanha.png` | — | Sprite sheet, 2 columns × 3 rows, one picanha steak (with its fat cap) per cell, ¾ top-down view at about 55°, lying horizontally. Cells 1–5 show the **same** piece with an identical shape: 1 RAW; 2 RARE / JUST SEARED; 3 PERFECT (golden crust, dark grill marks, juices); 4 WELL DONE; 5 BURNED (charred, cracks, ash). Cell 6: SERVED, sliced and fanned on a small wooden board. |
| 2 | `food_linguica_toscana.png` | #1 | Same layout and states for one linguiça toscana (a straight Brazilian pork sausage); served = sliced rounds on a board. *"Use the reference image only as the style and layout guide. Do NOT draw any steak."* |
| 3 | `food_pao_de_alho.png` | #1 | Same, for pão de alho (a garlic-bread roll with creamy garlic-cheese filling and parsley); served = two halves on a board. |
| 4 | `food_queijo_coalho.png` | #1 | Same, for queijo coalho on a wooden stick; served = on a board with a drizzle of honey. |
| 5 | `food_espetinho_misto.png` | #1 | Same, for espetinho misto (beef, sausage, onion and bell pepper on a skewer); served = on a board with farofa. |
| 6 | `grill_lata_valente.png` | — | A humble backyard grill made from a halved rusty steel drum on rebar legs, with wire handles and a brick propping one leg. Cheated front view. The cooking opening is filled with flat magenta so the game can place the grate and embers. |
| 7 | `bg_quintal.png` | — | Vertical 9:16 game background (no magenta): a Brazilian backyard at golden hour, with a cream wall, lit window, banana plant, string lights and terracotta patio. No people. Clear space in the middle third for the grill. |
| 8 | `fx_brasas.png` | — | Three horizontal strips of glowing charcoal, stacked with magenta between them. The same lump layout in all three, at LOW, MEDIUM and HIGH heat. Seamless edges. |
| 9 | `prop_bancada.png` | — | A rustic wooden prep counter seen from the front, with a flat top surface for raw ingredients, spanning the full width. |
| 10 | `char_clientes_a.png` | — | Grid of 6 customer bust portraits, friendly and expressive, facing the viewer: comum, apressado (checking his watch), família (mother + child), tio do churrasco (cap, apron, moustache), influencer (selfie phone), turista (sun hat, camera). |

## O que o modelo ignorou (e a correção para o lote 02)

| Pedido | O que veio | Correção no prompt |
|---|---|---|
| "no grid lines" | linhas rosa-claras ou magenta-escuras em todas as folhas em grade | manter a frase e somar "cells are separated only by empty magenta space"; o recorte já apaga as linhas |
| "no text" | legendas "RAW PÃO DE ALHO" etc. na #3 | "no letters, numbers, captions or labels anywhere in the image" |
| grade 2×3 de clientes | 7 retratos, com um cruzando células | "exactly 6 portraits, one per cell, each fully inside its cell" |
| vista frontal da lata | ¾ oblíqua, com a boca inclinada −8,6° | "perfectly symmetrical front view, the opening's top edge perfectly horizontal" (vale para chapa, inox e fornalha) |
| bancada reta | mesa em perspectiva | aceitável como está (ver a montagem); numa refação, "flat orthographic front view" |
| turista | sem camisa | "wearing a colourful shirt"; e, para todos os personagens, "no pink or magenta clothing" |
