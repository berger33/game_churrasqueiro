# 10 — Audio

## 1. Identity

Warm, acoustic, Brazilian without caricature. The reference feeling is a real backyard
churrasco on a Sunday afternoon: charcoal crackle, distant conversation, a nylon-string guitar,
light percussion. **No samba-whistle-carnival shorthand.**

## 2. The most important sound in the game

The sizzle. It is the product's signature and it gets the most budget:

- Layered loops: base fat sizzle + charcoal crackle + a high "sear" layer whose gain tracks
  doneness rate.
- On **flip**: a short 300 ms `TSSSS` transient with a pitch drop, plus a randomised crackle
  burst. Four variants, no two plays identical in a row.
- Intensity maps to `zoneHeat × charcoalEfficiency`, so a dying fire audibly calms down.

## 3. Asset list (MVP)

| id | Type | Notes |
|---|---|---|
| `sfx_grill_sizzle_loop` | loop | 3 intensity layers |
| `sfx_charcoal_crackle_loop` | loop | low bed |
| `sfx_flip` | one-shot | 4 variants |
| `sfx_place` | one-shot | 2 variants |
| `sfx_serve` | one-shot | plate + cloth |
| `sfx_perfect` | one-shot | bright sting, 3 variants |
| `sfx_good` | one-shot | soft blip |
|`sfx_burned` | one-shot | hiss + dull thud |
| `sfx_combo_3/5/10/15/20` | one-shot | rising series |
| `sfx_coin` | one-shot | 3 variants, pitched up in a run |
| `sfx_order_in` | one-shot | bell |
| `sfx_customer_happy` | voice | per voice set |
| `sfx_customer_angry` | voice | per voice set |
| `sfx_customer_impatient` | voice | per voice set |
| `sfx_upgrade` | one-shot | coin cascade |
| `sfx_level_up` | one-shot | fanfare, short |
| `sfx_vip_arrive` | one-shot | special sting |
| `sfx_charcoal_low` | one-shot | warning |
| `sfx_ui_tap/back/error` | one-shot | UI kit |

Voice sets: `casual_m`, `casual_f`, `fast_m`, `warm_m`, `uncle`, `young_f`, `tourist`,
`family`, `rival`, `vip` — 3 short non-verbal reactions each (no intelligible dialogue, which
keeps localisation free).

## 4. Music

Original score, two layers:

| Track | Use | Length |
|---|---|---|
| `mus_home` | establishment screen | 2:00 loop |
| `mus_gameplay` | turn | 2:30 loop, intensity layer added above combo ×5 |
| `mus_result` | result card | 0:12 |
| `mus_event` | seasonal events | 2:00 loop per season |

Instrumentation: nylon guitar, cavaquinho, pandeiro, upright bass, light shaker. Tempo
92–104 BPM. Duck 6 dB under any UI sting.

## 5. Mix and settings

| Bus | Default | Range |
|---|---|---|
| Master | 0 dB | mute |
| Music | −4 dB (0.6) | 0–1 |
| SFX | −1.4 dB (0.85) | 0–1 |
| Voice | −2 dB | 0–1 |

Independent music/SFX sliders and a mute (§53). Max 12 simultaneous voices; oldest
non-essential voice is stolen. Sizzle is **never** stolen — it is gameplay information.

## 6. Status

**No audio is recorded yet.** The asset list in §3 is the specification.

The prototype now carries WebAudio-synthesised placeholders so the *rhythm* of the feedback
can be evaluated before any recording budget is spent — implemented in
`prototype/src/audio.ts`. Every placeholder is **not shippable** (§82) and keeps the id from
§3, so swapping in a recording is a one-line change per cue.

What is wired, and where:

| Cue | Fired by |
|---|---|
| `sfx_flip` | tap on a grill item — 4 variants, never the same twice in a row (§2) |
| `sfx_place` | drop onto a zone, and charcoal refill |
| `sfx_serve` | a customer's order completes |
| `sfx_perfect` / `sfx_good` | serve quality, from the simulation's own event |
| `sfx_burned` | the `burned` event |
| `sfx_coin` | each serve — pitch climbs through a run, resets after 1.2 s (§3) |
| `sfx_order_in` / `sfx_vip_arrive` | customer spawn, split on `isVip` |
| `sfx_combo_*` | combo milestone, tier picked from the combo count |
| `sfx_charcoal_low` | the `charcoal_low` event |
| `sfx_level_up` | turn end |
| `sfx_ui_tap` / `sfx_ui_error` | bench pickup; grill full, customer walked, title start |
| `sfx_grill_sizzle_loop` + `sfx_charcoal_crackle_loop` | continuous bed over the whole turn |

The sizzle bed is the §2 behaviour, not just a loop: its gain and low-pass cutoff track
`hottestZoneHeat × charcoalEfficiency × grillLoad`, so a dying fire audibly calms down and a
loaded grill sizzles harder than an empty one at the same temperature.

**Direction compliance (§1):** every cue is built from low-passed noise beds and warm triangle
tones. There is no percussion layer and no carnival shorthand — the identity is held by the
sizzle and the crackle, not by instrumentation.

**Browser constraint:** the `AudioContext` is created lazily on the first `pointerdown`, because
browsers block audio until a user gesture. Constructing it at load would leave the game silent.

**Verified by** `npm run check-render`, which stubs `AudioContext` and asserts the cue code
actually schedules nodes — without the stub the layer would take its "no WebAudio" early return
and silently execute nothing.
