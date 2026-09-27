# Lote 11 — pratos servidos + Churrascaria de Bairro (4/4, final)

**Data:** 2026-09-26 · ferramenta: `generate_image` · **3 imagens** · saída bruta:
`art/source/lote-11/` (gitignored). Masters, manifesto e revisão são versionados.

O dono aprovou o lote 10 em 2026-09-26. Esta é a última rodada da substituição individual dos
33 sprites antes `pending` no lote 03: dois pratos completam as famílias de contra-filé e
maminha; um fundo completa os sete restaurantes.

## Estratégia de consistência

- Cada prato usa o estado `medium` aprovado no lote 10 como referência principal de identidade
  do corte, mais pratos servidos aprovados como referência de câmera, material e apresentação.
- O contra-filé servido deve ler como fileira linear de fatias retangulares; a maminha, como
  leque assimétrico de fatias em cunha. Os dois pratos não podem virar a mesma composição.
- O fundo usa somente fundos aprovados e ocupa toda a tela 9:16. O centro permanece livre para
  a churrasqueira e as comidas desenhadas pelo jogo.

## 01 — `contra_file_served.png`

`images`: `spr_food_contra_file_medium` (lote 10 aprovado), `spr_food_picanha_served` e
`spr_food_costela_served`.

> Create exactly ONE isolated SERVED FOOD sprite on a square 1:1 canvas for a premium Brazilian churrasco mobile game. Hand-painted stylized semi-realistic casual cooking art, soft chunky 3D volume, subtle dark-brown outline, appetizing tactile meat, warm golden-hour key light from upper left. Fixed food camera: high three-quarter top view at about 55 degrees. One simple warm cream ceramic oval plate, fully visible and centered with generous margin. Entire unused canvas is perfectly flat solid chroma magenta #FF00FF to every edge, with no gradient, texture, table, ground plane or cast shadow. No magenta or hot pink inside the food. No board, grill, grate, skewer, bowl, cutlery, napkin, garnish, herbs, salt, sauce cup, loose ingredient, caption or extra object. No frame, grid, letters, words, numbers, logo, signature or watermark.
>
> SUBJECT: SERVED Brazilian contra-filé. Five thick, even RECTANGULAR strip-loin slices arranged as one tidy straight slightly-overlapping row from left to right, plus one small intact rectangular end piece. Every slice has a thin continuous golden fat rim along only its upper long edge, a rich mahogany seared crust and a restrained juicy rosy medium center. Preserve the long rectangular identity and straight grain of the approved contra-filé reference. The arrangement must not be triangular, fan-shaped or picanha-like. Exactly one plate and one portion; no side dishes.

## 02 — `maminha_served.png`

`images`: `spr_food_maminha_medium` (lote 10 aprovado), `spr_food_cupim_served` e
`spr_food_fraldinha_served`.

> Create exactly ONE isolated SERVED FOOD sprite on a square 1:1 canvas for a premium Brazilian churrasco mobile game. Hand-painted stylized semi-realistic casual cooking art, soft chunky 3D volume, subtle dark-brown outline, appetizing tactile meat, warm golden-hour key light from upper left. Fixed food camera: high three-quarter top view at about 55 degrees. One simple warm cream ceramic oval plate, fully visible and centered with generous margin. Entire unused canvas is perfectly flat solid chroma magenta #FF00FF to every edge, with no gradient, texture, table, ground plane or cast shadow. No magenta or hot pink inside the food. No board, grill, grate, skewer, bowl, cutlery, napkin, garnish, herbs, salt, sauce cup, loose ingredient, caption or extra object. No frame, grid, letters, words, numbers, logo, signature or watermark.
>
> SUBJECT: SERVED Brazilian maminha / tri-tip. Five thick WEDGE-SHAPED slices arranged in a clearly asymmetric open fan that arcs from a broad rounded left side toward one small tapered RIGHT end cap. Each slice follows the curved longitudinal grain and carries a very thin golden fat edge along its outer arc, with mahogany seared crust and a restrained juicy rosy medium center. Preserve the low triangular boat-shaped identity and right-hand taper of the approved maminha reference. It must not become a straight row of rectangular contra-filé slices or a tall round cupim roast. Exactly one plate and one portion; no side dishes.

