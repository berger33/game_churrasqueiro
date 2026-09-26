# Lote 06 — prompts (texto exato, gravado antes da geração)

Data: 2026-09-26 · ferramenta: `generate_image`, 10 chamadas · saída: `art/source/lote-06/`
(fora do git; brutos são descartáveis, ver `docs/22-ARTE_2D_PLANO.md` §8).
Plano: `docs/23-PLANO_IMPLEMENTACAO.md` §3 passo 1.2 (conteúdo: docs/22 §6).

**Por que este conteúdo.** Evoluções 2–3 das 3 churrasqueiras (evo 1 aprovadas no lote 04,
usadas como referência, como a lata no lote 02) · as 2 folhas de VFX (fumaça/faíscas,
comemoração) · coleção própria: molhos (4) e equipamentos (9). Nomes dos sprites de
coleção: `spr_col_<refId>` de `collection.json`.

**Referências** (montadas a partir dos masters aprovados com `tools/art/make-ref.mjs`):

| Arquivo de referência | Comando |
|---|---|
| `art/source/refs/ref_grill_chapa_evo1.png` | `make-ref.mjs single … 1408 768 spr_grill_ze_da_esquina_evo1` |
| `art/source/refs/ref_grill_inox_evo1.png` | `make-ref.mjs single … 1408 768 spr_grill_parrilla_chef_cisma_evo1` |
| `art/source/refs/ref_grill_fornalha_evo1.png` | `make-ref.mjs single … 1408 768 spr_grill_fornalha_dragao_manso_evo1` |
| `art/source/refs/ref_food_picanha.png` | idem lote 05 (guia de estilo das folhas de coleção) |

VFX (família nova, sem mestre): sem referência, só o bloco [STYLE].

Blocos **[STYLE]**, **[TECH]**: idênticos a `art/prompts/lote-02.md`.
Bloco **[ICONS9]**: idêntico a `art/prompts/lote-03.md`.

**[GRILLEVO: upgrade]** (segue o padrão do lote 02: mesma câmera, mesma boca)
> Subject: the upgraded version of the grill in the reference image. Keep the SAME grill: same camera angle, same size, same proportions and the same position in the frame; its large horizontal cooking opening stays exactly the same and is left empty so the flat magenta background shows through it, exactly like the reference. Upgrade: UPGRADE. Wide 16:9 image, one single object, centred.

**[FX5]**
> Wide 16:9 image with exactly 5 small game VFX sprites in a single horizontal row, read left to right; each effect sits fully inside its own area, centred, with wide magenta gaps, never touching another. Soft, glowing, juicy mobile-game effects in warm colours.

**[COL4]**
> Wide 16:9 image with exactly 4 collectible sauce items in a single horizontal row, read left to right; one item per position, each fully inside its own area and centred, all at the same scale. Stylised semi-realistic painted objects with soft 3D volume, glossy highlights and a dark-brown outline.

## Imagens

### 1 · `grill_ze_da_esquina_evo2.png` (ref: `ref_grill_chapa_evo1.png`)
[STYLE] [GRILLEVO: "Toldo Novo" — the same humble street-cart grill, now sheltered by a red-and-white striped canvas awning on two thin poles above it; a small side shelf holds a stack of paper plates] [TECH]

### 2 · `grill_ze_da_esquina_evo3.png` (ref: `ref_grill_chapa_evo1.png`)
[STYLE] [GRILLEVO: "Com Fritadeira" — the same street-cart grill with its striped awning, now with a small stainless deep-fryer pot with a wire basket hooked on the side shelf and a hanging string of golden torresmo cracklings on the cart frame] [TECH]

### 3 · `grill_parrilla_chef_cisma_evo2.png` (ref: `ref_grill_inox_evo1.png`)
[STYLE] [GRILLEVO: "Altura Regulável" — the same mirror-finish stainless parrilla on its brick base, now with a visible height-adjustment mechanism: a side crank wheel with a chain and a toothed rack lifting the grate frame] [TECH]

### 4 · `grill_parrilla_chef_cisma_evo3.png` (ref: `ref_grill_inox_evo1.png`)
[STYLE] [GRILLEVO: "Termômetro que Não Mente" — the same stainless parrilla with its crank mechanism, now with a large round precision thermometer on the front panel (tick marks only, no numbers) and a small brass control knob beside it] [TECH]

### 5 · `grill_fornalha_dragao_manso_evo2.png` (ref: `ref_grill_fornalha_evo1.png`)
[STYLE] [GRILLEVO: "Dragão Acordado" — the same masonry firebrick barbecue, now with its wrought-iron dragon ornament bigger and awake: spread wings, glowing amber eyes and a slightly open jaw, still friendly] [TECH]

