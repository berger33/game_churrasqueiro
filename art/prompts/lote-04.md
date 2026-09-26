# Lote 04 — refação das churrasqueiras interativas

Data: 2026-09-26 · saída bruta descartável: `art/source/lote-04/` (ignorada pelo Git).

## Objetivo

Refazer as evo 1 do Zé da Esquina, Parrilla Chef Cisma e Fornalha Dragão Manso. No lote 03, a
abertura de cocção ficou como uma janela pequena na fachada. As imagens finais agora usam apenas
um guia de geometria por geração: fotos/desenhos antigos com janelinhas foram excluídos das
referências visuais para não puxar o resultado de volta ao defeito anterior.

## Contrato de geometria

`art/guides/lote-04/grill-*.png` é o molde autoritativo. A abertura é a área magenta no plano
superior, e não um interior sombreado:

- recorte grande, central, contínuo e fechado, com interior e fundo externo em magenta uniforme
  para o chroma key;
- largura detectada de pelo menos 70% do sprite e área útil de pelo menos 18%; aspecto do leito
  entre 1,2:1 e 1,9:1;
- borda posterior quase horizontal (inclinação máxima de 2°);
- sem paredes/fundo pintados dentro do furo, barras, grelha, brasas, fogo, fumaça, comida ou
  reflexos. O jogo compõe grelha, calor, zonas e alimentos sobre essa superfície;
- silhueta isolada e conectada, sem cenário, sombra no chão, texto, logo ou marca d'água;
- acabamento casual premium, pintado à mão, volume suave, contorno escuro discreto e luz quente.

`tools/art/process-sprites.mjs` aplica essas medidas como contrato executável e falha antes de
escrever masters se uma abertura ficar pequena, inclinada ou estreita demais.

## Instruções finais usadas

As três gerações usaram **somente o guia correspondente como referência de imagem**. O texto
base, aplicado a cada uma, foi:

> Create the finished sprite by repainting the ONE supplied layout image. It is an immutable
> layout and cutout stencil, not a suggestion. Keep its exact silhouette, camera, composition,
> and especially the large opening geometry. HARD CHROMA-KEY MASK: every magenta pixel in the
> guide—including the entire giant central trapezoid and the exterior background—must remain
> perfectly uniform pure #FF00FF. Do not paint over, shade, gradient, reflect, darken, or add
> anything to any magenta pixel. The central magenta region is a literal transparent cut-out for
> the game, NOT a dark cavity: no inner walls, no floor, no back wall, no reflection. Keep the
> continuous slim raised rim exactly around it. The opening remains at least 75% of sprite width,
> roughly 1.4:1 width-to-depth, with a horizontal far rim. Repaint ONLY the non-magenta grill
> surfaces as a high-quality warm hand-painted casual-mobile-game asset. Preserve the guide's
> compact proportions. No extra slabs, no enlarged outer frame, no new opening, no front window,
> no grate, bars, fire, coals, food, smoke, cast shadow, scenery, text, letters, logos, watermark,
> or detached objects. One complete centred object with clear safe margins.

Detalhes por sprite:

- **Zé da Esquina:** aço preto temperado, chaminé compacta, prateleira lateral discreta, carrinho
  conectado com rodízios; realçar metal pintado e bordas gastas.
- **Parrilla Chef Cisma:** inox escovado/polido, pedestal de tijolo vermelho, termômetro frontal
  pequeno, apoio e chaminé compactos.
- **Fornalha Dragão Manso:** tijolo refratário vermelho, peitoril de pedra, chaminé curta conectada
  e pequeno dragão de bronze simpático; churrasqueira aberta, nunca forno de pão.
