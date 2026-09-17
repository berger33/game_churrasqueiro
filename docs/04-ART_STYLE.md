# 04 — Art Style Bible

This document exists **before** any asset is produced in volume, because that is the only
reliable defence against the "asset flip / AI-generated" look the brief explicitly forbids
(§83). Every asset in the project must be checkable against the rules here.

---

## 1. Art direction in one line

> **Warm, appetising, slightly chunky 3D — a Brazilian backyard at golden hour, rendered as if
> it were a high-end picture book.**

Not hyper-real. Not raw low-poly. Not a generic asset-store mix.

## 2. The five rules

| # | Rule | How it is enforced |
|---|---|---|
| R1 | **One material system for all food** | Every edible uses `Custom/FoodDoneness`. No exceptions. |
| R2 | **Silhouette first** | Every prop/character must be identifiable as a solid black shape at 64 px |
| R3 | **Round everything** | No sharp corners on anything the player touches; bevel radius ≥ 4 % of the object's smallest dimension |
| R4 | **Warm light only** | Key light 3200–4200 K. No cool/white key light in any gameplay scene |
| R5 | **One palette** | Any new colour must be sampled from the palette below or rejected |

## 3. Palette

| Role | Name | Hex | Use |
|---|---|---|---|
| Base | Carvão | `#1C1512` | backgrounds, deep shadow |
| Base | Cinza Quente | `#3A2E28` | grill body, metal shadow |
| Base | Madeira | `#7A4A2A` | tables, fences, handles |
| Base | Madeira Clara | `#B98A55` | benches, boards |
| Metal | Inox | `#C8CDD2` | premium grills, tools |
| Metal | Ferro | `#5C5A58` | hardware, hooks |
| Fire | Brasa | `#E0561F` | embers, hot coals |
| Fire | Chama | `#F2A63B` | flame tips, highlights |
| Fire | Vermelho Queimado | `#A32E1C` | accent, danger |
| Neutral | Creme | `#F4E7D3` | text on dark, plates |
| Neutral | Off-white | `#FBF5EC` | cards |
| Success | Verde Brasa | `#6FA84A` | perfect, confirm |
| Warning | Âmbar | `#E8B23C` | patience warning |
| Danger | Telha | `#C0442E` | burned, error |
| Premium | Ouro Brasa | `#E7C24A` | VIP, embers currency, pass |

**Usage discipline:** the fire colours are the *only* saturated colours allowed in gameplay
space. UI chrome is Carvão/Madeira/Creme. Accent colour appears at most once per screen.

## 4. Typography

| Role | Family | Fallback | Notes |
|---|---|---|---|
| Display / logo | Rounded geometric grotesque, heavy (e.g. a Baloo/Lilita-class face) | system | Only for logo, big numbers, milestone text |
| UI | Humanist sans, medium/semibold | system | All labels, buttons |
| Numeric | Same family, tabular figures | — | Coins, timers, counters — must not jitter |

Sizes (at 1080 × 2340, scaled by `Canvas.scaleFactor`):

| Token | px | Use |
|---|---|---|
| `display-xl` | 72 | combo, level-up |
| `display-l` | 56 | reward amounts |
| `title` | 40 | screen titles |
| `body-l` | 32 | primary buttons |
| `body` | 28 | standard labels |
| `caption` | 22 | secondary info — **never smaller** (accessibility, §55) |

Contrast: minimum **4.5:1** for body text, **3:1** for large text. Verified against the
palette in `tools/studio/check-contrast` (see [11-QA.md](11-QA.md)).

## 5. Modelling rules

- **Scale:** 1 unit = 1 metre. A picanha is ~0.22 m across.
- **Topology:** quads only, no ngons, no poles with > 5 edges in a deformation zone.
- **Budget per asset:** food ≤ 1 200 tris, characters ≤ 4 500 tris, props ≤ 2 500 tris,
  environments ≤ 40 000 tris total on screen.
- **UV:** single atlas per category; no overlapping UVs except mirrored symmetric parts.
- **Bevels:** every silhouette edge gets a bevel or a chamfer. Hard 90° edges read as
  "asset store".
- **Proportions (characters):** 3.5 heads tall, hands ~1.4× realistic, feet exaggerated.
  Friendly, never cute-infantile.

## 6. The food shader (the single most important asset)

One parametrized material, `Custom/FoodDoneness`, drives **all** cooked visuals. It takes:

