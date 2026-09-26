# Lote 07 — prompts exatos (gravados ANTES da geração)

Data: 2026-09-26 · base: `main` / PR #10 (`a404034`) · branch: `arena/01a0df4e-game-churrasqueiro`.
Estado inicial: 10 imagens planejadas; aprovação exclusivamente do dono, lote completo.
Leituras: docs/22 (especialmente §6), docs/23-PLANO_IMPLEMENTACAO (passo 1.3), docs/04 §11; dados collection/events/iap/pass/regions/route/achievements.

## Decisões de escopo e contrato

- O resumo “7 churrasqueiras especiais” corresponde nos dados a 6 grillSkin + troféu Coroa da Brasa; a Medalha da Picanha completa os 8 itens da imagem 01.
- Miniaturas de coleção são `spr_col_*`, não molduras `spr_grill_*` de gameplay: interior pintado, nenhum contrato de boca alterado. Não substituir os grills dos lotes 03/06.
- IAP `brasa.coins.*` contém **brasas** conforme `contents`, apesar do id legado. Preços, quantidades, nomes e benefícios são UI, não arte.
- Conquistas: 5 molduras = tiers 1–5 reais dos dados; centros vazios para símbolos sobrepostos.
- Mapa: fundo ilustrativo sem trajetos/pins fixos; 16 paradas e ordem regional vêm de route.json, inclusive retorno final ao Sudeste. Sem inventar progresso pintado.
- Key art é arte da tela-título, não screenshot da loja. Stores ficam no lote 08.
- As imagens 08/10 são cenas opacas; as outras usam chroma magenta. 10 imagens → 34 sprites esperados.
- Referências abaixo foram reconstruídas via `make-ref.mjs` exclusivamente de masters `approved`. Raw/refs permanecem ignorados; masters, spec, prompts e revisão são versionados no mesmo turno.

## Recriar referências após wipe

```sh
npm install
node tools/art/make-ref.mjs grid art/source/refs/lote07_collection.png 1200 800 3 2 spr_grill_lata_valente_evo1 spr_grill_parrilla_chef_cisma_evo1 spr_col_grelha_argola spr_col_livro_dourado spr_col_mapa_brasa spr_col_sal_grosso
node tools/art/make-ref.mjs grid art/source/refs/lote07_food.png 1200 800 3 2 spr_food_picanha_medium spr_food_linguica_toscana_medium spr_food_espetinho_misto_medium spr_food_costela_medium spr_food_queijo_coalho_medium spr_food_legumes_grelhados_medium
node tools/art/make-ref.mjs grid art/source/refs/lote07_rewards.png 1200 800 3 2 ic_cos_apron ic_cos_knife ic_brasa_mastery ic_imperio spr_col_livro_dourado spr_col_carvao_pet
node tools/art/make-ref.mjs single art/source/refs/lote07_quintal.png 864 1536 bg_restaurant_quintal
node tools/art/make-ref.mjs single art/source/refs/lote07_festival.png 864 1536 bg_restaurant_festival
```

Os blocos abaixo são o valor literal completo de `prompt`; `images` e `file_path` também estão registrados. Nenhuma aprovação técnica equivale ao “ok” do dono.

