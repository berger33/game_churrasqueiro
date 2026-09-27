# Lote 10 — estados individuais de contra-filé e maminha (3/4)

**Data:** 2026-09-26 · ferramenta: `generate_image` · **10 imagens** · saída bruta:
`art/source/lote-10/` (gitignored). Masters, manifesto e revisão são versionados.

O dono aprovou o lote 09 ao pedir a rodada seguinte. Para não partir uma sequência de
crossfade entre lotes, esta rodada usa as 10 vagas nos cinco estados de grelha de cada corte:
contra-filé e maminha (`raw`, `rare`, `medium`, `well`, `burned`). O lote 11 fica exatamente
com três imagens: os dois pratos `served` e o fundo Churrascaria de Bairro.

## Estratégia de consistência

1. Gerar primeiro `contra_file_raw` e `maminha_raw`, com referências de comidas aprovadas.
2. Usar o raw recém-gerado do próprio corte como referência obrigatória nas quatro chamadas
   seguintes, preservando contorno, câmera, proporção e posição da gordura.
3. Após o recorte individual, `alignGroups` no `art/lote-10.json` normaliza os cinco quadros de
   cada corte para a mesma tela, o mesmo pivô e tamanho aparente. O crossfade não pode saltar.

## Bloco técnico comum literal — todas as 10 imagens

> Create exactly ONE isolated FOOD COOKING-STATE sprite on a square 1:1 canvas for a premium Brazilian churrasco mobile game. Hand-painted stylized semi-realistic casual cooking art, soft chunky 3D volume, subtle dark-brown outline, appetizing tactile meat material, warm golden-hour key light from upper left. Fixed food camera: high three-quarter top view at about 55 degrees. The whole cut lies horizontally from left to right, centered, with generous margin. No plate, board, grill, grate, skewer, garnish, herbs, salt, utensil, smoke, flame, loose juice drops, caption or extra object. Exactly one complete cut. Entire unused canvas is perfectly flat solid chroma magenta #FF00FF to every edge, with no gradient, texture, ground plane or cast shadow. No magenta or hot pink inside the food. No frame, grid, letters, words, numbers, logo, signature or watermark.

## 01 — `contra_file_raw.png`

`images`: approved `spr_food_picanha_raw`, `spr_food_fraldinha_raw`, `spr_food_costela_raw`.

> SUBJECT AND STATE: RAW Brazilian contra-filé, one thick long rectangular strip-loin steak with softly rounded corners and a THIN continuous ivory fat strip only along the long upper edge. Deep fresh beef-red muscle, restrained fine cream marbling, moist but not glossy plastic. The body is clearly longer and more rectangular than picanha; no triangular tip and no thick fat cap. Uncooked: absolutely no browned surface or grill marks.

## 02 — `contra_file_rare.png`

`images`: newly generated `contra_file_raw` + approved `spr_food_picanha_rare`.

> Use the supplied contra-filé raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME contra-filé outline, camera, thickness, fat-strip placement and horizontal orientation, now SELADO / early seared. Surface changes only: light warm tan-brown film, a few pale caramel patches and exactly four subtle diagonal first-contact grill lines. Fat strip turns cream-gold but stays the same size. Still juicy and soft. Do not cut it open. Do not redesign, rotate, shorten, widen or bend the steak.

## 03 — `contra_file_medium.png`

`images`: newly generated `contra_file_raw` + approved `spr_food_picanha_medium`.

> Use the supplied contra-filé raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME contra-filé outline, camera, thickness, fat-strip placement and horizontal orientation, now AO PONTO. Rich appetizing mahogany-orange seared crust, four clear dark diagonal grill marks, small integrated juice sheen, golden rendered fat edge. No cut interior. Do not redesign, rotate, shorten, widen or bend the steak; only cooking material changes.

## 04 — `contra_file_well.png`

`images`: newly generated `contra_file_raw` + approved `spr_food_picanha_well`.

