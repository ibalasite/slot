# ANIM.md — Animation Effects Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | ANIM-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (gendoc D10c-ANIM) |
| **Date** | 2026-04-26 |
| **Upstream Documents** | FRONTEND.md v1.0, VDD.md v1.0, AUDIO.md v1.0, EDD.md v1.3, PRD.md v0.1 |
| **Reviewers** | Animation Lead, Frontend Engineer Lead, Art Director, QA Lead |
| **Approver** | Art Director, Engineering Lead |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated | Initial generation covering all 12 sections |

---

## §1 Animation Design Overview

### 1.1 Thematic Direction

Thunder Blessing is anchored in Greek mythology: the domain of Zeus, divine lightning, and the ascending power of the cascade chain. All animation must reinforce three emotional registers that mirror the audio design:

1. **Divine Authority** — Symbols carry weight and gravitas. Premium symbols (P1 Zeus, P2 Pegasus) carry slow, majestic idle cycles that convey a sense of divine residence on the reel. Win animations for premium tiers feel like receiving a blessing, not a mechanical payout.

2. **Electric Tension** — Lightning Marks are the game's core suspense mechanic. Their accumulation must be visually legible and emotionally charged. Each new mark arrival is felt. Persistent marks create ambient visual noise that escalates the player's sense of impending thunder. The color threshold system (gold dim → orange arc → pulsing white-gold, per VDD §5.1 and FRONTEND.md §3.3) must be reflected in animation intensity, not only in color.

3. **Cascading Triumph** — Each cascade step is a reward loop. The symbol explosion, new row reveal, and refill drop must each feel satisfying independently while collectively building momentum. The FREE letter progression is the cascade's visual spine — its lighting must feel earned.

**Color anchors (from VDD §1.1):**
- Primary gold: `--color-gold-primary` `oklch(75% 0.14 80)` — frames, win lines
- Bright gold: `--color-gold-bright` `oklch(85% 0.17 88)` — win numbers, mark highlights
- Divine gold: `--color-gold-divine` `oklch(91% 0.14 88)` — Wild outer glow, max-intensity moments
- Deep blue: `--color-blue-olympus` `oklch(22% 0.06 250)` — main background
- Arc white: `--color-arc-white` `oklch(96% 0.02 230)` — electric arc particles, Scatter outer light

**Symbol tier system (from VDD §3.2):** Wild and Scatter carry full Bloom (radius 16px, 4 iterations), P1/P2 carry medium Bloom (radius 10px), P3/P4 carry light Bloom (radius 6px), L1–L4 have no Bloom. Win animation intensity scales with this hierarchy.

**Animation philosophy:** Every animation must specify a trigger, duration, easing curve, particle count or sprite frame count, and SFX sync point. No animation description is complete without all five elements. Ambiguous terms such as "impressive" or "flashy" are not accepted.

### 1.2 Animation Categories

| Category | Tag Prefix | Description | Priority Tier |
|----------|-----------|-------------|:------------:|
| Reel Animations | `REEL_` | Spin start, spin loop, reel stop per column, near miss twitch | 1 (Critical) |
| Symbol Animations | `SYM_` | Per-symbol idle, win, special, and elimination animations | 1 (Critical) |
| Cascade Animations | `CASC_` | Symbol explosion, drop refill, row expansion | 1 (Critical) |
| Lightning Mark Animations | `MARK_` | Mark appear, persist, pulse, explode | 1 (Critical) |
| Thunder Blessing Sequence | `TB_` | Full TB sequence: activation → hit1 → upgrade → hit2 → settle | 1 (Critical) |
| Coin Toss Animations | `COIN_` | Fly-in, flip loop, result reveal, multiplier progress | 2 (High) |
| Free Game Animations | `FG_` | Entry fanfare, bonus reveal, round HUD, multiplier advance, complete | 2 (High) |
| Win Display Animations | `WIN_` | WIN counter roll-up, tier overlays, max win celebration | 2 (High) |
| UI/HUD Animations | `UI_` | Balance counter, bet panel, spin button, extra bet, buy feature | 3 (Standard) |
| Particle Systems | `PS_` | All particle emitters across all states | 1–2 (per context) |

### 1.3 Technical Constraints

**AnimationQueue architecture (from FRONTEND.md §6.1):**
- The `AnimationQueue` is the single sequencer for all animation. No animation is played ad hoc; every visual event is triggered by `AnimationDispatcher.dispatch(step)`.
- Steps execute strictly in queue order — sequential `await` per step.
- Animations within a single step that are specified as `[PARALLEL]` in this document may begin concurrently within that step. Cross-step parallelism is not permitted unless explicitly tagged.
- The queue is built once from `FullSpinOutcome` after a successful spin response and drained to completion before the next spin is permitted.

**Frame rate targets:**
- Desktop (WebGL 2.0): 60fps sustained. No frame drops exceeding 5ms (per VDD §10.2).
- Mobile (iOS Safari 14+, Chrome Android 90+): 30fps sustained during worst-case Cascade eliminate + parallax. Particle counts halved; Spine idle fps reduced to 12fps (from VDD §3.3).

**Particle budget (from VDD §5.4):**

| Scene | Desktop Limit | Mobile Limit |
|-------|:------------:|:------------:|
| Idle (all marks) | 120 | 60 |
| Cascade eliminate (single step) | 200 | 100 |
| Thunder Blessing explosion | 480 | 240 |
| Big Win / Mega Win | 300 | 150 |
| FG Bonus ×100 (3s burst exception) | 3,000 | 800 |
| MAX WIN 30,000× coin rain (2s burst exception) | 2,000 | 600 |
| MAX WIN 90,000× coin rain (3s burst exception) | 3,000 | 600 |
| **Absolute instantaneous limit (all other states)** | **500** | **200** |

Overflow strategy: old particles fade out early (preemptive recycle). New particle generation is never blocked.

**Shader availability:**
- Bloom/Glow: `KawaseBlurFilter` (PixiJS) or `BloomEffect` (Cocos Creator). Parameters per VDD §5.5.
- Lightning arc: custom Bezier curve renderer, 2px stroke, `Additive` blend, `--color-arc-white`.
- Additive blend mode: all particle systems use Additive unless otherwise noted.
- Screen blend mode: Bloom layer only.

**Memory constraints:**
- Symbol pool: 35 `SymbolComponent` instances maximum (30 active + 5 cascade buffer, per FRONTEND.md §3.2).
- Single 2048×2048px texture atlas for all symbols and UI (per FRONTEND.md §1.4).
- Spine atlas per symbol: max 2048×2048px, `premultipliedAlpha` enabled (per VDD §3.3).
- Particle sprite sheets: PNG-32, pngquant quality 88, max 256KB (per VDD §9.2).

### 1.4 Animation Coordinate System

The reel grid uses a column-row addressing scheme where column indices are 1–5 (left to right) and row indices are 1–3 in the base state, expanding to 1–4, 1–5, or 1–6 during cascade expansion. Row 1 is the top row; row 6 is the bottom row.

**Reference pixel coordinates (1920×1080 baseline, from VDD §6.1):**
- Reel container origin: X=460px, Y=80px.
- Cell pitch (horizontal): 200px (190px renderable + 10px gap).
- Cell pitch (vertical): 200px (190px renderable + 10px gap).
- Cell center formula: `X_center = 460 + (col − 1) × 200 + 100`, `Y_center = 80 + (row − 1) × 200 + 100`.

**Example cell centers (1920×1080):**

| Position | X center | Y center |
|----------|:--------:|:--------:|
| Col 1, Row 1 | 560px | 180px |
| Col 3, Row 2 | 960px | 380px |
| Col 5, Row 3 | 1360px | 580px |
| Col 5, Row 6 (max) | 1360px | 1180px |

**Viewport adaptation (1080p):** At 1920×1080, the 6-row grid extends to Y_center = 80 + (6−1)×200 + 100 = 1180px, exceeding the 1080px viewport height. The reel container applies uniform `scaleY` to compress all rows within the visible area when `rowCount > 3`; scale factor = `(viewport_height − 80) / (rowCount × 200)`. For example, at rowCount=6 on a 1080px canvas: scale = (1080 − 80) / (6 × 200) = 1000/1200 ≈ 0.833. Verify the authoritative canvas dimensions against VDD §6.1 before implementing — VDD §6.1 defines the reel artboard height which may exceed 1080px to accommodate the full 6-row grid without scaling.

**Particle spawn points:** Particles emitted from symbol elimination spawn at the cell center of the eliminated symbol. Particles emitted from Lightning Mark appearances spawn at the cell center of the marked cell. Arc line emitters for Thunder Blessing spawn along a Bezier path from the Scatter symbol cell center to each marked cell center.

---

## §2 Reel & Symbol Animations

### 2.1 Reel Spin Animation

**Trigger:** `SPIN_PRESSED` event; `AnimationDispatcher.dispatch({ type: 'REEL_SPIN' })` begins immediately.

#### Spin Start

| Parameter | Value |
|-----------|-------|
| Trigger | `SFX_SPIN_START` fires at t=0ms (immediate on SPIN press) |
| Duration | 200ms |
| Effect | Reel strip blurs upward: `translateY` acceleration curve from 0 to target loop velocity |
| Easing | `ease-in` (cubic-bezier matching native acceleration) |
| Symbol opacity during blur | Fade to 0.3 over 200ms (`linear`) to convey speed |

#### Spin Loop (Constant Velocity)

| Parameter | Value |
|-----------|-------|
| Duration | Until `FullSpinOutcome` received (variable; loading indicator shown after 500ms per FRONTEND.md §4.2) |
| Effect | Continuous `translateY` scroll of the reel strip at constant velocity |
| Scroll speed | 1200px/s (6 symbols per second at 200px pitch) |
| Symbol rendering | Blurred sprites (motion-blur shader or pre-blurred atlas frame) |

#### Reel Stop (Per Column, Staggered)

Reels stop in column order 1→5 with a 120ms stagger between each column, matching `SFX_REEL_STOP_1` through `SFX_REEL_STOP_5` (AUDIO.md §3.2).