## 01 — Coleção: 6 churrasqueiras + coroa + medalha

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/col_churrasqueiras.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_collection.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Landscape sheet, exactly EIGHT collectible miniatures in a strict FOUR columns by TWO rows grid. Camera consistent near-front three-quarter view, horizontal upper rims. These are COLLECTION ICONS with painted solid interiors, NOT playable grill frames; do not paint magenta holes. Row one left to right: traditional Brazilian terracotta brick masonry churrasqueira with chimney; homemade horizontal half-drum charcoal grill on short legs; brushed warm stainless-steel rectangular parrilla with small crank; luxurious dark stone and brass Brazilian restaurant grill. Row two left to right: compact fogo-de-chao arrangement, costela on two angled long skewers around a contained ember bed on a small oval earthen base; rectangular charcoal grill decorated with a restrained amber neon flame tube on its front, no pink or blue neon; Coroa da Brasa trophy, a chunky gold crown with three flame-shaped points on a dark wooden cushion; Medalha da Picanha trophy, a round gold medallion embossed with a triangular picanha steak and attached terracotta ribbon. Each collectible has a different readable silhouette at 48 pixels. No loose decorative particles.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 02 — Eventos semanais (4)

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/eventos_semanais.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_food.png", "/home/user/game_churrasqueiro/art/source/refs/lote07_festival.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Portrait sheet, exactly FOUR separate wide rounded rectangular event banner paintings, ONE column by FOUR equal rows. Each banner about 3.2:1 width to height, centered within its row, with wide magenta separation. All four have the same size. The LEFT half of each banner is quiet warm charcoal/wood tonal space for future UI text; the hero food occupies the RIGHT half, no text painted. Top to bottom: golden grilled Brazilian linguica toscana links with sear marks and herbs on a wooden board; juicy triangular picanha steak with fat cap and a few slices, warm amber backdrop; three horizontal Brazilian mixed meat and vegetable skewers with visible wooden tips, appetizing grill marks; weekend backyard churrasco spread with picanha and queijo coalho, tiny warm festoon lamps along the upper edge and a lively amber ember bed. Keep everything inside each rounded banner silhouette. No people, plates must not spill into the gutters.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 03 — Carnaval, Junina, Férias, Inverno

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/eventos_sazonais_a.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_food.png", "/home/user/game_churrasqueiro/art/source/refs/lote07_festival.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Portrait sheet, exactly FOUR separate wide rounded rectangular event banner paintings, ONE column by FOUR equal rows. Each banner about 3.2:1 width to height, same size, centered in its row with wide magenta separation. LEFT half quiet warm charcoal/wood space for future UI text, decorative hero cluster confined to RIGHT half. Top to bottom: Brazilian Carnaval churrasco, a gold and terracotta carnival eye mask, curled gold paper ribbons and grilled skewers; Festa Junina, straw hat, cream and terracotta bunting, grilled corn and small corn bread on rustic wood; Brazilian July beach holidays, grilled queijo coalho on wooden sticks, warm sand, muted green palm frond and cream parasol; Brazilian winter churrasco, slowly roasted beef ribs beside a cozy brick hearth, cream knitted cloth, warm amber firelight with no snow. Restrained festive details, no magenta or purple feathers, no cold lighting, no text or people. Keep all decoration within each banner.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 04 — Primavera, Natal, Ano-novo

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/eventos_sazonais_b.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_food.png", "/home/user/game_churrasqueiro/art/source/refs/lote07_festival.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Portrait sheet, exactly THREE separate wide rounded rectangular event banner paintings, ONE column by THREE equal rows. Each banner about 3.2:1 width to height, same size, centered in its row with wide magenta separation. LEFT half quiet warm charcoal/wood tonal space for future UI text; all hero decoration on RIGHT half. Top to bottom: Brazilian spring garden churrasco, grilled vegetable platter with zucchini and peppers, cream blossoms and restrained green leaves; Brazilian summer Christmas churrasco, golden roast festive chicken on a platter, terracotta ribbon and warm golden string lights, tropical leaves, absolutely no snow; Brazilian New Year churrasco, small open wooden reward chest with gold ember tokens, cream ribbon curls and a few contained golden firework rosettes in the banner sky. No champagne or alcohol focus, no year digits. Every ornament fully contained in its banner.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 05 — IAP: starter, sem intersticiais, brasas pequena/média

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/iap_a.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_rewards.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Square sheet, exactly FOUR isolated store product illustration clusters in a TWO columns by TWO rows grid. Three-quarter front view. Row one left: starter kit, compact wooden crate carrying a terracotta master cook apron with small gold flame emblem, a few round gold coins, faceted orange ember tokens and a small gold tipping bell, all connected as one clean product cluster. Row one right: no-interstitials entitlement, a chunky cream shield with a terracotta diagonal slash over a small embossed video-screen symbol, subtle gold edge; NO coins, no reward chest, no claim that all optional rewarded videos disappear. Row two left: SMALL ember pack, a small open brown cloth pouch with a few chunky faceted orange glowing coal tokens. Row two right: MEDIUM ember pack, a medium open wooden box holding noticeably more of exactly the same faceted orange coal tokens. Currency packs contain EMBERS, not gold coins or diamonds. Readable silhouette and amount progression without numbers. No price tags, tickets with writing or promotional ribbons.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 06 — IAP: brasas grande, passe, pacote do passe

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/iap_b.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_rewards.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Wide landscape sheet, exactly THREE isolated store product illustration clusters in a THREE columns by ONE row grid. Three-quarter front view. Left: LARGE ember pack, a broad open dark wooden chest with brass corners filled with many chunky faceted orange glowing coal tokens, unmistakably larger capacity than a pouch, not gold coins or diamonds. Middle: premium season pass, one upright thick cream and gold admission ticket with a simple embossed orange flame emblem, no writing, supported by a small connected pile of faceted orange ember tokens. Right: premium pass bundle, the SAME cream and gold flame ticket beside a compact ascending three-step gold podium and a larger attached pile of the SAME orange ember tokens; the steps suggest tier advancement without digits. Keep ticket silhouettes and materials consistent. Exactly one cluster in each cell, attached parts, no floating sparkles, no price tags or promotional text.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 07 — Brasa Pass: arte de temporada

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/brasa_pass.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_rewards.png", "/home/user/game_churrasqueiro/art/source/refs/lote07_quintal.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Landscape canvas, exactly ONE wide 2:1 rounded rectangular season-pass hero banner, fully inside the canvas with a magenta margin. Neutral evergreen Brasa Pass season identity, not tied to a specific holiday. LEFT 48 percent of the banner is quiet dark warm wood with subtle golden-hour light, reserved for localizable title and track UI. RIGHT half features a terracotta premium cook apron with a stitched gold flame emblem, a tasteful brass-handled chef knife laid safely flat on a small wooden board, a little charcoal grill with gold trim and an embossed flame medal. All form a connected carefully arranged still life. Background inside the banner is a softly painted Brazilian backyard with restrained warm hanging lights. No reward quantities, track nodes, currencies, padlocks, people or implied exclusive gameplay power. Everything contained within the rounded banner.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 08 — Mapa ilustrado da Rota da Brasa

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/mapa_rota.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_quintal.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Create a portrait illustrated map backdrop of BRAZIL for a Brazilian culinary travel game. Clearly recognizable Brazil land silhouette in correct north-up orientation, with the broad Amazon north in the upper left, northeast bulge upper right, southeastern coast lower right and tapering southern states at the bottom. Brazilian territory centered on warm cream parchment; surrounding ocean is very muted warm grey-green, not saturated blue. Softly bevelled low-poly-like terrain masses rendered in the reference hand-painted finish. Suggest all FIVE macroregions through natural terrain: dense rounded green forest and a broad Amazon river in the north; sun-warmed coast and sparse inland vegetation in the northeast; central cerrado grassland and wetland in the center-west; green hills and a tiny terracotta-roof town in the southeast; rolling pasture and small araucaria trees in the south. Give each region equal visual care, no people or stereotypes. Keep broad calm clearings across all regions for future route stop overlays. Geographic silhouette first, decorative detail second. Do NOT paint roads, dotted paths, pins, badges, stars, stop circles, state borders, region dividers or any text. The sixteen route stops and their exact progression will be rendered separately from data. Top 12 percent and bottom 10 percent quiet parchment for UI.