### 6 · `grill_fornalha_dragao_manso_evo3.png` (ref: `ref_grill_fornalha_evo1.png`)
[STYLE] [GRILLEVO: "Inferno Bom" — the same masonry barbecue with its awake dragon, now with a taller chimney glowing with embers at the rim and thin glowing lava-like cracks across the firebricks] [TECH]

### 7 · `fx_smoke_sparks.png` (sem referência)
[STYLE] Subject: grill smoke and spark effects. [FX5] 1: a soft round puff of white grill smoke, light and wispy. 2: a medium smoke puff, denser and rounder. 3: a big dense smoke billow. 4: a single bright orange spark streak with a warm glow. 5: a small burst cluster of orange sparks flying together. [TECH]

### 8 · `fx_celebration.png` (sem referência)
[STYLE] Subject: celebration effects for perfect serves and rewards. [FX5] 1: a radial golden starburst flash with soft rays. 2: a single shiny gold coin with an embossed flame emblem. 3: a short stack of three gold coins. 4: a dense burst cluster of small confetti pieces in red, gold, green and blue (no magenta, no pink). 5: a glowing golden ring, a flat shockwave circle. [TECH]

### 9 · `col_molhos.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: collectible sauce items. [COL4] 1: a glass jar of molho campanha, chunky tomato-and-onion salsa. 2: a squeeze bottle of creamy white garlic sauce. 3: a tall glass bottle of red pepper sauce with whole peppers inside. 4: a rustic clay bowl of golden farofa toasted manioc flour with a small wooden spoon. Use the reference image only as the guide for painting style, outline and lighting; draw the new items listed here. [TECH]

### 10 · `col_equipamentos.png` (ref: `ref_food_picanha.png`)
[STYLE] Subject: collectible equipment items. [ICONS9] 1: a very long barbecue skewer with a wooden handle (espeto longo). 2: a round grill grate with a ring handle (grelha de argola). 3: a churrasco knife with a wooden handle and a glint on the blade (faca). 4: a moquém, a rustic wooden smoking-rack frame stand (moquém). 5: a straw hand fan for the coals (abanador). 6: a small burlap sack of coarse salt with a salt pile beside it (sal grosso). 7: a golden cookbook with a flame emblem and no letters (livro dourado). 8: a single glossy charcoal lump with tiny cute determined eyes, a mascot (carvão pet — interpretação: ver nota abaixo). 9: an old treasure map with a dotted route to a flame mark, no letters (mapa da brasa). Use the reference image only as the guide for painting style, outline and lighting; draw the new items listed here. [TECH]

**Nota (item 8).** `collection.json` não descreve `carvao_pet` (só `refId`, sem `originKey`
traduzido). Interpretação adotada: mascote — um carvãozinho com olhinhos. Se o dono
preferir outra leitura (ex.: saco de carvão), refação barata no lote 08.

---

## Segunda passada (mesmo dia): 6 churrasqueiras + `fx_celebration`

**Motivo (churrasqueiras).** As 6 evoluções saíram com a boca em trapézio **mais largo em
cima** — perspectiva invertida em relação às evo 1 aprovadas do lote 04 (borda de baixo /
perto mais larga, `aspecto 1.42–1.84:1`, inclinação 0°). Passariam no `holeValidation`
mecanicamente, mas quebrariam a coerência de câmera da família. Correção: segunda
referência com o guia geométrico (`make-ref.mjs grill-guide`) + bloco **[TOPOPEN]**
explícito. Extras: inox evo 2 tinha uma barra cruzando a boca (mecanismo agora
explicitamente fora da abertura); fornalhas mantêm a chaminé curta atrás-à-esquerda
como a referência.

**Motivo (`fx_celebration`).** O confete saiu espalhado em peças desconexas, e o modo
`components` do recorte exige uma peça principal por âncora (`processComponents`:
duas peças grandes na mesma âncora = erro; sem peça = erro). Regenerado com o confete
em pacote denso, todas as peças se tocando.

**[TOPOPEN]**
> The cooking opening is the TOP surface of the grill seen from front and above: a wide trapezoid whose BOTTOM (near) edge is visibly WIDER than its top (far) edge, with the top edge perfectly horizontal; it is completely empty, showing only flat magenta — no grate, bars, coals, chains, mechanisms or objects inside it.

