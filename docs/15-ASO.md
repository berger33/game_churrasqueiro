# 15 — ASO (§69, §70, §71)

## 1. Keyword research (pt-BR)

| Tier | Keywords |
|---|---|
| Core (high intent) | `churrasco`, `jogo de churrasco`, `churrasqueiro`, `churrascaria`, `picanha` |
| Genre | `jogo de cozinhar`, `cozinha`, `cooking game`, `jogo de restaurante`, `tycoon` |
| Long tail | `simulador de churrascaria`, `jogo de churrasqueiro`, `mestre da brasa`, `espetinho` |
| Retention | `jogo offline`, `jogo grátis`, `jogo casual` |

Title (30 chars): `CHURRASCO! Mestre da Brasa`
Subtitle / short description carries `churrasco` + `churrasqueiro` + `restaurante`.

**Honesty rule:** no competitor names, no fake claims, no keyword stuffing in the visible
title.

## 2. Short description — 3 variants (§69)

**A — skill-led**
> Domine a brasa, acerte o ponto da picanha e transforme seu quintal num império do churrasco.

**B — progression-led**
> Comece no quintal com uma churrasqueira velha e construa a maior churrascaria do Brasil.

**C — culture-led**
> Picanha, linguiça, pão de alho e queijo coalho. O churrasco brasileiro virou jogo.

Test A vs B vs C on the closed track with `ab_test_id`; one variable at a time.

## 3. Icon — 3 concepts (§70)

Requirements: readable at 48 px, no title text, at most two elements, warm palette.

| # | Concept | Why |
|---|---|---|
| 1 | **Picanha slice on glowing coals**, close crop, fat cap visible | The brief's own suggestion; strongest food signal |
| 2 | **Skewer of espetinho crossing a flame**, diagonal | Reads as "Brazilian street BBQ" instantly |
| 3 | **Churrasqueira de alvenaria silhouette with fire**, front-on | Strongest at very small size; weakest food signal |

Generated as `marketing/icon_concept_1..3.png`. Evaluate by greyscale thumbnail at 48 px:
if the silhouette does not read, the concept is out.

## 4. Feature graphic (1024 × 500)

Left: the wordmark. Right: a picanha hitting the grill with sparks. Background: warm bokeh of a
backyard at dusk. No UI screenshots in it — it must look like a poster, not a capture.

## 5. Screenshots — 3 sets (§71)

**Set A — skill**
1. 🔥 DOMINE A BRASA
2. 🥩 ACERTE O PONTO PERFEITO
3. ⚡ COMBO ×10
4. 😱 TÁ QUEIMANDO!
5. 🏆 MESTRE DA BRASA

**Set B — progression**
1. 🏠 COMECE NO QUINTAL
2. 🛒 VÁ PARA A RUA
3. 🚚 MONTE SEU TRAILER
4. 🏪 ABRA SUA CHURRASCARIA
5. 👑 IMPÉRIO DA BRASA

**Set C — culture**
1. 🇧🇷 O CHURRASCO DO BRASIL
2. 🥖 PÃO DE ALHO E QUEIJO COALHO
3. 🗺️ VIAJE PELO PAÍS
4. ⭐ RECEBA CLIENTES VIP
5. 🎉 EVENTOS TODA SEMANA

**Rule:** every screenshot is a real capture with a caption frame composited on top. No mocked
gameplay, no fabricated numbers (§69).

## 6. UA creatives (§72)

10–30 s, five formats:

| Format | Hook |
|---|---|
| Skill | six cuts cooking at once, can the player keep up? |
| Fail | everything burns, chaos, then recovery |
| Challenge | "Você consegue deixar essa picanha no ponto?" |
| Progression | quintal → churrascaria in 15 s |
| Satisfying | macro shots of searing, flipping, slicing |

Captured from real gameplay via a fixed camera rig and a deterministic replay
(the seeded simulator makes reproducible recordings possible — that is what the `seed`
parameter is for).