TECHNICAL: One continuous full-bleed opaque portrait illustration, 9:16 composition. No magenta background, no transparency, no frame, no captions, no letters, words, numbers, logos, signatures or watermarks anywhere. All text and interactive UI will be added by the game, never painted into this image.
```

## 09 — Medalhas de conquista: tiers 1–5

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/medalhas_conquista.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_rewards.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Wide landscape sheet, exactly FIVE achievement medal FRAMES in a FIVE columns by ONE row grid, consistent straight front view, equal overall size and identical large round blank center disks. These are reusable tier frames for 58 achievements, not five individual achievement symbols. Left to right: tier one, simple warm iron ring with two short brown ribbon tails; tier two, brushed copper ring with terracotta tails and two small side notches; tier three, warm silver ring with cream tails and two short symmetrical laurel sprigs; tier four, gold ring with terracotta tails and a fuller symmetrical laurel wreath; tier five, heavier gold ring with a small flame-shaped crown attached at the top and broad cream/gold ribbon tails. Progressive silhouette complexity must distinguish tiers in grayscale. Each central disk is plain solid dark warm charcoal, identical diameter, occupying at least half the medal width, completely EMPTY so the game can overlay a localized achievement symbol. No pictograms in the disks, no stars, no numerals, no words. Separate complete medals with wide magenta gutters.

TECHNICAL: Entire unused canvas is perfectly flat solid chroma magenta #FF00FF, including wide gutters and outer margins. No magenta or hot pink inside any painted item. Exactly the requested item count, one complete separate item per cell, in reading order. All silhouettes fully inside their cells with generous breathing room. No ground plane, cast shadow outside an item, grid lines, extra objects, borders around the sheet, letters, words, numbers, prices, labels, logos, signatures or watermarks anywhere. Only the game adds localizable text.
```