| Column | Stop Delay from col 1 | SFX Sync |
|:------:|:---------------------:|----------|
| 1 | 0ms | `SFX_REEL_STOP_1` at t=0ms |
| 2 | 120ms | `SFX_REEL_STOP_2` at t=120ms |
| 3 | 240ms | `SFX_REEL_STOP_3` at t=240ms |
| 4 | 360ms | `SFX_REEL_STOP_4` at t=360ms |
| 5 | 480ms | `SFX_REEL_STOP_5` at t=480ms |

**Deceleration curve per reel stop:**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Decelerate | 300ms | `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) | Reel slows from loop velocity to 0 |
| Overshoot bounce | 80ms | `ease-out-back` (`cubic-bezier(0.34, 1.56, 0.64, 1)`) | Strip overshoots target by 8px, snaps back |
| Settle | 40ms | `linear` | Holds final position |

**Symbol opacity restoration:** Symbol opacity animates from 0.3 → 1.0 over 150ms (`ease-out-cubic`) starting at deceleration onset, so symbols are readable on stop.

**SFX duration note:** `SFX_REEL_STOP_N` duration is 200ms each. The deceleration animation (300ms) overlaps the SFX tail — the audible "thud" at t=0ms of each SFX coincides with the onset of the deceleration curve for that column.

#### Near Miss Twitch

**Condition:** `outcome.nearMissApplied = true` (from `FullSpinOutcome`).
**Trigger:** Applied to the final reel (column 5) after its stop animation completes.

| Parameter | Value |
|-----------|-------|
| Animation | `translateY`: 0 → +12px → 0 (strip nudges down then snaps back, implying the winning symbol "almost" aligned) |
| Duration | 200ms total: 100ms ease-out, 100ms ease-in back |
| Easing | `ease-out-cubic` (down), `ease-in-cubic` (return) |
| SFX Sync | `SFX_NEAR_MISS` fires at grid-stop moment (t=0ms of NEAR_MISS AQ step, before CASCADE_STEP) |
| Particle | None — purely positional |

### 2.2 Symbol Idle Animations

All idle animations are Spine 2D looping sequences at 24fps on desktop, 12fps on mobile. Idle plays continuously while the symbol is visible and not in a win or special state.

**Wild (Divine Lightning) — `symbol_wild.spine` `idle`:**
- Duration: 4.0s loop (96 frames @ 24fps)
- Effect: Pulsing gold-white outer glow (`--color-gold-divine`, Bloom radius 16px) cycling from 80% → 120% → 80% brightness over 2.0s; lightning arc micro-sparks (2–4 particles per second, Additive, `--color-arc-white`, 0.4s lifetime) drift upward from the lightning bolt prop.
- `scale`: 1.0 → 1.02 → 1.0 breathing cycle (4.0s, `ease-in-out-cubic`).

**Scatter (SC) — `symbol_sc.spine` `idle`:**
- Duration: 3.0s loop (72 frames @ 24fps)
- Effect: Rotating blue-white electric arc ring around the symbol perimeter (3–6 arc particles per second, Additive, `--color-sym-scatter-arc`). Outer glow pulses at 0.8× the Wild intensity (Bloom radius 14px, cycling 0.8s period).
- `scale`: 1.0 constant (no breathing; SC is defined by arcs, not breathing).

**P1 Zeus — `symbol_p1.spine` `idle`:**
- Duration: 4.0s loop.
- Effect: Subtle empire-gold shimmer on armor (brightness 1.0 → 1.15 → 1.0, 2.0s period). Lightning bolt accessory glows with a dim pulse (Bloom radius 6px, 0.5 intensity). No particles.

**P2 Pegasus — `symbol_p2.spine` `idle`:**
- Duration: 3.5s loop.
- Effect: Wing feathers carry a slow rise-and-fall animation (bone rotation ±3°, 2.5s period). Purple-gold ambient shimmer on feathers (brightness 1.0 → 1.08 → 1.0). No particles.

**P3 Athena — `symbol_p3.spine` `idle`:**
- Duration: 4.0s loop.
- Effect: Helmet plume sway (bone rotation ±2°, 3.0s period). Shield carries a very faint silver-blue glint cycle. No particles.

**P4 Eagle — `symbol_p4.spine` `idle`:**
- Duration: 3.0s loop.
- Effect: Subtle wing-tip flicker (bone rotation ±4°, 1.5s period). Amber eye glow pulse (brightness 1.0 → 1.12 → 1.0, 2.0s). No particles.

**L1–L4 (Z, E, U, S letters):**
- Static texture rendering. No Spine animation on idle.
- Low-intensity drop shadow only (`drop-shadow(0 1px 4px rgba(0,0,0,0.5))`).
- Mobile: same (no idle penalty for low symbols).

### 2.3 Symbol Win Animation

Win animations play when a symbol participates in a winning payline during a `CASCADE_STEP`. All winning symbols in a step play their win animation simultaneously (`[PARALLEL]`). Non-winning symbols dim to opacity 0.5 (brightness 0.6, saturate 0.4 — from VDD §7.1) concurrently.

**Win line highlight:**
- All cells in the winning payline light up with a gold path line (2px stroke, `--color-gold-primary`).
- Win flash keyframe cycle (0.8s per cycle, repeating for the duration of the win animation, from VDD §7.1):
  - 0%: opacity 1.0, brightness 1.0
  - 30%: opacity 1.0, brightness 1.8
  - 50%: opacity 0.7, brightness 0.8
  - 70%: opacity 1.0, brightness 1.6
  - 100%: opacity 1.0, brightness 1.0

**Per-symbol win animation durations (from VDD §3.3 and FRONTEND.md §3.2):**

| Symbol | Win Duration | Frame Count @ 60fps | Bloom Intensity | SFX Sync |
|--------|:-----------:|:-------------------:|:---------------:|----------|
| Wild (W) | 1200ms | 72 frames | 1.2 (full) | `SFX_WIN` at t=0ms; tier SFX per step win ratio |
| Scatter (SC) | 1800ms | 108 frames | 1.2 (full) | `SFX_SCATTER_WIN` at t=0ms layered over `SFX_WIN` |
| P1 Zeus | 1500ms | 90 frames | 0.8 (high) | `SFX_WIN` at t=0ms |
| P2 Pegasus | 1300ms | 78 frames | 0.8 (high) | `SFX_WIN` at t=0ms |
| P3 Athena | 1200ms | 72 frames | 0.5 (mid) | `SFX_WIN` at t=0ms |
| P4 Eagle | 1000ms | 60 frames | 0.5 (mid) | `SFX_WIN` at t=0ms |
| L1–L4 | 800ms | 48 frames | 0.2 (low) | `SFX_WIN` at t=0ms |

**Win animation content (Spine `win` state):**
- Wild: lightning bolt slams down from above, arc radiance expands outward from symbol. Scale 1.0 → 1.25 → 1.0 at peak (peak at 600ms, settle by 1200ms).
- Scatter: electric ring pulses outward (max radius 2× symbol size), inner orb brightens to white.
- P1 Zeus: raises hand/bolt; gold aura expands radially (Bloom layer blooms to full).
- P2 Pegasus: wing-spread at maximum extension, gold-purple shimmer radiates outward.
- P3 Athena: shield flash + spear raise; silver-blue light pulse.
- P4 Eagle: wings spread; amber glow burst from eyes.
- L1–L4: letter brightens to `--color-gold-bright` from its base color, slight scale 1.0 → 1.1 → 1.0.

**SFX to win tier mapping (fired at WIN counter start, t=0ms):**
- Step win < 5× baseBet: `SFX_WIN_SMALL` (600ms)
- 5× baseBet ≤ step win < 20× baseBet: `SFX_WIN_MEDIUM` (900ms)
- Step win ≥ 20× baseBet: no tier SFX here — cumulative `totalWin` evaluation is reserved for the `WIN_DISPLAY` step (AUDIO.md §5.8, which defines the WIN_DISPLAY tier SFX). AUDIO.md §5.2 documents the ≥20× deferral rule itself; §5.8 is the destination where the deferred evaluation fires.

### 2.4 Reel Expansion Animation

Triggered when `step.rows > previousRows` within a `CASCADE_STEP`. Expansion adds one row at a time (3→4, 4→5, 5→6). Maximum expansion: 6 rows total.

**Expansion sequence (total ~850ms, from VDD §4.4):**

| Phase | Duration | Easing | Effect | SFX Sync |
|-------|:--------:|--------|--------|----------|
| Frame height extension | 300ms | `--ease-out-cubic` | Reel container `scaleY` expands to accommodate new row (+200px); existing rows compress momentarily then relax | `SFX_REEL_EXPAND` at t=0ms |
| Cloud dissipation | 250ms (delay 50ms) | `linear` | Cloud/mist layer over the new row area fades out (`opacity` 1.0 → 0.0) | — |
| New row fade-in | 300ms (delay 200ms) | `linear` | New row symbols appear at opacity 0 → 1.0 | — |
| FREE letter illuminate | 200ms (delay 100ms) | `--ease-out-cubic` | Corresponding FREE letter brightens (see §9.4) | `SFX_FREE_LETTER` concurrent with expansion |

**Total visual impact window:** 0ms–850ms from expansion trigger.

**Row index assignment:** The new row is always added below the current bottom row. Row indices renumber from top; the existing top 3 rows remain rows 1–3, and the new row becomes row 4 (or 5, or 6).

**Cell reveal stagger:** New row cells appear column by column with a 40ms stagger (col 1 → col 2 → col 3 → col 4 → col 5) for a sweeping reveal effect.

---

## §3 Cascade Chain Animations

### 3.1 Symbol Explosion (Cascade Eliminate)

**Trigger:** After all symbol win animations complete within a `CASCADE_STEP`. Elimination begins for all winning symbols simultaneously (`[PARALLEL]`).

**Standard elimination (L1–L4, P3–P4):**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Symbol shrink | 200ms | `ease-in` | `scale`: 1.0 → 0.0 |
| Fragment scatter | 400ms | `ease-out` | 12–14 particles per symbol; `translateX/Y`: 0 → ±80px (randomized vector); `--color-sym-lN` or `--color-sym-pN` tint; Additive blend |
| Fragment fade | 300ms (delay 100ms from scatter start) | `linear` | `opacity`: 1.0 → 0.0 |
| Cell clear | 80ms | `linear` | Cell `opacity`: 1.0 → 0.0 |

**Premium elimination (Wild, Scatter, P1–P2):**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Symbol shrink | 200ms | `ease-in` | `scale`: 1.0 → 0.0 |
| Electric arc burst | 400ms | `ease-out` | 14–16 particles per symbol; arc-shaped trajectory outward; `--color-gold-bright` + `--color-arc-white` mix; Additive blend |
| Bright flash at cell center | 150ms | `ease-out-expo` | White circular bloom (radius 0px → 30px), `opacity` 0 → 0.8 → 0 |
| Fragment fade | 300ms (delay 100ms) | `linear` | `opacity`: 1.0 → 0.0 |

**SFX sync:** `SFX_CASCADE_EXPLODE` fires at t=0ms of elimination (one call per symbol, pitch ±1 semitone randomized per AUDIO.md §3.2). `SFX_CASCADE` (base layer) fires once per step concurrent with first elimination symbol.

**Cascade tint progression (WIN counter area background, from VDD §7.2):**

| Cascade Count | WIN Area Tint | Float Counter Color |
|:------------:|:------------:|:-------------------:|
| 1 | `rgba(255,215,0,0.05)` | `--color-gold-bright` |
| 2 | `rgba(255,215,0,0.12)` | `--color-gold-bright` |
| 3 | `rgba(255,165,0,0.18)` | `--color-orange-thunder` |
| 4 | `rgba(255,100,0,0.25)` | `oklch(70% 0.22 40)` orange-red |
| 5+ | `rgba(255,50,0,0.30)` | `oklch(62% 0.25 25)` red-orange |

Tint applied via `mix-blend-mode: overlay` on WIN counter container background.

### 3.2 Symbol Drop (Cascade Refill)

**Trigger:** After elimination animations complete. New symbols drop from above the reel top to fill empty cells. The drop animation is `[PARALLEL]` across all filling cells, but staggered by position.

**Drop animation parameters (from VDD §4.2 and FRONTEND.md §6.2):**

| Phase | Property | Start | End | Duration | Easing |
|-------|----------|-------|-----|:--------:|--------|
| Drop | `translateY` | -200px (above reel top) | 0px (target cell) | 420ms | `ease-out-bounce` (JS custom — not a single cubic-bezier; see VDD §4.1 note) |
| Opacity on entry | `opacity` | 0 | 1.0 | 100ms | `linear` |
| Landing bounce | `scale` | 1.0 | 1.05 → 1.0 | 150ms | `--ease-out-back` |

**Stagger formula:** Each symbol's drop `delay = (col − 1) × 20ms + (row − 1) × 30ms`. Maximum delay: (4 × 20ms) + (5 × 30ms) = 230ms. This means the last symbol in column 5, row 6 starts dropping 230ms after the first symbol.

**SFX sync:** `SFX_CASCADE_DROP` fires per symbol at the moment of landing bounce onset (420ms after that symbol's drop starts). The stagger on `SFX_CASCADE_DROP` calls mirrors the visual stagger formula. Total calls per step: up to 30 (5 cols × 6 rows max).

### 3.3 Lightning Mark Placement

**Trigger:** Concurrent with the symbol elimination animation within the same `CASCADE_STEP`. `LightningMarkComponent.addMarks(step.newLightningMarks)` is called as each cell is eliminated.

**Mark appearance animation (from FRONTEND.md §6.3 and VDD §5.1):**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Scale-in | 400ms | `--ease-out-back` | Mark `scale`: 0 → 1.2 → 1.0 |
| Initial arc particles | 400ms concurrent | `ease-out` | 6–12 gold arc particles drift upward from mark center; `--color-gold-bright` (50%) + `--color-arc-white` (50%); 0.4–0.8s lifetime; Additive blend |
| Overlay settle | 400ms | `ease-out-cubic` | Mark overlay opacity ramps to 0.6 (Additive blend on symbol layer below) |

**SFX sync:** `SFX_LIGHTNING_MARK` fires at scale-in midpoint (~200ms into appearance). Pitch shifts +2 semitones per cumulative mark count (1 mark = base pitch, 5+ marks = +8 semitones) via AudioContext `detune` property (AUDIO.md §3.2).

**Mark idle (persistent) animation:**

Once placed, marks emit a continuous low-intensity electric arc particle loop (`SFX_LIGHTNING_PERSIST` [LOOP]):

| Mark Count | Particle Count | Gain Level | Brightness |
|:----------:|:--------------:|:----------:|:----------:|
| 1–2 marks | 3–6 per cell | −18 dBFS | dim gold constant |
| 3–4 marks | 6–9 per cell | −12 dBFS | orange-gold arc flicker |
| 5+ marks | 9–12 per cell | −6 dBFS | pulsing white-gold, expanded background glow |

**Visual threshold changes (matching FRONTEND.md §3.3):**
- 1–2 marks: `--color-gold-bright` at 60% opacity, constant. No animation beyond particle drift.
- 3–4 marks: Electric arc flicker added; mark overlay pulses at 0.8s period (opacity 0.6 → 0.9 → 0.6).
- 5+ marks: Pulsing white-gold (`--color-gold-divine`), 0.4s pulse period; expanded background radial glow (radius 60px, Additive) behind each mark.

### 3.4 FREE Letter Activation

**Trigger:** Each time `step.rows` increases, the corresponding FREE letter is illuminated. Letters F, R, E, E correspond to the 1st, 2nd, 3rd, and 4th row expansion events respectively (from FRONTEND.md §3.9).

**Letter illuminate animation (from VDD §4.4):**

| Phase | Property | Start | End | Duration | Easing |
|-------|----------|-------|-----|:--------:|--------|
| Brightness ramp | `filter: brightness` | 0.3 | 1.0 | 200ms | `--ease-out-cubic` |
| Scale pulse | `scale` | 0.8 | 1.15 → 1.0 | 300ms | `--ease-out-back` |
| Glow particle burst | 4–6 particles per letter | spawn at letter center | radiate outward 40px | 400ms | `ease-out` |

**SFX sync:** `SFX_FREE_LETTER` fires at the brightness-ramp peak (~150ms into the 200ms ramp). Pitch rises per letter: F = base, R = +2 semitones, E3 = +4 semitones, E4 = +7 semitones (AUDIO.md §3.2).

**All 4 letters lit — BGM crossfade trigger:**
- When the 4th letter (E4) illuminates, `BGM_ANTICIPATION` crossfades in over 300ms (state-observer owned — AUDIO.md §4.2).
- HUD pulsing intensifies: all 4 lit letters cycle at 0.6s pulse period (brightness 1.0 → 1.4 → 1.0) until cascade ends or Coin Toss triggers.

---

## §4 Thunder Blessing Sequence

### 4.1 Overview and Timing Diagram

The Thunder Blessing sequence is driven by `ThunderBlessingComponent.playSequence()`, inserted into the `AnimationQueue` immediately after the `CASCADE_STEP` where `thunderBlessingTriggeredAfterStep = true`. All timings are absolute from t=0 (the moment `dispatcher.dispatch({ type: 'THUNDER_BLESSING' })` is called).

```
t=0ms       TB sequence begins
              - Reel grid overlay dims to 85% brightness (300ms, ease-in)
              - Background cloud layer (parallax layer 1) accelerates to 40px/s