**[GRILLEVO2: upgrade]** (duas referências: [evo1, guia])
> Subject: the upgraded version of the grill in the FIRST reference image. Keep the SAME grill: same materials, same details, same size, same proportions and the same position in the frame. Use the SECOND reference image (geometry plate) for the EXACT perspective, position and shape of the cooking opening. Upgrade: UPGRADE. Wide 16:9 image, one single object, centred.

### Regenerações (refs: [evo1, guia])

- `grill_ze_da_esquina_evo2.png`: [STYLE] [GRILLEVO2: "Toldo Novo" — the same humble street-cart grill, now sheltered by a red-and-white striped canvas awning high above on two poles at the back corners, not covering the cooking opening; a small side shelf holds a stack of paper plates] [TOPOPEN] [TECH]
- `grill_ze_da_esquina_evo3.png`: [STYLE] [GRILLEVO2: "Com Fritadeira" — the same street-cart grill with its red-and-white striped awning high above, now with a small stainless deep-fryer pot with a wire basket hooked on the side shelf and a hanging string of golden torresmo cracklings on the cart frame] [TOPOPEN] [TECH]
- `grill_parrilla_chef_cisma_evo2.png`: [STYLE] [GRILLEVO2: "Altura Regulável" — the same mirror-finish stainless parrilla on its brick base, now with a visible height-adjustment mechanism: a side crank wheel with a chain and a toothed rack, all mounted OUTSIDE the opening on the side and front panels] [TOPOPEN] [TECH]
- `grill_parrilla_chef_cisma_evo3.png`: [STYLE] [GRILLEVO2: "Termômetro que Não Mente" — the same stainless parrilla with its crank mechanism, now with a large round precision thermometer on the front panel (tick marks only, no numbers) and a small brass control knob beside it] [TOPOPEN] [TECH]
- `grill_fornalha_dragao_manso_evo2.png`: [STYLE] [GRILLEVO2: "Dragão Acordado" — the same masonry firebrick barbecue with its short chimney at the back-left like the reference, now with its wrought-iron dragon ornament bigger and awake: spread wings, glowing amber eyes and a slightly open jaw, still friendly] [TOPOPEN] [TECH]
- `grill_fornalha_dragao_manso_evo3.png`: [STYLE] [GRILLEVO2: "Inferno Bom" — the same masonry barbecue with its short chimney at the back-left and its awake dragon, now with a taller chimney glowing with embers at the rim and thin glowing lava-like cracks across the firebricks] [TOPOPEN] [TECH]
- `fx_celebration.png` (sem referência): [STYLE] Subject: celebration effects for perfect serves and rewards. [FX5] 1: a radial golden starburst flash with soft rays. 2: a single shiny gold coin with an embossed flame emblem. 3: a short stack of three gold coins. 4: a dense burst cluster of small confetti pieces in red, gold, green and blue (no magenta, no pink), packed tightly with all pieces touching each other. 5: a glowing golden ring, a flat shockwave circle. [TECH]

---

## Resultado da 2ª passada + plano da 3ª (grills)

Inox evo 3 **passou** (boca 28% área · 72% largura · aspecto 1.841 · 0° — espelha a evo 1:
31% · 74% · 1.839 · 0°) e virou o gabarito. Os outros 5 **falharam no `holeValidation`**:

| Grill | área (≥18%) | largura (≥70%) | inclinação (±2°) | aspecto (1.2–1.9) | causa |
|---|---|---|---|---|---|
| chapa evo 2 | 9.2 ❌ | 58.8 ❌ | −5.6° ❌ | 2.65 ❌ | câmera oblíqua 3/4 + toldo alto com mastros |
| chapa evo 3 | ok | 54.2 ❌ | ok | ok | toldo + prateleira + torresmo estufam a silhueta |
| inox evo 2 | ok | 49.5 ❌ | −3.2° ❌ | ok | oblíqua + manivela para fora |
| fornalha evo 2 | ok | 69.2 ❌ (por 0.8pp) | ok | ok | enquadramento um pouco aberto |
| fornalha evo 3 | 17.5 ❌ | 57.1 ❌ | −14° ❌ | ok | muito oblíqua |

**Regra da 3ª passada (5 imagens):** câmera frontal simétrica como a evo 1 (inclinação 0°);
upgrades **compactos e colados ao corpo** (toldo como capa próxima, sem mastros altos;
manivela/termômetro NO painel frontal; dragão/chaminé sem estender a silhueta); a boca
domina o sprite (≥70% da largura, ≥18% da área). Não afrouxar o contrato: ele garante a
área de toque jogável.