## 10 — Key art da tela-título

`file_path`: `/home/user/game_churrasqueiro/art/source/lote-07/key_art_titulo.png`

`images`: ["/home/user/game_churrasqueiro/art/source/refs/lote07_food.png", "/home/user/game_churrasqueiro/art/source/refs/lote07_quintal.png"]

```text
Hand-painted premium casual cooking game art, stylized semi-realistic soft chunky 3D volume, subtle dark brown outlines, rounded bevelled edges, rich tactile materials and appetizing food sheen. Specifically Brazilian churrasco, not generic American BBQ. Warm golden-hour key light from upper left only. Palette: charcoal #1C1512, warm grey #3A2E28, wood #7A4A2A and #B98A55, warm steel #C8CDD2, ember #E0561F, amber #F2A63B, terracotta #A32E1C, cream #F4E7D3, muted green #6FA84A, gold #E7C24A. Match the supplied approved reference paintings in finish, not their sheet layout.

Create the title-screen KEY ART for a Brazilian backyard churrasco mobile game, portrait 9:16. A welcoming sunlit Brazilian quintal with terracotta paving, banana leaves at the sides, rustic wood, a few warm festoon lamps and distant clay-tile rooftops. A homemade horizontal half-drum charcoal churrasqueira occupies the lower-middle foreground, seen from a slightly elevated three-quarter frontal angle with the long cooking edge horizontal. On its warm grate: one unmistakable juicy triangular picanha with fat cap and grill marks, two golden linguica toscana links, one garlic bread and one queijo coalho skewer; chunky appetizing shapes matching the reference, not a huge pile. A small wooden serving board peeks from the bottom left with sliced steak and vinaigrette bowl. Warm restrained embers underneath, delicate wisps of steam, no aggressive flames. Inviting high-end picture-book game illustration, composition led by the food. NO people, hands, mascots, logos or lettering. Upper 30 percent is calm warm honey sky and softly lit plaster, open and low-detail for the typographic game logo. Bottom 15 percent is low-detail dark warm wood for the play button. Keep primary food focal point between 40 and 72 percent of image height; important silhouettes away from phone crop edges. This is title art, NOT a gameplay screenshot.

TECHNICAL: One continuous full-bleed opaque portrait illustration, 9:16 composition. No magenta background, no transparency, no frame, no captions, no letters, words, numbers, logos, signatures or watermarks anywhere. All text and interactive UI will be added by the game, never painted into this image.
```

## Registro da execução — 2026-09-26

- Os 10 prompts acima foram gravados **antes** da primeira chamada; SHA-256 do arquivo naquele momento: `ff286c147936031ce7ee52e184752f226dc6a1d10c6c0b3c2925f25c01c91200`.
- Primeira rodada: 10 chamadas, **9 arquivos** produzidos. A imagem 05 (`iap_a.png`) retornou erro sem imagem (`finishReasons: MAX_TOKENS`). Tentativa de repetir exatamente o mesmo prompt foi bloqueada: `Image generation limit of 10 reached for this turn`.
- Não houve refações, novas variantes solicitadas nem aprovação. **Repetir somente a imagem 05 no próximo turno**, com o prompt literal já salvo.
- O gerador duplicou as linhas das imagens 06 e 09. `art/prepare-lote-07.mjs` seleciona apenas a linha superior conforme `sourcePreparation` no spec, sem alterar os originais. Os 3 produtos e as 5 medalhas pedidos foram preservados; as variantes extras NÃO entram no registro nem na contagem do lote.
- Originais e refs ficam ignorados como nos lotes anteriores. Os 30 masters processados desta parcial estão versionados; faltam 4 sprites da folha IAP 1/2 para os 34 esperados.
- `review-sheet` agora aceita `reviewLayout: "meta"`, com banners, ícones, retratos de mapa/key art e montagem estática de telas de metajogo. Os layouts antigos permanecem no caminho original. Nenhum código de gameplay foi alterado.