| Property | Range | Driven by |
|---|---|---|
| `_Rawness` | 0–1 | `1 − clamp(overallDoneness / 0.95, 0, 1)` |
| `_Browning` | 0–1 | remapped doneness |
| `_GrillMarks` | 0–1 | contact time on the grate |
| `_Burned` | 0–1 | `max(0, overallDoneness − 1.0) / 0.2` |
| `_FatSheen` | 0–1 | per-ingredient (`art.fatSheen`) |
| `_Marbling` | 0–1 | per-ingredient |
| `_Melt` | 0–1 | per-ingredient (cheese) |
| `_Wetness` | 0–1 | rising with doneness — the "juicy" look |
| `_HeatGlow` | 0–1 | zone heat × charcoal efficiency |

Why this matters:
- **Memory:** one material instance per food type instead of N models per doneness stage.
- **Consistency:** every cut browns the same way, so the game cannot look stitched together.
- **Data-driven:** the values come straight from the simulation, so visuals and rules cannot
  drift apart.

Base textures are a small set of tileable maps (raw meat fibre, char, fat, charred crust)
blended by the shader — **not** per-item baked textures.

## 7. Lighting

- **Key:** warm directional, 3400 K, 45° elevation, always from the upper-left in portrait.
- **Fill:** baked ambient from the environment, warm bounce.
- **Practical:** the coals are the emotional light source — an area light whose intensity
  tracks `charcoalEfficiency`, so the scene visibly dims as the fire dies. This is a
  *gameplay* light, not decoration.
- **Post:** bloom on HIGH/MEDIUM only. No depth of field in gameplay (it hides doneness cues).
- No real-time shadows on LOW; hard-only on MEDIUM.

## 8. VFX

| Effect | Trigger | Budget (HIGH) |
|---|---|---|
| Smoke wisp | food on grill, rising with doneness | 1 system, pooled, 12 particles |
| Ember sparks | flip, high zone | burst 6, pooled |
| Fat drip | high doneness on fatty cuts | 1/s |
| Heat shimmer | high zone | 1 distortion quad |
| PERFECT burst | perfect serve | burst 10 + ring |
| Combo flare | combo milestone | burst 18 + screen edge glow |
| Coin trail | reward | pooled, 1 per 40 ms |
| Level up | level-up | rays + confetti |

Multiplied by `performance.json → particlesMultiplier` (LOW 0.35, MEDIUM 0.7, HIGH 1.0).
**Rule: no VFX may obscure a doneness cue.** Smoke density is capped for exactly this reason.

## 9. UI design system

- **Buttons:** 3 variants only — `primary` (Brasa fill, Creme label), `secondary` (Madeira
  outline), `ghost` (text only). States: default / pressed (scale 0.96 + darker) / disabled
  (40 % alpha + desaturated) / loading (spinner, never a frozen button).
- **Cards:** 24 px radius, 2 px warm inner stroke, soft outer shadow (0 8 24, `#1C1512` @ 35 %).
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Nothing else.
- **Iconography:** 2 px stroke, rounded caps, filled only for currency. One grid (24 px).
- **Motion:** squash & stretch capped at 8 %. Durations 120–260 ms. Ease-out for entrances,
  ease-in for exits. `reduceMotion` setting halves all durations and removes scale pulses.

## 10. Anti-"AI look" checklist

Run before any asset is approved:

- [ ] Would this asset look at home next to the existing ones at 25 % zoom?
- [ ] Is the silhouette readable as a black shape?
- [ ] Does it use only palette colours?
- [ ] Are all edges bevelled?
- [ ] Does it avoid "generic fantasy" tells — no gratuitous glow, no chrome, no lens flare?
- [ ] If it is food: does it use `Custom/FoodDoneness` and nothing else?
- [ ] Is it *specifically Brazilian* rather than generically "BBQ"? (A churrasqueira de
      alvenaria is not a Weber kettle.)

## 11. Asset naming and metadata (§107)

```
<category>_<subject>_<variant>_<lod>
sm_food_picanha_raw_l0
sm_char_customer_tio_l0
t_ui_atlas_main
vfx_smoke_wisp
sfx_grill_sizzle_loop
```

Every asset carries a sidecar entry in `Assets/Art/ASSET_REGISTRY.csv`:

```
name, category, source, license, version, author, date
sm_food_picanha_raw_l0, food, original, proprietary, 1.0, studio, 2026-09-17
```

`source` is one of `original` | `ai-assisted-reviewed` | `third-party`. Anything
`third-party` must have a license field that permits commercial use. A CI check rejects
assets without a registry row.