## 03 — `bg_restaurant_churrascaria_bairro.png`

`images`: approved `bg_restaurant_trailer`, `bg_restaurant_churrascaria_premium` and
`bg_restaurant_quintal`.

### Passada 1 — descartada antes do processamento

Concentrou coifa, grelha inox e balcão no eixo do gameplay. Prompt literal:

> Create exactly ONE full-bleed vertical 9:16 RESTAURANT BACKGROUND for a premium Brazilian churrasco mobile game. Hand-painted stylized semi-realistic casual cooking-game environment, soft chunky 3D forms, warm cohesive palette, clean shapes, rich but controlled detail, cinematic warm interior lighting. Match the supplied approved restaurant backgrounds in brushwork, perspective, saturation and finish. The image must fill every edge: NO chroma background, border, frame, rounded corners or transparency.
>
> SCENE: Churrascaria de Bairro, a welcoming established Brazilian neighborhood steakhouse interior at dinner time — clearly more polished than a trailer, clearly more modest and intimate than a luxury premium steakhouse. Symmetrical high three-quarter view into a cozy dining room. Warm timber ceiling beams, terracotta-and-cream tiled floor, modest wood tables and chairs framing only the far left and far right edges, a compact service counter on the back right, stainless open churrasco kitchen and hood on the back left, small wine racks and simple warm pendant lamps. Amber light, subtle ember glow, lived-in local character. Keep the entire middle third, especially from 32% to 68% of image height, broad, uncluttered and low-contrast for the gameplay grill and food overlays. Strong depth with floor leading lines toward the back wall. Absolutely no people, faces, silhouettes, animals, readable menu, letters, words, prices, logo, brand, sign, watermark, foreground grill, loose food or giant table blocking the center.

### Passada 2 — final processada

Passou a reservar um retângulo central explícito. Prompt literal final:

> Create exactly ONE full-bleed vertical 9:16 RESTAURANT BACKGROUND for a premium Brazilian churrasco mobile game. Hand-painted stylized semi-realistic casual cooking-game environment, soft chunky 3D forms, warm cohesive palette, clean shapes, rich but controlled detail, cinematic warm interior lighting. Match the supplied approved restaurant backgrounds in brushwork, perspective, saturation and finish. The image must fill every edge: NO chroma background, border, frame, rounded corners or transparency.
>
> SCENE: Churrascaria de Bairro, a welcoming established Brazilian neighborhood steakhouse interior at dinner time, more polished than a trailer but clearly more modest than a luxury restaurant. CRITICAL GAMEPLAY COMPOSITION: reserve one huge EMPTY CENTRAL STAGE for an overlaid grill. From 20% to 80% of image width and from 28% to 72% of image height, show ONLY a calm warm plaster back wall transitioning into an uncluttered terracotta-and-cream tiled floor, with low contrast and no furniture, equipment, hood, grill, counter, lamp, shelf or decoration inside that central rectangle. Put a small stainless open-kitchen alcove cropped against the FAR LEFT edge only. Put a compact wood service counter and tiny wine rack cropped against the FAR RIGHT edge only. A few modest wood tables and chairs may be cropped into the extreme lower corners only, never the center. Warm timber ceiling beams and small pendant lamps stay near the top outer edges. Strong symmetrical floor leading lines, amber light, lived-in local Brazilian character. Absolutely no people, faces, silhouettes, animals, readable menu, letters, words, prices, logo, brand, sign, watermark, foreground grill, loose food, giant table or central object.

## Estado de aprovação

O lote entra como `pending`. Revisão técnica não equivale à aprovação. Nesta entrega, nenhuma
das três imagens entra no runtime aprovado antes da decisão explícita do dono.