t=200ms     Lightning Marks begin pulsing simultaneously
              - SFX_LIGHTNING_ACTIVATE fires
              - Arc lines from Scatter cell → each mark (Bezier, 2px, --color-arc-white, Additive)

t=800ms     ALL marks explode simultaneously
              - SFX_THUNDER_BLESSING fires
              - SFX_TB_FIRST_HIT fires (layered)
              - Background white flash: rgba(255,255,255,0) → rgba(255,255,255,0.9) → rgba(255,255,255,0)
                Duration: 0–300ms within this window
              - fx_thunder_blessing_hit1.spine plays at reel center

t=1200ms    Marked cells: current symbols shatter (elimination variant)
              - Electric arc explosion (scale 0.5 → 2.5, 600ms, ease-out-expo) per VDD §4.3

t=1500ms    Target symbol assembles at each formerly-marked cell
              - SFX_TB_SYMBOL_UPGRADE fires
              - SymbolComponent.upgradeToSymbol(convertedSymbol)
              - Whole reel: filter sepia(0.3) brightness(1.4) (300ms, ease-out-cubic)

t=1800ms    Gold glow fades out
              - filter returns to none (400ms, ease-in-out-cubic)

---if thunderBlessingSecondHit === true---

t=2300ms    Second pulse
              - SFX_SECOND_HIT fires
              - White flash: rgba(255,255,255,0) → rgba(255,255,255,0.6) → rgba(255,255,255,0) (300ms)
              - fx_thunder_blessing_hit2.spine plays at reel center
              - Each converted symbol upgrades one tier (upgrade path animation)

t=3000ms    Sequence complete; grid returns to normal
              - SFX_TB_SETTLE fires
              - Reel brightness restores to 1.0 (200ms, ease-out-cubic)
              - Background cloud layer decelerates back to 8px/s (1000ms, ease-in-out-cubic)
              - All mark overlays cleared
              - AnimationQueue resumes to next CASCADE_STEP or WIN_DISPLAY
