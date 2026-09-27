# Lote 08 — refação individual dos pending do lote 03 (1/4)

**Data:** 2026-09-26 · ferramenta: `generate_image` · **10 imagens** · saída bruta:
`art/source/lote-08/` (gitignored). Masters, manifesto e folha de revisão são versionados.

Primeira das quatro rodadas pedidas pelo dono para substituir os **33 sprites pendentes** em
lotes de 10 + 10 + 10 + 3 imagens. Diferente do lote 03, cada chamada produz exatamente um
sprite: isso elimina erros de célula, escala e recorte de folhas 3×3. Ordem desta rodada:
`ic_coin`, `ic_ember`, `ic_star`, `ic_clock`, `ic_flame`, `ic_check`, `ic_chest`,
`ic_booster`, `ic_lock`, `ic_grill_size`.

**Referência passada nas dez chamadas:** `art/source/refs/lote08_icons.png`, remontada apenas
de masters aprovados do lote 05 (`ic_counter`, `ic_plate`, `ic_music`, `ic_brasa_mastery`,
`ic_cos_knife`, `ic_col_molhos`). Ela guia acabamento, volume, contorno e luz — não o assunto.

## Bloco comum literal

> Create exactly ONE isolated mobile game UI icon on a square 1:1 canvas. Match the supplied approved reference paintings in finish only: hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle thick dark-brown outline, rounded bevelled edges, rich tactile material, clean glossy highlight, warm golden-hour key light from upper left. Specifically Brazilian churrasco, friendly and premium, not generic clip art. The silhouette must remain unmistakable at 32 pixels and in grayscale. Center the icon, let it occupy about 68 percent of the canvas, and keep every part fully inside generous margins. Entire unused canvas must be perfectly flat solid chroma magenta #FF00FF all the way to every edge, with no gradient, texture, glow, ground plane or cast shadow on the background. No magenta or hot pink inside the icon. No background plate, frame, badge, border, loose particles, extra object, letters, words, numbers, price, logo, signature or watermark.

Cada chamada recebeu o bloco comum acima, seguido por um dos assuntos literais abaixo.

## 01 — `ic_coin.png`

> SUBJECT: one thick round shiny gold coin, nearly front-facing with a slight three-quarter tilt, with one simple embossed flame emblem centered on its face. Broad readable rim, warm amber shadow, restrained highlight. It must read as a game coin, not a medal, token stack or real-world currency. Exactly one coin.

## 02 — `ic_ember.png`

> SUBJECT: one premium ember currency token: a chunky faceted orange-red coal crystal whose outer silhouette itself resembles a small upright flame. Dark charcoal-red base facets, hot amber core and one golden edge highlight. It must read as a magical glowing ember, not a ruby, diamond, coin or ordinary fire icon. Exactly one connected token.

## 03 — `ic_star.png`

> SUBJECT: one plump five-point gold reward star, straight-on, symmetric, with rounded points, softly inflated 3D volume, amber lower bevel and one cream-gold highlight from upper left. It must read instantly as a three-star result reward. Exactly one star.

## 04 — `ic_clock.png`

> SUBJECT: one round brass kitchen timer, straight-on with a small top knob, thick readable rim, cream dial, simple dark tick marks but NO digits, and one short dark hand pointing upward. Compact chunky silhouette, not a wristwatch, alarm clock or hourglass. Exactly one timer.

## 05 — `ic_flame.png`

> SUBJECT: one lively upright cooking flame made from a connected three-lobed silhouette: terracotta-red outer edge, vivid orange body and warm yellow inner core. Rounded friendly shapes, subtle painted 3D volume, no detached sparks. It must read as heat and churrasco, not a leaf or droplet. Exactly one flame.

## 06 — `ic_check.png`

> SUBJECT: one thick rounded confirmation check mark, muted fresh green with a lighter upper-left bevel and dark-brown outline. Slight three-quarter chunky 3D volume but an absolutely clear check silhouette. No circle, shield or button behind it. Exactly one check mark.

## 07 — `ic_chest.png`

> SUBJECT: one small closed wooden treasure chest in near-front three-quarter view, chunky rounded lid, warm dark wood planks, broad gold trim and one centered brass keyhole. Compact silhouette, no coins, gems or light spilling out, no open lid. Exactly one chest.

## 08 — `ic_booster.png`

> SUBJECT: one small corked glass booster bottle, upright, with a warm golden liquid and one bold golden lightning-bolt shape contained completely inside the bottle. Thick readable glass outline, amber cork, compact silhouette. No label, text, loose lightning or extra potion bottles. Exactly one bottle.

## 09 — `ic_lock.png`

> SUBJECT: one chunky closed brass padlock, straight-on, with a broad rounded shackle, warm gold body, one centered dark keyhole and a small upper-left highlight. Friendly game proportions, unmistakably locked. No chain, key, shield or background plate. Exactly one padlock.

## 10 — `ic_grill_size.png`

> SUBJECT: one connected upgrade icon cluster: a wide dark steel Brazilian barbecue grate seen from slightly above, with five bold parallel bars and a sturdy warm-steel rim; a thick muted-green upward arrow rises from and physically touches the rear center of the grate so the whole design reads as one silhouette. It means bigger grill capacity, not hotter fire. No flame, food, grill body, letters or detached arrow. Exactly one connected icon cluster.

## Estado de aprovação

Este lote entra como `pending`. Geração, recorte e revisão técnica **não são aprovação**. Só o
“ok” explícito do dono permite `set-status` e rebuild do runtime aprovado.

## Registro da execução — 2026-09-26

- Os prompts foram gravados antes da geração; SHA-256 naquele momento:
  `cf909248bfe760e8b8d47d985d7d8ce4bba492ce910b7d19ec755f02ef2c857b`.
- 10 chamadas em paralelo, 10 imagens produzidas, nenhum erro e nenhuma repetição.
- Cada bruto foi recortado como um único sprite transparente; 10/10 entradas seguem
  `pending`, agora atribuídas ao lote 08 em vez do lote 03.
- Revisão técnica: 10/10 `ok`; zero pixels magenta residuais; leitura conferida a 32 px no
  HUD escuro e em escala de cinza sobre fundo claro.
- O processamento revelou que o parser do registro tratava o `\r` final de arquivos CRLF
  como parte da coluna `notes`, podendo apagar notas congeladas de assets aprovados. O parser
  passou a remover esse `\r` e a preservar o estilo de quebra de linha original; reprocessar
  o lote altera somente as dez linhas esperadas.
- Entrega inicial: o runtime permaneceu com 211 sprites enquanto o lote aguardava decisão.
- **Aprovação posterior:** o dono aprovou 10/10 em 2026-09-26, pediu seguir ao lote 09 e
  determinou merge somente depois das 33 imagens. `set-status` aplicado; runtime reconstruído
  para 221 sprites / 3,49 MB WebP.
