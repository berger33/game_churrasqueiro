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

The 2D sprites of the AI art pass (docs/22-ARTE_2D_PLANO.md) follow the same scheme:

```
spr_food_<ingredient>_<raw|rare|medium|well|burned|served>   spr_food_picanha_medium
spr_food_<prep item>_<raw|prep|ready|served>                 spr_food_vinagrete_ready
spr_grill_<churrasqueira>_evo<N>                             spr_grill_lata_valente_evo1
spr_prop_<id>                                                spr_prop_bancada
spr_char_customer_<type>[_a|_b]                              spr_char_customer_apressado_b
bg_restaurant_<restaurant>                                   bg_restaurant_quintal
t_fx_embers_<low|medium|high>                                t_fx_embers_high
```

The doneness states use the simulation's stage ids, so art and rules can never disagree on
what "medium" means. Prep items (`cookMethod: "prep"`) never touch the grill: their frames
follow the prep progress instead.

Every asset carries a sidecar entry in `Assets/Art/ASSET_REGISTRY.csv`:

```
name,category,source,license,version,author,date,status,batch,file,notes
spr_food_picanha_raw,food,ai-assisted,proprietary,1.0,AI image model (Arena agent) + studio review,2026-09-25,pending,lote-01,Assets/Art/Sprites/Food/spr_food_picanha_raw.png,
```

`source` is one of `original` | `ai-assisted` | `ai-assisted-reviewed` | `third-party`.
Anything `third-party` must have a license field that permits commercial use.

**Lifecycle of AI-assisted art:**

1. `tools/art/process-sprites.mjs` writes each new row with `source=ai-assisted` and
   `status=pending`.
2. The owner's decision is recorded with `node tools/art/set-status.mjs <batch> <status> [name…]`.
   `approved` also sets `source=ai-assisted-reviewed`. A refused asset becomes `rejected`, and
   its redo leads the next batch. An approved asset later replaced by a better one becomes
   `superseded`.
3. Only `approved` rows may ship. Re-running the processor never resets a reviewed row
   (status, source and notes are frozen).

Sizes and pivots live in `Assets/Art/sprites.manifest.json`, generated by the same tool.
**Planned:** a CI check (`check-art-registry`, docs/22 §11) will reject any file under
`Assets/Art` that has no registry row, and any row whose file is missing. It is not wired
into the gates yet.

## 12. Prototype implementation status (what this bible looks like in code)

Sections 1–11 specify the Unity target. This section records what the
design-verification prototype **actually renders today**, so the two cannot be
mistaken for one another. The prototype is 2D canvas, not the shader pipeline of
§6; it exists to prove the art *direction* before the art *budget* is spent.

| File | Responsibility |
|---|---|
| `prototype/src/theme.ts` | Palette (§3), type scale (§4), `roundRectPath` (enforces R3's 4 % minimum radius), `panel`/`pill`/`outlinedText`, and the vector icons that replaced every emoji |
| `prototype/src/foods.ts` | One distinct silhouette per ingredient (R2), plus the doneness ramp as a *material* change, never a shape change |
| `prototype/src/main.ts` | Composition: backdrop, grill, HUD, order cards, bench, drag feedback, result screen |

**Rule compliance, verified rather than asserted:**

- **R2 (silhouette-first)** — all 16 ingredients have their own outline, so none
  is a generic rounded rectangle. `npm run check-art` walks the full switch:
  16 ingredients × 8 doneness levels + icon form = 144 draws, each asserted to
  paint, build a path and emit gradient stops. It also asserts `donenessColors`
  stays finite and inside 0–255 at both ends of the ramp.
- **R3 (round everything)** — `roundRectPath` clamps the radius to at least 4 % of
  the smallest dimension, so the rule cannot be violated by a call site passing `0`.
- **R4 (warm light only)** — the key light is a cached golden-hour gradient with a
  warm pool behind the grill; every icon and panel highlight is drawn from the
  warm end of the palette.
- **R5 (one palette)** — `theme.ts` exports a single `C` object; no draw method
  declares its own colour literals for structural surfaces.

**Doneness as material, not shape** (§6's principle, applied in 2D): the
silhouette never changes between raw and burned. Only the fill gradient, the sear
stripes, the sheen and the under-glow change. This is deliberate — a player reads
"is it ready?" from colour and marks, and must never have to re-learn a shape.

**Painted sprites over the procedural art (docs/22 §7.1).** Since the AI art pass, the
prototype draws the **approved** painted sprites wherever they exist:

- foods, crossfaded between neighbouring doneness frames;
- the lata grill in its 3 evolutions, with ember strips per heat zone inside the opening;
- customer portraits;
- the counter and the Quintal scene.

`prototype/src/sprites.ts` loads what `tools/art/build-runtime.mjs` built from `Assets/Art`.
Everything above stays as the fallback, drawn while an image decodes or when it is missing.
`check-art` and `check-render` run without `Image`, so they keep proving the fallback;
`check-shots` renders the painted frames.

**What the prototype does *not* prove:** the `Custom/FoodDoneness` shader of §6,
the lighting rig of §7 and the VFX budgets of §8 are still specification. The asset
registry of §11 exists since the AI art pass (lote 01: 43 sprites approved; lote 02: 50
pending), but its CI check does not yet. The prototype's coals, glow and gradients are canvas
improvisations that will be replaced by real assets; only the direction carries over.

**Verification** — two harnesses execute the shipped render code, because a
typecheck proves compilation and not drawing:

- `npm run check-render` imports the same `dist/bundle.js` the browser loads,
  serves the real tables from `shared/data`, and drives init, a bench-to-grill
  drag, a flip tap and a full turn through to the result screen.
- `npm run check-art` is the silhouette coverage walk described above.

`check-render` has already caught one real regression: dropping the module's
bootstrap block let the bundler tree-shake the entire `Game` class away, shipping
a 175-byte empty bundle that typechecked clean and would have rendered a blank
canvas.