```

### 4.2 Lightning Mark Activation Animation (t=200ms)

At t=200ms, `SFX_LIGHTNING_ACTIVATE` fires and the following animations begin simultaneously (`[PARALLEL]`):

**Mark pulse activation:**
- All active marks begin a rapid brightness pulse: `opacity` 0.6 → 1.0 → 0.6, period 150ms, repeating until t=800ms (approximately 4 cycles).
- Mark particle emitters ramp from idle particle count to maximum (12 per cell) over 300ms.
- Particle velocity ramps from 40px/s to 100px/s over the same 300ms.

**Arc line draw (Bezier from SC → each mark):**
- Each arc line draws from SC cell center to the target mark cell center using a Bezier path.
- Arc draw duration: 200ms per line, staggered 20ms apart from nearest to farthest mark.
- Arc line: 2px stroke, `--color-arc-white`, Additive blend, opacity 0.8.
- Arc lines persist (flicker at 0.8 opacity ± 0.2, 80ms period) from t=200ms through t=3000ms. The lines remain rendered through the mark explosion (t=800ms) and symbol upgrade (t=1500ms) phases — they are not cleared at mark explosion. At t=3000ms (settle phase, §4.5) they fade opacity 0.8 → 0.0 over 300ms.

### 4.3 Mark Explosion and Symbol Upgrade (t=800ms → t=1500ms)

**At t=800ms — Mark explosion:**
- All marks explode simultaneously (`[PARALLEL]`).
- Per-mark particle burst: 80–120 particles per cell (desktop), 40–60 (mobile); speed 80–400px/s outward radially; lifetime 0.3–1.0s; `--color-gold-bright` + `--color-arc-white`; Additive blend.
- Total particles: up to 480 desktop (within TB explosion budget, VDD §5.4). Mobile: 240.
- `fx_thunder_blessing_hit1.spine` plays at reel grid center (not per cell) — full-reel-width VFX spine animation.
- Background white flash: `rgba(255,255,255,0)` → `rgba(255,255,255,0.9)` (200ms, `ease-out-expo`), then `rgba(255,255,255,0.9)` → `rgba(255,255,255,0)` (100ms, `linear`). Total: 300ms.

**At t=1200ms — Cell shatter:**
- Marked cell symbols play the Thunder Blessing elimination variant (from VDD §4.3):
  - Electric arc explosion `scale`: 0.5 → 2.5 (600ms, `--ease-out-expo`), overflowing cell boundary by 20%.
  - Symbol itself `scale`: 1.0 → 0.0 (200ms, `ease-in`).

**At t=1500ms — Symbol assembly:**
- `SymbolComponent.upgradeToSymbol(convertedSymbol)` at each converted position.
- Assembly animation: target symbol materializes from gold light coalescing at cell center.
  - Gold light `scale`: 0 → 1.8 → 1.0 (400ms, `--ease-out-back`).
  - Symbol `opacity`: 0 → 1.0 (200ms, `linear`, starting at t=1600ms).
- Whole reel gold filter: `sepia(0.3) brightness(1.4)` applied over 300ms (`ease-out-cubic`) starting t=1500ms.
- `SFX_TB_SYMBOL_UPGRADE` fires at t=1500ms — all positions simultaneously.

### 4.4 Second Hit (Optional, t=2300ms)

Applies only when `thunderBlessingSecondHit = true` (from `ThunderBlessingParams`).

**At t=2300ms:**
- `SFX_SECOND_HIT` fires (1500ms duration, more electric/less thunder than first hit — AUDIO.md §3.2).
- Second white flash: `rgba(255,255,255,0)` → `rgba(255,255,255,0.6)` → `rgba(255,255,255,0)` (300ms total; lower intensity than first hit per VDD §7.4).
- `fx_thunder_blessing_hit2.spine` plays at reel center.
- Each already-converted symbol plays `SymbolComponent.upgradeToSymbol(upgradedSymbol)` for one tier advancement (upgrade path: L1/L2/L3/L4 → P4; P4 → P3; P3 → P2; P2 → P1).
- Upgrade visual: symbol briefly over-brightens (brightness 1.0 → 2.0 → 1.0, 200ms) then resolves to the new symbol identity (same assembly animation as t=1500ms but 250ms compressed).
- Per-position particle: 20–30 particles per cell (smaller than first hit), `--color-gold-divine`, 0.3–0.6s lifetime, upward radial.

### 4.5 Settle Phase (t=3000ms)

**At t=3000ms:**
- `SFX_TB_SETTLE` fires (400ms gold resonance chime, signals cascade resume).
- Reel brightness restores: `filter: none` over 200ms (`ease-out-cubic`). *(Safety clear — in the single-hit path the gold filter already fades to zero by t=2200ms [1500ms ramp start + 300ms ramp + 400ms fade]; this call ensures no residual filter state persists into subsequent cascade steps regardless of path.)*
- All remaining TB particles fade out (old particles preemptive recycle).
- Arc lines from §4.2 fade out completely (opacity 0.8 → 0.0, 300ms, `linear`).
- Mark overlay indicators are cleared: `LightningMarkComponent.clearAllMarks()` called.
- Background cloud layer decelerates back to 8px/s drift over 1000ms (`ease-in-out-cubic`).
- AnimationQueue resumes; next step dispatched.

---

## §5 Coin Toss Animations

### 5.1 Overview

The Coin Toss is triggered when `coinTossTriggered = true` in `FullSpinOutcome`, queued as an `AnimationQueue` step of type `COIN_TOSS`. Total sequence duration: 3000ms–3500ms (randomized in the sustained spin phase). The `CoinTossComponent.playToss(result, stage)` drives all animations.

BGM crossfade to `BGM_COIN_TOSS` (800ms) is state-observer-owned and begins at `COIN_TOSS` state entry; it does not block this animation sequence.

### 5.2 Coin Fly-In (t=0ms)

| Parameter | Value |
|-----------|-------|
| SFX | `SFX_COIN_TOSS_START` at t=0ms (500ms woosh) |
| Duration | 500ms |
| Entry position | Off-screen top (Y: viewport_top − 150px) |
| Target position | Reel center (X: 960px, Y: 500px at 1920×1080) |
| Animation | `translateY`: −(viewport_top + 150)px → 0 (relative to target) |
| Easing | `--ease-out-cubic` |
| Backdrop | `opacity`: 0 → 0.7 (dark overlay over game) over 500ms, `linear` |
| Spotlight | Cone spotlight appears at t=300ms (opacity 0 → 1.0, 300ms, `ease-out-cubic`) centered on coin target position |
| Coin render | Zeus portrait face visible during fly-in (both faces pre-loaded; result not yet revealed) |

### 5.3 Coin Flip Loop (t=500ms)

| Parameter | Value |
|-----------|-------|
| SFX | `SFX_COIN_TOSS_FLIP` [LOOP] starts at t=500ms |
| Acceleration phase | 0°→2520° `rotateY` (7 full Y-axis rotations) over 800ms, `ease-in` |
| Sustained phase | Continue rotateY at constant angular velocity; duration 200ms–700ms (randomized to create suspense — total flip + sustained = 1000ms–1500ms) |
| Loop stops | At t≈2000ms (start of deceleration) |
| Visual | Coin front (Zeus portrait) and back (lightning bolt) alternate as rotateY crosses 90°/270° per rotation. Coin uses two textures; texture swap at half-rotation crossing. |
| Particle | 4–6 gold glint particles per second emitted from coin rim during spin phase; `--color-gold-bright`; Additive blend; 0.2s lifetime; scattered radially. |

### 5.4 Result Reveal (t≈2000ms–3500ms)

| Parameter | Value |
|-----------|-------|
| SFX | `SFX_COIN_TOSS_FLIP` loop stops at t≈2000ms |
| Deceleration | `rotateY` continues from current angle to final face-up angle; duration 1500ms; `--ease-coin-decel` (`cubic-bezier(0.05, 0.7, 0.1, 1.0)`) |
| Final face | HEADS: Zeus portrait face-up. TAILS: Lightning bolt face-up. |
| SFX result | `SFX_COIN_HEADS` (800ms) or `SFX_COIN_TAILS` (600ms) fires when coin fully settles (~t=3500ms) |
| Result text | Text banner appears 100ms after coin settles: "ZEUS SMILES!" (HEADS) or "NOT THIS TIME" (TAILS); `translateY`: −80px → 0, 400ms, `--ease-out-back` |

### 5.5 HEADS Outcome

| Parameter | Value |
|-----------|-------|
| SFX | `SFX_COIN_HEADS` at coin-settle; `SFX_COIN_MULT_PROGRESS` at progress bar animation start |
| Coin effect | `scale`: 1.0 → 1.3 → 1.0 (600ms, `--ease-out-back`); outer glow `opacity`: 0 → 1.0 → 0 (600ms, `ease-out-expo`); `--color-gold-divine` radiance |
| Gold burst | 40–60 gold particles burst radially from coin center; `--color-gold-bright`; speed 60–200px/s; 0.6s lifetime; Additive blend |
| "ZEUS SMILES!" banner | `--color-gold-bright` text, scale 0.8 → 1.1 → 1.0 (400ms, `--ease-out-back`). Background pulse: gold rim on banner |
| Multiplier progress bar | Animates progress line from current stage node to next stage node; duration 500ms, `--ease-in-out-cubic`; line color transitions per VDD §7.3 table |
| Progress bar SFX | `SFX_COIN_MULT_PROGRESS` fires at progress bar animation start (pitch rises per stage: ×3=base, ×7=+3st, ×17=+6st, ×27=+9st, ×77=+12st) |
| Transition | Coin Toss overlay fades out (opacity 1.0 → 0.0, 400ms) after progress bar animation completes; FG_ENTRY AQ step begins |

### 5.6 TAILS Outcome

| Parameter | Value |
|-----------|-------|
| SFX | `SFX_COIN_TAILS` at coin-settle (600ms, duller metal land + minor chord) |
| Coin effect | `filter: brightness`: 1.0 → 0.6 (400ms, `--ease-in-out-cubic`) — coin dims |
| "NOT THIS TIME" text | Silver/grey color (`oklch(70% 0.02 0)`), opacity 0 → 1.0 (300ms, `linear`); no scale animation |
| Result panel | Static; no further animation beyond text appear |
| BGM crossfade | **Main-game only:** State-observer owned: `BGM_COIN_TOSS` → `BGM_MAIN`, 500ms (AUDIO.md §4.2 `COIN_TOSS→RESULT_DISPLAY`). **FG context:** BGM crossfade does NOT occur — BGM continues as `BGM_FREE_GAME` or `BGM_77X` until `RESULT_DISMISSED` (per AUDIO.md §5.6 FG caveat). |
| Transition | **Main-game only:** Overlay fades out (opacity 1.0 → 0.0, 600ms, `ease-in-out-cubic`); `WIN_DISPLAY` AQ step begins (or no-win result). **FG context:** Overlay fades out then `FG_COMPLETE` AQ step begins — NOT `WIN_DISPLAY` (per AUDIO.md §5.6 FG caveat). |

---

## §6 Free Game Animations

### 6.1 FG Entry Animation (AQ Step: `FG_ENTRY`)

**Trigger:** `fgTriggered = true`; `dispatcher.dispatch({ type: 'FG_ENTRY', data: { fgBonusMultiplier, initialMultiplier: 3 } })`.

**SFX sync:** `SFX_FG_ENTER` (2500ms full fanfare) fires at t=0ms of FG_ENTRY step. BGM crossfade `BGM_COIN_TOSS` → `BGM_FREE_GAME` (800ms) is state-observer-owned.

**Scene transition animation (from VDD §4.6):**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Old scene dissolve | 800ms | `linear` | Main game background `opacity`: 1.0 → 0.0 |
| Sky Temple background fade-in | 800ms (delay 400ms) | `linear` | FG night sky background `opacity`: 0.0 → 1.0 |
| Starfield particles | starts at t=400ms | continuous | 20–30 slow-moving star particles; white dots; low opacity (0.4–0.7); Additive; drift at 10px/s |

**FG Banner drop (from VDD §4.6):**

| Phase | Delay | Duration | Easing | Effect |
|-------|:-----:|:--------:|--------|--------|
| FG title banner drop | 1200ms | 600ms | `--ease-out-cubic` | Banner `translateY`: −200px → 0 |
| Multiplier reveal | 1800ms | 800ms | `--ease-out-back` | Multiplier number: `scale` 0 → 2.0 → 1.0 |

**FG Bonus Multiplier reveal (at t=1800ms, concurrent with multiplier `scale` animation):**

| `fgBonusMultiplier` | SFX | Particle Effect |
|:-------------------:|-----|----------------|
| 1 | `SFX_FG_BONUS_REVEAL` at t=1800ms | Standard reveal, 10–20 gold particles |
| 5 | `SFX_FG_BONUS_5X` at t=1800ms | Moderate gold burst: 60–80 particles, radius 120px, `--color-gold-bright` |
| 20 | `SFX_FG_BONUS_20X` at t=1800ms | Large burst: 150–200 particles, radius 200px; banner swells to scale 1.2 before settling |
| 100 | `SFX_FG_BONUS_100X` at t=1800ms | Full-screen explosion: 3000 particles desktop / 800 mobile (VDD §5.4 exception); `fx_fg_bonus_100x.spine` plays; 3.0s burst window; BGM duck −9dB for 4000ms (state-observer owned) |

### 6.2 FG Round HUD

**Active during all `FG_ROUND` AQ steps.**

| Element | Location (1920×1080) | Update Animation |
|---------|:-------------------:|-----------------|
| Current multiplier display | Reel top-center, above FREE letters | Number changes: old number `scale` 1.0 → 0 (200ms, `ease-in`), new number `scale` 0 → 1.1 → 1.0 (300ms, `--ease-out-back`) |
| Round counter ("ROUND N") | Below multiplier | Direct text update; no animation |
| Lightning mark display | Same position as main game (1465px X, 90px Y) | Marks persist and accumulate across FG rounds; same visual thresholds as §3.3 |
| Background scene | Sky Temple (night), starfield continues | Continuous idle |

**Lightning mark persistence in FG:** `fgRounds[i].lightningMarksBefore` positions are restored at the start of each FG round via `LightningMarkComponent.restoreMarks(positions)` (no animation — instant restore; FRONTEND.md §6.3).

**×77 multiplier HUD state:** When `fgMultiplier = 77` is reached, all 5 progress bar nodes enter a continuous flicker (from VDD §7.3):
- `filter: brightness` keyframe cycle: 0% → 1.0; 25% → 2.5; 50% → 1.2; 75% → 2.0; 100% → 1.0
- Duration: 1.5s `ease-in-out`, `infinite` repeat until FG exits.
- BGM crossfade to `BGM_77X` (800ms, state-observer-owned).

### 6.3 Multiplier Advance (HEADS in FG)

**Trigger:** `fgRounds[i].coinTossResult === 'HEADS'` and `multiplier ≠ 77`. SFX: `SFX_FG_MULT_UP` (1200ms) fires immediately.

**Normal multiplier advance:**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Old number explode | 300ms | `ease-out-expo` | Old number `scale`: 1.0 → 2.5; `opacity`: 1.0 → 0 |
| New number scale-in | 500ms (delay 200ms from explode start) | `--ease-out-back` | New number `scale`: 0 → 1.2 → 1.0 |
| Gold particle burst | 300ms | `ease-out` | 30–50 gold particles from multiplier display position; `--color-gold-bright`; radial outward |
| Progress bar fill | 500ms (delay 300ms) | `--ease-in-out-cubic` | Progress line advances to next node; color transitions per VDD §7.3 |

`SFX_COIN_MULT_PROGRESS` fires at progress bar animation start (AUDIO.md §5.6).

**×77 multiplier advance (special case):**

`SFX_FG_MULT_77` fires (3000ms maximum intensity, AUDIO.md §3.2). `SFX_FG_MULT_UP` does NOT fire on this branch.

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Old number explode | 400ms | `ease-out-expo` | Same as normal but 400ms |
| Lightning strike visual | 600ms | — | Full-width lightning bolt descends from screen top to multiplier display area; 2px → 8px stroke width; `--color-gold-divine`; white bloom at impact |
| "×77" number scale-in | 800ms | `--ease-out-back` | `scale`: 0 → 1.8 → 1.0; color: `--color-gold-divine`; text size increases to `--text-mult-max` (72px) |
| Screen gold flash | 300ms | `ease-out-expo` | `rgba(255,200,0,0.4)` overlay flash, fade to 0 |
| All progress nodes illuminate | 500ms | `ease-out-cubic` | All 5 nodes reach maximum brightness simultaneously |
| BGM crossfade begins | 0ms (concurrent) | — | `BGM_FREE_GAME` → `BGM_77X` over 800ms (state-observer-owned) |

### 6.4 FG Complete (AQ Step: `FG_COMPLETE`)

**Trigger:** All FG rounds consumed or TAILS result received. `dispatcher.dispatch({ type: 'FG_COMPLETE', data })`.

**SFX:** `SFX_FG_COMPLETE` (3500ms grand resolution) at t=0ms.

**Summary panel animation:**

| Phase | Duration | Easing | Effect |
|-------|:--------:|--------|--------|
| Summary panel slide-in | 600ms | `--ease-out-cubic` | Panel `translateY`: −300px → 0; appears centered over frozen reel |
| Summary content reveal | 400ms (delay 200ms) | `linear` | Labels and values fade in sequentially (totalFGWin → fgMultiplier → bonusMultiplier) |
| WIN roll-up begins | 0ms (concurrent with summary) | — | `BalanceComponent.animateWin(totalWin)` starts; `SFX_WIN_ROLLUP_TICK` throttled at 80ms |

**Win tier overlay (fires at roll-up completion):**
- Evaluated against `outcome.totalWin / baseBet` (see §7.2 for overlay specs).
- For FG outcomes this is the cumulative win including multiplier — applies the same overlay animation as non-FG.
- **Win tier SFX timing:** The win tier SFX (`SFX_WIN_SMALL` through `SFX_WIN_LEGENDARY`) fires at roll-up **completion** (per AUDIO.md §5.7), not at t=0ms of the FG_COMPLETE step. This differs from WIN_DISPLAY (non-FG path) where the win tier SFX fires at t=0ms concurrent with roll-up start (AUDIO.md §5.8 and §10.1 AQ Step Map).

**Transition after summary:** After overlay resolves (or player dismisses), FG exits: background cross-dissolves back to main scene (800ms, `linear`). BGM crossfade to `BGM_MAIN` fires on `RESULT_DISMISSED` event (state-observer-owned, 800ms — per AUDIO.md §5.7).

---

## §7 Win Display Animations

### 7.1 WIN_DISPLAY Step (Non-FG)

**Trigger:** AQ step type `WIN_DISPLAY`, only when `outcome.totalWin > 0` and `!outcome.fgTriggered`.

**WIN counter roll-up (from VDD §4.7 and FRONTEND.md §6.7):**

| Parameter | Value |
|-----------|-------|
| Algorithm | Exponential decay: each frame delta = `(targetWin − current) × 0.15`; driven by `requestAnimationFrame` |
| Duration formula | `max(min(totalWin / 50, 5000), 200)` ms |
| Minimum duration | 200ms (Small Win) |
| Maximum duration | 5000ms (very large wins) |
| Number format | 2 decimal places; `font-variant-numeric: tabular-nums` (per VDD §2.3) |
| End bounce | `scale`: 1.0 → 1.08 → 1.0 (200ms, `--ease-out-back`) on counter reaching target |
| Color transition | On reaching Big Win threshold (20× baseBet): counter color `--color-gold-bright` → `--color-gold-divine` (gradient, 300ms) |
| SFX | `SFX_WIN_ROLLUP_TICK` fires at most every 80ms during roll-up (throttled, AUDIO.md §3.2) |

**Win tier SFX (at t=0ms of WIN_DISPLAY, concurrent with roll-up start):**

| `totalWin / baseBet` | SFX | BGM Duck |
|:--------------------:|-----|----------|
| < 5 | `SFX_WIN_SMALL` (600ms) | None |
| 5 ≤ ratio < 20 | `SFX_WIN_MEDIUM` (900ms) | None |
| 20 ≤ ratio < 100 | `SFX_WIN_BIG` (2000ms) | −6 dB, 200ms ramp, 2000ms hold, 400ms restore |
| 100 ≤ ratio < 500 | `SFX_WIN_MEGA` (3000ms) | −6 dB, 200ms ramp, 3000ms hold, 400ms restore |
| 500 ≤ ratio < 30,000 | `SFX_WIN_JACKPOT` (4000ms) | −6 dB, 200ms ramp, 4000ms hold, 400ms restore |
| 30,000 (Main Game cap) | `SFX_MAX_WIN` (6000ms) | −12 dB, 300ms ramp, 6000ms hold, 800ms restore |
| 90,000 (Buy Feature cap) | `SFX_MAX_WIN_LEGENDARY` (10000ms) | −12 dB, 300ms ramp, 10000ms hold, 800ms restore |

BGM ducking is state-observer-owned; AQ step documents it for reference only (AUDIO.md §4.2).

### 7.2 Win Tier Overlays

Overlays display on top of the frozen reel state (using the ResultScene overlay panel within GameScene, FRONTEND.md §2.2).

| Tier | Trigger Condition | Overlay Duration | Particle Burst | Animation Spec |
|------|:-----------------:|:----------------:|:--------------:|----------------|
| Small Win | 0 < win < 5× baseBet | No overlay — counter only | None | WIN counter roll-up only |
| Medium Win | 5× ≤ win < 20× | 1500ms overlay display | 20 gold particles, radial, 0.5s lifetime | "WIN" text appears: `scale` 0 → 1.1 → 1.0 (400ms, `--ease-out-back`); `--color-gold-bright` |
| Big Win | 20× ≤ win < 100× | 3000ms | 60–80 particles, `--color-gold-bright`, 0.8s lifetime | "BIG WIN" banner `translateY` −200px → 0 (600ms, `--ease-out-cubic`); `fx_win_bigwin_banner.spine` |
| Mega Win | 100× ≤ win < 500× | 4000ms | 120–150 particles, `--color-gold-divine`, 1.0s lifetime | "MEGA WIN" banner + lightning arc arounds text; Bloom at full intensity |
| Jackpot | 500× ≤ win < 30,000× | 5000ms | 200 particles, `--color-gold-divine`, 1.2s lifetime | "JACKPOT" + Zeus character animation (playSpecial on P1 Zeus symbol overlay); full Bloom on text |
| Max Win (30,000×) | win = 30,000× baseBet | 6000ms | See §7.3 | See §7.3 |
| Max Win Legendary (90,000×) | win = 90,000× baseBet | 10000ms+ | See §7.3 | See §7.3 |

**Tier overlay dismiss:** Player tap/click on overlay dismisses it at any time after 1500ms minimum display. Overlay fades out (`opacity` 1.0 → 0.0, 400ms, `ease-in-out-cubic`).

### 7.3 Max Win Celebration

**30,000× Max Win:**
- SFX: `SFX_MAX_WIN` (6000ms wall-of-sound) at t=0ms.
- Overlay: "MAX WIN" text — font size 200px (`--text-win-2xl`), `--color-gold-divine`, animated scale 0 → 1.3 → 1.0 (800ms, `--ease-out-back`).
- Gold coin rain: 2000 particles desktop / 600 mobile (VDD §5.4 exception, 2s burst); coin-shaped sprites from `particle_coin_gold_sheet.png`; fall from screen top; each coin `rotateZ` randomly; lifetime 2.0–3.0s per coin.
- Full-screen particle burst: 300 electric gold particles radially outward (0.8s, fades to coin rain after).
- Zeus lightning strike visual: Full-height `translateY` stroke from screen top to center; `--color-gold-divine`; 4px → 12px stroke width; white bloom at base; duration 400ms; `ease-out-expo`.
- Background flash: `rgba(255,215,0,0.5)` → 0 over 800ms.
- Duration: 6000ms minimum before dismiss becomes possible.

**90,000× Max Win Legendary:**
- SFX: `SFX_MAX_WIN_LEGENDARY` (10000ms, separately mastered).
- Overlay: "LEGENDARY WIN" text stacked above "×90,000"; dual-color text (gold + divine white).
- All 30,000× effects plus:
  - Extended coin rain: 3000 particles desktop (3s burst before settling to 500 continuous); **mobile: 600 particles maximum** (VDD §5.4 exception; same 3s burst window, settling to 150 continuous) — see §8.1 `PS_WIN_LEGENDARY`.
  - Multiple Zeus lightning strikes: 3 sequential strikes at 0ms, 1500ms, 3000ms.
  - Screen remains at 70% gold ambient brightness for full 10s duration.
- Duration: 10000ms minimum; dismiss possible after 5000ms.

---

## §8 Particle Systems

### 8.1 Particle System Inventory

| System ID | Trigger | Max Particles (desktop/mobile) | Blend Mode | Lifetime (ms) | Notes |
|-----------|---------|:-----------------------------:|:----------:|:-------------:|-------|
| `PS_MARK_IDLE` | Lightning Mark placed and persisting | 12 per cell / 6 per cell | Additive | 400–800 | `--color-gold-bright` + `--color-arc-white`; scales with mark count (§3.3) |
| `PS_MARK_APPEAR` | Mark scale-in animation | 6–12 per mark / 3–6 | Additive | 400 | Gold arc particles, upward drift |
| `PS_MARK_EXPLODE` | t=800ms of TB sequence | 80–120 per cell / 40–60 | Additive | 300–1000 | Electric arc burst, radial, full TB budget |
| `PS_TB_ARC_LINE` | t=200ms of TB (SC → marks) | N/A (Bezier renderer) | Additive | Until t=3000ms | 2px stroke; not particle-based; Bezier path renderer |
| `PS_SYM_ELIMINATE_STD` | Standard symbol elimination | 12–14 per symbol / 6–8 | Additive | 400 | Colored fragments matching symbol tint |
| `PS_SYM_ELIMINATE_PREMIUM` | Premium symbol elimination | 14–16 per symbol / 8–10 | Additive | 400 | Gold + arc-white arc burst |
| `PS_REEL_STOP_BOUNCE` | Reel landing overshoot | None (CSS transform only) | — | — | No particles; pure transform animation |
| `PS_SYMBOL_WIN_GLOW` | Symbol win animation | 6–10 per symbol / 3–6 | Screen | 600–1800 | Bloom layer; color per symbol tier |
| `PS_COIN_TOSS_GLINT` | Coin spin phase | 4–6 / 2–4 | Additive | 200 | Gold rim glints during rotation |
| `PS_COIN_HEADS_BURST` | HEADS result settle | 40–60 / 20–30 | Additive | 600 | `--color-gold-bright` radial burst |
| `PS_FREE_LETTER_GLOW` | FREE letter illuminate | 4–6 per letter / 2–4 | Additive | 400 | Gold glow from letter center |
| `PS_FG_ENTRY_STAR` | FG scene entry (continuous) | 20–30 / 10–15 | Additive | 3000–8000 | Slow starfield drift; white dots; low opacity |
| `PS_FG_BONUS_5X` | fgBonusMultiplier = 5 | 60–80 / 30–40 | Additive | 600 | Gold burst from multiplier reveal position |
| `PS_FG_BONUS_20X` | fgBonusMultiplier = 20 | 150–200 / 75–100 | Additive | 800 | Larger burst + banner particle halo |
| `PS_FG_BONUS_100X` | fgBonusMultiplier = 100 | **3000 / 800** (exception) | Additive | 1000 | Full-screen; 3s burst; VDD §5.4 exception |
| `PS_FG_MULT_ADVANCE` | Multiplier advance (HEADS) | 30–50 / 15–25 | Additive | 600 | Gold burst from multiplier display |
| `PS_FG_MULT_77` | ×77 multiplier | 200–300 / 100–150 | Additive | 1000 | Maximum intensity; `--color-gold-divine` |
| `PS_WIN_BIG` | Big Win overlay | 60–80 / 30–40 | Additive | 800 | `--color-gold-bright` banner burst |
| `PS_WIN_MEGA` | Mega Win overlay | 120–150 / 60–75 | Additive | 1000 | `--color-gold-divine` + arc-white |
| `PS_WIN_JACKPOT` | Jackpot overlay | 200 / 100 | Additive | 1200 | Full Bloom + divine gold |
| `PS_WIN_MAX` | Max Win (30,000×) | **2000 / 600** (exception, coin rain) | Normal (coin sprites) | 2000–3000 | Gold coin sprites; gravity simulation |
| `PS_WIN_MAX_LIGHTNING` | Max Win Zeus strike | 300 / 150 | Additive | 800 | Electric radial burst at strike base |
| `PS_WIN_LEGENDARY` | Max Win Legendary (90,000×) | **3000 / 600** (exception) | Normal | 3000 | Extended coin rain; divine gold |
| `PS_NEAR_MISS` | nearMissApplied = true | None (no particles) | — | — | Near miss is positional only (reel twitch) |
| `PS_CASCADE_TINT` | Cascade counter increment | None (CSS filter only) | — | — | WIN area background tint; no particles |

### 8.2 Performance Budget

**Standard operation (non-exception states):**
- Desktop instantaneous particle cap: 500 particles.
- Mobile instantaneous particle cap: 200 particles.
- Priority-based throttle order (when approaching cap):
  1. Reduce `PS_MARK_IDLE` first (background ambient; least critical).
  2. Reduce `PS_SYM_ELIMINATE_STD` count from 14 to 8.
  3. Reduce `PS_FG_ENTRY_STAR` from 30 to 15.
  4. Never reduce `PS_MARK_EXPLODE`, `PS_TB_ARC_LINE`, or `PS_WIN_MAX*` (critical feedback moments).

**Exception states (allowed above cap for short bursts):**
- `PS_FG_BONUS_100X`: up to 3000 desktop / 800 mobile for 3s.
- `PS_WIN_MAX`: up to 2000 desktop / 600 mobile for 2s.
- `PS_WIN_LEGENDARY`: up to 3000 desktop / 600 mobile for 3s.
- These exceptions must not occur simultaneously. Design guarantees they cannot (coin rain only appears in non-FG win display; FG bonus only appears at FG entry).

**Mobile particle reduction rules:**
- All `PS_*` particle counts halved on mobile.
- `PS_TB_ARC_LINE`: Bezier arc lines are replaced with a simple white flash at each mark location (200ms flash, `opacity` 0 → 0.8 → 0) to avoid Bezier renderer overhead on low-end devices.
- `PS_MARK_IDLE`: maximum 6 particles per cell (vs 12 on desktop).
- Spine idle fps: 12fps (vs 24fps). Spine win/special: 60fps maintained (priority feedback).

---

## §9 UI/HUD Animations

### 9.1 Balance Counter Update

**Trigger:** `BalanceComponent.setBalance(amount)` called after `FullSpinOutcome` is received.

| Parameter | Value |
|-----------|-------|
| Trigger | Post-spin balance update (after WIN_DISPLAY or FG_COMPLETE step completes) |
| Duration | 400ms |
| Algorithm | Smooth number roll from previous balance to new balance; exponential decay per VDD §4.7 formula |
| Easing | `--ease-out-expo` |
| End effect | No bounce (balance update is informational, not celebratory) |
| Color | `--color-marble-white` at all times; brief `--color-success` (`oklch(60% 0.16 145)`) tint on increase (150ms, fade back to white) |
| SFX | None — balance update is silent |

### 9.2 Bet/Line Selector

**Spin button states:**

| State | Visual | Duration |
|-------|--------|:--------:|
| Idle | Full brightness; subtle pulse (`scale` 1.0 → 1.03 → 1.0, 2.5s loop) | Continuous |
| Hover | `brightness` 1.0 → 1.2 (150ms, `--ease-out-cubic`); cursor: pointer | 150ms |
| Active / Pressed | `scale` 1.0 → 0.93 (80ms, `ease-in`); `brightness` 1.2 → 0.9 | 80ms down |
| Pressed release | `scale` 0.93 → 1.0 (150ms, `--ease-out-back`) | 150ms |
| Disabled | `opacity`: 1.0 → 0.5 (300ms, `ease-in-out-cubic`); `cursor: not-allowed`; all animations paused | — |

**SFX:** `SFX_UI_BUTTON_PRESS` (80ms) fires on SPIN press, BET+/− press, INFO press, SETTINGS press. `SFX_UI_BET_UP` fires on BET+ press; `SFX_UI_BET_DOWN` fires on BET− press.

**BET+/− buttons:**
- Press: `scale` 1.0 → 0.9 (80ms, `ease-in`), release `scale` 0.9 → 1.0 (120ms, `--ease-out-back`).

### 9.3 Extra Bet Toggle

**Toggle ON:**
- Indicator: Border color transitions from `--color-disabled` → `--color-orange-thunder` (150ms, `--ease-out-cubic`).
- Background fill: `rgba(255,140,0,0.15)` fills over 200ms from left.
- SFX: `SFX_EXTRA_BET_ON` (300ms, electric activation snap).

**Toggle OFF:**
- Reverse: fill drains right to left over 200ms; border returns to disabled color.
- SFX: `SFX_EXTRA_BET_OFF` (250ms, power-down click).

**Lock during spin:** `pointer-events: none`; `opacity` dims to 0.6 (300ms). Restores on `IDLE` state entry.

### 9.4 Buy Feature Button

**Attention pulse (IDLE state, button enabled):**
- Continuous subtle pulse: `box-shadow` glow size 0px → 8px → 0px, `--color-purple-zeus`, 2.0s loop, `ease-in-out-cubic`.
- On hover: glow intensifies to 16px; color shifts to `--color-gold-primary`.

**Buy Feature dialog open:**
- Dialog: `translateY` −100px → 0, `opacity` 0 → 1.0, 300ms, `--ease-out-cubic`.
- SFX: `SFX_BUY_FG_OPEN` (200ms light shimmer) at dialog open.

**Buy Feature confirm:**
- Confirmation: button `scale` 1.0 → 1.1 → 1.0 (200ms, `--ease-out-back`).
- Dialog closes: `opacity` 1.0 → 0, 200ms, `ease-in`.
- SFX: `SFX_BUY_FG_CONFIRM` (600ms rich coin placement).

**Buy Feature cancel/dismiss (player closes dialog without confirming):**
- Dialog closes: `opacity` 1.0 → 0, 200ms, `ease-in` (same as confirm-close duration).
- SFX: `SFX_UI_DIALOG_CLOSE` (150ms) fires at dismiss start.
- No button scale animation (cancel is neutral, not a positive action).

### 9.5 Error / Network States

**Error overlay (NETWORK_ERROR state):**
- Overlay: `opacity` 0 → 0.85 (400ms, `ease-in`) over full game content.
- Error panel: `translateY` −60px → 0 (400ms, `--ease-out-cubic`); `opacity` 0 → 1.0 concurrent.
- SFX: `SFX_ERROR` (400ms) at overlay appear.
- Rate limit countdown timer: numeric countdown in `--color-warning` (#FFA500), updates every 1000ms.

**Loading spinner (SPINNING state, API call > 500ms):**
- Spinner: `rotate` 0 → 360°, continuous, 1.0s per rotation, `linear`.
- Spin button: transitions to spinner icon over 150ms.
- No SFX.

**Offline banner:**
- Slides down from top: `translateY` −48px → 0 (300ms, `--ease-out-cubic`).
- `--color-warning` background; white text.
- Slides back up on `hideOfflineBanner()` (300ms, `ease-in`).

---

## §10 AnimationQueue Integration

### 10.1 AQ Step Map

| AQ Step Type | ANIM.md Section | Typical Duration | SFX Sync (key events) |
|:------------:|:---------------:|:----------------:|----------------------|
| `NEAR_MISS` | §2.1 (Near Miss Twitch) | 200ms | `SFX_NEAR_MISS` at t=0ms |
| `REEL_SPIN` (implicit; pre-AQ) | §2.1 | Variable (until API response) | `SFX_SPIN_START` immediate; `SFX_REEL_STOP_1–5` staggered 120ms |
| `CASCADE_STEP` | §2.3, §3.1, §3.2, §3.3, §3.4 | 1500ms–2500ms | `SFX_WIN` / `SFX_SCATTER_WIN` at t=0ms; `SFX_CASCADE_EXPLODE` at ~800ms (no SC in step) or ~1800ms (SC present in win line — waits for 1800ms SC win animation per AUDIO.md §5.2); `SFX_LIGHTNING_MARK` concurrent with elimination; `SFX_REEL_EXPAND` at ~1000ms; `SFX_FREE_LETTER` concurrent; `SFX_CASCADE_DROP` staggered at drop-land |
| `THUNDER_BLESSING` | §4 | 3000ms (or 3000ms+) | `SFX_LIGHTNING_ACTIVATE` at t=200ms; `SFX_THUNDER_BLESSING` + `SFX_TB_FIRST_HIT` at t=800ms; `SFX_TB_SYMBOL_UPGRADE` at t=1500ms; `SFX_SECOND_HIT` at t=2300ms (if applicable); `SFX_TB_SETTLE` at t=3000ms |
| `COIN_TOSS` | §5 | 3000ms–3500ms | `SFX_COIN_TOSS_START` at t=0ms; `SFX_COIN_TOSS_FLIP` [loop] at t=500ms; `SFX_COIN_HEADS` or `SFX_COIN_TAILS` at ~t=3500ms; `SFX_COIN_MULT_PROGRESS` on HEADS. TAILS in main-game → `WIN_DISPLAY`; TAILS in FG context → `FG_COMPLETE` (per AUDIO.md §5.6 FG caveat); `BGM_COIN_TOSS`→`BGM_MAIN` crossfade does NOT fire in FG context. |
| `FG_ENTRY` | §6.1 | ~2600ms | `SFX_FG_ENTER` at t=0ms; `SFX_FG_BONUS_REVEAL` / `SFX_FG_BONUS_5X` / `SFX_FG_BONUS_20X` / `SFX_FG_BONUS_100X` at t=1800ms |
| `FG_ROUND` | §6.2, §6.3 | Variable (cascade + coin toss per round) | `SFX_FG_ROUND_START` at t=0ms; cascade SFX per AUDIO.md §5.2; coin toss SFX per AUDIO.md §5.4; visual cascade animation per ANIM.md §6.2; visual coin toss flip/reveal animation per ANIM.md §5 (same sequence as main-game coin toss); visual HEADS multiplier advance per ANIM.md §6.3; `SFX_FG_MULT_UP` + `SFX_COIN_MULT_PROGRESS` or `SFX_FG_MULT_77` on HEADS |
| `FG_COMPLETE` | §6.4 | 3500ms+ | `SFX_FG_COMPLETE` at t=0ms; `SFX_WIN_ROLLUP_TICK` during roll-up; win tier SFX at roll-up end |
| `WIN_DISPLAY` | §7.1, §7.2, §7.3 | 200ms–10,000ms | Win tier SFX at t=0ms; `SFX_WIN_ROLLUP_TICK` throttled during roll-up |

**Reel spin** is not a formal AQ step type — it begins on `SPIN_PRESSED` and ends when the first `CASCADE_STEP` is dequeued. The AQ is built and begins draining immediately on `SPIN_RESPONSE_OK`.

### 10.2 Parallel Animation Rules

Within any single AQ step, the following sub-animations are tagged `[PARALLEL]` and may begin concurrently:

| AQ Step | Parallel Sub-Animations |
|:-------:|------------------------|
| `CASCADE_STEP` | Symbol win animations for all winning positions; win line highlight; WIN counter start |
| `CASCADE_STEP` | Symbol elimination and Lightning Mark placement (after win animations complete) |
| `CASCADE_STEP` | Reel expansion and FREE letter illuminate (if row count increased) |
| `CASCADE_STEP` | Symbol drop for all refill positions (staggered by position formula, but all drops started together) |
| `THUNDER_BLESSING` | Mark pulse activation and arc line drawing (both at t=200ms) |
| `THUNDER_BLESSING` | Mark explosion and background white flash (both at t=800ms) |
| `THUNDER_BLESSING` | All mark positions simultaneously convert to target symbol (t=1500ms) |
| `FG_ENTRY` | Scene cross-dissolve and `SFX_FG_ENTER` fanfare |
| `FG_COMPLETE` | Summary panel reveal and WIN roll-up |
| `WIN_DISPLAY` | WIN counter roll-up and win tier overlay display |

Across AQ steps, strict sequential ordering is enforced. `CASCADE_STEP[N+1]` does not begin until `CASCADE_STEP[N]` fully resolves, including all symbol drops landing.

### 10.3 Interrupt Handling

If the player presses SPIN while an animation step is active, the `AnimationQueue` handles interrupt as follows:

| Active AQ Step | Interrupt Response | Audio |
|:--------------:|-------------------|-------|
| `CASCADE_STEP` (win animation or elimination) | Step is cut short: all animations skip to final state immediately; particles already spawned fade out at 3× normal rate | `SFX_WIN_ROLLUP_TICK` stops; WIN counter jumps to step win value |
| `CASCADE_STEP` (symbol drop) | Drop animations teleport to final positions instantly | `SFX_CASCADE_DROP` calls cancelled |
| `WIN_DISPLAY` (roll-up in progress) | Roll-up jumps immediately to `totalWin` final value; win tier overlay dismissed in 400ms | `SFX_WIN_ROLLUP_TICK` stops; tier SFX cuts at natural end |
| `THUNDER_BLESSING` | **Cannot be interrupted.** SPIN button remains disabled for full 3000ms sequence. No skip allowed — game integrity requires TB to resolve before next spin. | All TB SFX continue |
| `COIN_TOSS` | **Cannot be interrupted.** SPIN button disabled for full coin toss duration. | All coin toss SFX continue |
| `FG_ENTRY` | **Cannot be interrupted.** Must complete before first FG_ROUND. | — |
| `FG_ROUND` | Same rules as CASCADE_STEP within FG — can be cut short; coin toss cannot. | — |
| `FG_COMPLETE` | Roll-up can be skipped (jump to final); overlay requires minimum 1500ms display. | Tier SFX continues to natural end |

**Skip implementation:** `AnimationQueue.clear()` is called on interrupt. All pending steps are dropped. Components call their respective "fast-complete" methods to set final visual state synchronously.

---

## §11 Accessibility

### 11.1 Reduced Motion Mode

Detected via `prefers-reduced-motion: reduce` CSS media query, or the in-game "Low Effects Mode" toggle. When active:

| Original Effect | Reduced Motion Substitute |
|----------------|--------------------------|
| Symbol drop with bounce (420ms + 150ms) | Symbol appears at target position directly; `opacity` 0 → 1.0, 100ms, `linear` |
| Cascade elimination fragments | Symbol `opacity` 1.0 → 0.0, 300ms, `linear`; no particles spawned |
| Coin toss 3D rotation (3000–3500ms) | Static coin face cross-fades to result face; `opacity` 0 → 1.0, 200ms, `linear` |
| FG scene cross-dissolve (800ms) | `opacity` 0 → 1.0, 100ms, `linear` (or immediate cut) |
| WIN counter roll-up (200ms–5000ms) | Final `totalWin` value displayed immediately; no counting animation |
| ×77 node flicker (continuous pulse) | Static maximum brightness; no pulse |
| Background parallax motion | All parallax layers fixed; no mouse/gyro response |
| All particle systems | Disabled entirely; replaced by static glow images where applicable |
| Thunder Blessing arc lines + explosions | Mark positions flash once (200ms brightness spike) then symbols swap immediately |
| Free letter pulse | Letters illuminate at full brightness instantly; no scale animation |
| Win tier overlays (BIG WIN etc.) | Overlay appears at full opacity immediately; no slide or scale animation |

### 11.2 Colorblind Considerations

Win highlights, Lightning Mark indicators, and FREE letter progress must not rely solely on color for their meaning. Shape and motion alternatives are provided for each (from VDD §8.1):

| Indicator | Color Encoding | Shape / Motion Supplement |
|-----------|:--------------:|--------------------------|
| Lightning Mark (1–2) | Gold constant | Static lightning bolt icon at each marked cell; icon weight does not change |
| Lightning Mark (3–4) | Orange-gold | Icon arc flicker animation distinguishes 3–4 from 1–2 marks regardless of hue perception |
| Lightning Mark (5+) | White-gold | Icon pulsing + increased icon size (1.3× base) distinguishes 5+ from lower counts |
| Cascade count tint | Gold→orange→red progression | WIN area label "CASCADE ×N" floats above counter (36px text) showing cascade number in text |
| FREE letters (unlit vs lit) | Dim vs bright | Unlit letters: outline only (1px stroke, no fill). Lit letters: filled + glow. Shape difference persists regardless of brightness perception. |
| Scatter (SC) | Blue-white | White circular border (2px ring) always present; does not rely on blue-only identification |
| FG progress nodes | Green→yellow→orange→red per stage | Node shape changes per stage: ×3=circle, ×7=diamond, ×17=five-pointed star, ×27=hexagram, ×77=lightning bolt (from VDD §8.1) |
| Win line highlight | Gold path | Win line uses both color AND a 2px animated dashed stroke pattern to trace the payline |
| Big Win / Mega Win overlays | Gold vs larger gold | Tier differentiated by text size (Big Win: 120px; Mega Win: 144px; Jackpot: 200px) in addition to color intensity |

**Flash frequency compliance (from VDD §8.2):**
- Win flash: 0.8s cycle = 1.25Hz. Within WCAG 2.3.1 < 3Hz limit.
- Thunder Blessing white flash: single 300ms impact, ≥ 1s gap between consecutive flashes, maximum 3 total per TB sequence.
- FG Bonus ×100 celebration: flash peaks < 3 per second (one peak every ~400ms).

---

## §12 Asset Specifications

### 12.1 Sprite Sheet Requirements

All animated symbols use Spine 2D. Frame rates and counts per VDD §3.3:

| Asset | Spine File | Idle Frames (24fps) | Win Frames (60fps) | Special Frames (60fps) | Atlas Max Size |
|-------|-----------|:-------------------:|:------------------:|:----------------------:|:--------------:|
| Wild (W) | `symbol_wild.spine` | 96 (4.0s) | 72 (1.2s) | 150 (2.5s) | 2048×2048px |
| Scatter (SC) | `symbol_sc.spine` | 72 (3.0s) | 108 (1.8s) | 90 (1.5s) | 2048×2048px |
| P1 Zeus | `symbol_p1.spine` | 96 (4.0s) | 90 (1.5s) | 120 (2.0s) | 2048×2048px |
| P2 Pegasus | `symbol_p2.spine` | 84 (3.5s) | 78 (1.3s) | 108 (1.8s) | 2048×2048px |
| P3 Athena | `symbol_p3.spine` | 96 (4.0s) | 72 (1.2s) | 108 (1.8s) | 2048×2048px |
| P4 Eagle | `symbol_p4.spine` | 72 (3.0s) | 60 (1.0s) | 90 (1.5s) | 2048×2048px |
| L1–L4 | Static texture (no Spine) | — | 48 (0.8s) sprite sheet | 90 (1.5s) sprite sheet | 512×512px each |

**Spine skeleton bone limits (from VDD §9.3):**
- Wild / Scatter: max 32 bones.
- P1–P4: max 24 bones.
- L1–L4: no Spine skeleton; sprite-sheet animation only.
- IK constraints: Wild only (hand holding lightning bolt). All others: avoid IK.

**Effect animations (Spine FX):**

| Asset | Spine File | Duration | Atlas Max Size |
|-------|-----------|:--------:|:--------------:|
| Cascade explode (premium) | `fx_cascade_explode_premium.spine` | 600ms | 1024×1024px |
| Cascade explode (low) | `fx_cascade_explode_low.spine` | 400ms | 512×512px |
| Lightning mark appear | `fx_lightning_mark_appear.spine` | 400ms | 512×512px |
| Thunder Blessing hit 1 | `fx_thunder_blessing_hit1.spine` | 1200ms | 2048×2048px |
| Thunder Blessing hit 2 | `fx_thunder_blessing_hit2.spine` | 700ms | 1024×1024px |
| Coin toss flip | `fx_coin_toss_flip.spine` | 3500ms | 1024×1024px |
| Big Win banner | `fx_win_bigwin_banner.spine` | 3000ms | 1024×1024px |
| Mega Win banner | `fx_win_megawin_banner.spine` | 4000ms | 1024×1024px |
| FG Bonus 100× | `fx_fg_bonus_100x.spine` | 3000ms | 2048×2048px |

### 12.2 Particle Texture Requirements

All particle sprites are sourced from shared sprite sheets (PNG-32, pngquant quality 88, max 256KB per VDD §9.2).

| Texture ID | File | Dimensions | Frame Layout | Use |
|-----------|------|:----------:|:------------:|-----|
| `particle_lightning_arc_sheet` | `particle_lightning_arc_sheet.png` | 1024×1024px | 8×8 grid of 128×128px frames | Lightning arc particles, TB explosion, mark persist |
| `particle_coin_gold_sheet` | `particle_coin_gold_sheet.png` | 512×512px | 4×4 grid of 128×128px frames (front/back faces, tilts) | Coin toss glints, Max Win coin rain |
| `particle_explosion_sheet` | `particle_explosion_sheet.png` | 1024×1024px | 8×8 grid of 128×128px frames | Symbol elimination bursts, FG bonus explosions |
| `particle_star_white` | (single 16×16px PNG; embedded in main atlas) | 16×16px | Single frame | FG starfield |
| `particle_glow_gold` | (single 32×32px PNG; embedded in main atlas) | 32×32px | Single frame (radial gradient) | WIN counter burst, FREE letter glow |

**Atlas format:** PNG-32 with `premultipliedAlpha` enabled (matches Spine runtime requirement). Particle sheets are separate from symbol atlases to allow independent streaming.

### 12.3 Shader Requirements

| Shader | Engine Equivalent | Input Parameters | Used In |
|--------|:-----------------:|-----------------|---------|
| Bloom / Glow | `KawaseBlurFilter` (PixiJS) / `BloomEffect` (Cocos) | `radius`: 0–16px; `quality`: 0–4 iterations; `strength`: 0.0–1.5; `blendMode`: Screen | Symbol win glow, Wild/SC idle, WIN counter, win tier text |
| Additive blend | Built-in Additive blend mode | — | All particle systems, Lightning arc overlays |
| Brightness / Sepia | `filter: brightness() sepia()` (CSS/WebGL uniform) | `brightness`: 0.0–3.0; `sepia`: 0.0–1.0 | TB reel gold filter (t=1500ms); background white flash (brightness); dim non-winning symbols |
| Bezier arc renderer | Custom WebGL line renderer | `start: {x,y}`, `end: {x,y}`, `control: {x,y}` (auto-calculated midpoint), `width`: 2px, `color: --color-arc-white`, `opacity`: 0.0–1.0 | TB arc lines (SC → marks), COIN_TOSS overlay border (optional) |
| Parallax compositor | Multi-layer transform | `ratio`: 0.0–1.0 per layer; `offsetX`, `offsetY`; triggered by `mousemove` or Gyroscope API | Background parallax layers 1–4 (VDD §5.3) |

**Shader performance note:** Wild and Scatter symbols apply full Bloom (radius 16px, 4 iterations) continuously during idle. On mobile, reduce to radius 8px, 2 iterations to maintain 30fps budget. P3/P4 Bloom (radius 6px, 2 iterations) is disabled entirely on mobile (L-category equivalent treatment: no Bloom).

---

*End of ANIM.md — Animation Effects Design Document v1.0*