> Use the supplied contra-filé raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME contra-filé outline, camera, thickness, fat-strip placement and horizontal orientation, now BEM PASSADO. Deep even roasted brown crust, darker cross-sear marks, slightly drier matte surface and dark-gold reduced fat strip. Appetizing and cooked, not black or burned. No cut interior. Do not redesign or deform the steak; only cooking material changes.

## 05 — `contra_file_burned.png`

`images`: newly generated `contra_file_raw` + approved `spr_food_picanha_burned`.

> Use the supplied contra-filé raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME contra-filé outline, camera, thickness, fat-strip placement and horizontal orientation, now QUEIMADO. Charcoal-black and very dark brown crust with cracked grey ash patches, nearly lost grill marks and one restrained dull ember-red seam inside a crack. Clearly ruined, dry and burned. No flames, smoke or detached ash. Do not redesign or deform the steak; only cooking material changes.

## 06 — `maminha_raw.png`

`images`: approved `spr_food_cupim_raw`, `spr_food_picanha_raw`, `spr_food_fraldinha_raw`.

> SUBJECT AND STATE: RAW Brazilian maminha / tri-tip, one thick LOW triangular wedge with a broad rounded left end and one unmistakable tapered point on the RIGHT. Boat-shaped asymmetric silhouette, longer than tall, with a THIN ivory fat layer following only the long upper curved edge. Deep fresh beef-red muscle with subtle longitudinal grain and very light marbling. It must not resemble the rectangular contra-filé, the broad picanha triangle or the tall rounded cupim roast. Uncooked: absolutely no browned surface or grill marks.

## 07 — `maminha_rare.png`

`images`: newly generated `maminha_raw` + approved `spr_food_cupim_rare`.

> Use the supplied maminha raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME low triangular boat-shaped maminha, same broad rounded left end, same tapered RIGHT point, camera, thickness, fat edge and horizontal orientation, now SELADA / early seared. Surface changes only: light tan-brown film, sparse caramel patches and exactly four subtle diagonal first-contact grill lines. Thin fat edge becomes cream-gold. Do not cut it open. Do not make it rectangular, rotate it or change the tapered point.

## 08 — `maminha_medium.png`

`images`: newly generated `maminha_raw` + approved `spr_food_cupim_medium`.

> Use the supplied maminha raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME low triangular boat-shaped maminha, same broad rounded left end, same tapered RIGHT point, camera, thickness, fat edge and horizontal orientation, now AO PONTO. Rich mahogany-orange seared crust, four clear dark diagonal grill marks, integrated juice sheen and golden rendered thin fat edge. No cut interior. Do not change its silhouette; only cooking material changes.

## 09 — `maminha_well.png`

`images`: newly generated `maminha_raw` + approved `spr_food_cupim_well`.

> Use the supplied maminha raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME low triangular boat-shaped maminha, same broad rounded left end, same tapered RIGHT point, camera, thickness, fat edge and horizontal orientation, now BEM PASSADA. Deep even roasted brown crust, darker cross-sear marks, slightly drier matte surface and dark-gold reduced fat edge. Appetizing and cooked, not black. No cut interior. Do not change its silhouette; only cooking material changes.

## 10 — `maminha_burned.png`

`images`: newly generated `maminha_raw` + approved `spr_food_cupim_burned`.

> Use the supplied maminha raw image as a strict shape template. SUBJECT AND STATE: the EXACT SAME low triangular boat-shaped maminha, same broad rounded left end, same tapered RIGHT point, camera, thickness, fat edge and horizontal orientation, now QUEIMADA. Charcoal-black and very dark brown crust with cracked grey ash patches, almost lost grill marks and one restrained dull ember-red seam inside a crack. Clearly ruined, dry and burned. No flame, smoke or detached ash. Do not change its silhouette; only cooking material changes.

## Estado de aprovação

O lote entra como `pending`. Revisão técnica não equivale à aprovação. Nesta entrega, nenhum
quadro novo entra no runtime aprovado; a publicação continua condicionada à decisão do dono.
