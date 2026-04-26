# AUDIO.md — Audio Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | AUDIO-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (gendoc D10b-AUDIO) |
| **Date** | 2026-04-26 |
| **Upstream Documents** | FRONTEND.md v1.0, EDD.md v1.3, PRD.md v0.1, VDD.md v1.0 |
| **Reviewers** | Audio Lead, Frontend Engineer Lead, QA Lead |
| **Approver** | Art Director, Engineering Lead |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated | Initial generation covering all 7 sections |

---

## §1 Audio Design Overview

### 1.1 Thematic Direction

Thunder Blessing is set in the world of Greek mythology — the domain of Zeus, divine lightning, and eternal triumph. The audio design reinforces three emotional registers:

1. **Divine Power** — Zeus presides over the game world. BGM carries orchestral gravitas with choir elements, evoking the grandeur of Mount Olympus. Thunder and lightning SFX use naturalistic yet stylized crack-and-rumble layers rather than synthetic presets.

2. **Electric Tension** — Lightning Marks and Cascade chains drive sustained excitement. SFX for mark accumulation escalate in pitch and harmonic density as the count rises, reinforcing the visual counter's color threshold transitions (1–2 marks → 3–4 marks → 5+ marks, per VDD §5.1 / FRONTEND.md §3.3).

3. **Epic Triumph** — Free Game and Thunder Blessing climaxes demand full orchestral and electronic fusion. The ×77 multiplier and Max Win states push into wall-of-sound territory — layered choir, distorted electric strings, and coin/thunder sound signatures.

### 1.2 Audio Categories

| Category | Prefix | Description |
|----------|--------|-------------|
| Background Music | `BGM_` | Looping adaptive tracks; state-based transitions |
| Sound Effects | `SFX_` | Non-looping event-driven sounds; all game interactions |
| UI Sounds | `SFX_UI_` | Sub-category for low-intensity interface feedback |
| Voice / Announcer | `VO_` | Optional announcer callouts for major events (Big Win, FG entry). Deferred to v1.1 unless budget allows. |

> **Voice/Announcer status**: VO lines are architecturally supported via the `SFX` category path but are out of scope for v1.0 MVP. Placeholder IDs (`VO_BIG_WIN`, `VO_FG_ENTER`, etc.) are reserved in the naming convention.

### 1.3 Technical Constraints

All audio runs through the **Web Audio API** as implemented in `AudioManager` (FRONTEND.md §7.1):

- `AudioContext` is created on first user gesture (mobile unlock requirement — §7.4).
- Per-category `GainNode` routing: `BGM → gainNodes.BGM → destination`; `SFX → gainNodes.SFX → destination`.
- BGM crossfade uses `linearRampToValueAtTime` over a configurable duration window.
- All audio files must be **preloaded** via `AudioManager.preload(soundId, url)` before playback. Files are loaded as `ArrayBuffer` → `decodeAudioData` → `AudioBuffer`.
- Playback is non-blocking: `AudioManager.play()` is synchronous; crossfades are async via `crossfadeBGM()`.
- Mobile constraint: on iOS Safari 14+ and Chrome for Android 90+, `AudioContext` creation is gated behind a user gesture (see §6.2 for the unlock pattern).

### 1.4 Adaptive Audio Strategy

The audio layer mirrors the game state machine defined in FRONTEND.md §4.2. Each major state transition triggers a BGM transition (crossfade or hard-cut) and activates or deactivates specific SFX layers:

| Game State | BGM Track | SFX Layer Active |
|------------|-----------|-----------------|
| `IDLE` | `BGM_MAIN` | UI sounds only |
| `SPINNING` | `BGM_MAIN` (continues) | Spin start, reel stop SFX |
| `CASCADE_RESOLVING` | `BGM_MAIN` (continues) | Cascade, lightning mark, expansion SFX |
| `THUNDER_BLESSING` | `BGM_MAIN` (ducked -6dB) | Thunder Blessing SFX foreground |
| `COIN_TOSS` | `BGM_COIN_TOSS` | Coin toss SFX |
| `FREE_GAME` | `BGM_FREE_GAME` (or `BGM_77X` at ×77) | All SFX layers |
| `RESULT_DISPLAY` | `BGM_MAIN` | Win tier SFX |
| `NETWORK_ERROR` | `BGM_MAIN` (continues at -3dB) | Error UI sound only |

**Ducking rule:** During `THUNDER_BLESSING` and Big Win / Mega Win / Max Win events, BGM gain is reduced by −6 dB (linear gain factor 0.5) for the duration of the foreground SFX event. BGM gain is restored after the event resolves. This is implemented by temporarily adjusting `gainNodes.BGM.gain.value` rather than modifying the stored `config.volume.bgm`.

---

## §2 BGM Design

### 2.1 BGM Track Specifications

All BGM tracks loop seamlessly. Loop points are specified in seconds from the start of the decoded audio buffer. The audio artist must ensure the sample at `loopEnd` matches the amplitude envelope of the sample at `loopStart` within ±1 dBFS to prevent audible clicks.

---

#### BGM_MAIN — Main Game Ambient

| Parameter | Value |
|-----------|-------|
| **Sound ID** | `BGM_MAIN` |
| **File path** | `audio/bgm_main.ogg` (primary) / `audio/bgm_main.mp3` (fallback) |
| **Loop start** | 4.00s |
| **Loop end** | 128.00s |
| **Total file length** | 132.00s (4s intro + 124s loop body) |
| **BPM** | 88 |
| **Key** | D minor |
| **Mood** | Solemn grandeur, anticipation. Low-register string ostinato, sparse choir pads, occasional distant thunder roll. Feels like standing at the base of Mount Olympus — awe with undercurrent tension. |
| **Trigger condition** | Plays on `GameScene` entry; resumes when `FREE_GAME` exits. |
| **Transition in** | Immediate start on first game load. Crossfade 800ms when returning from FG. |
| **Transition out** | Crossfade 800ms before `BGM_COIN_TOSS` or `BGM_FREE_GAME` starts. |
| **Priority** | Base layer; all other BGM tracks override this. |
| **Preload priority** | CRITICAL — loaded first in `MobileAudioUnlock.preloadAudioAssets()`. |
| **Volume (normalized)** | 0.80 (BGM category gain ×0.80) |

**Instrumentation notes:**
- Strings: low cello/bass ostinato at quarter-note pace.
- Choir: long sustained vowel pads (AAAH), very low in mix.
- Percussion: occasional low timpani accents on beats 1 and 3.
- Ambient: rain-of-thunder texture at −24 dBFS, constant but inaudible below mix.

---

#### BGM_ANTICIPATION — All FREE Letters Lit

| Parameter | Value |
|-----------|-------|
| **Sound ID** | `BGM_ANTICIPATION` |
| **File path** | `audio/bgm_anticipation.ogg` / `audio/bgm_anticipation.mp3` |
| **Loop start** | 2.00s |
| **Loop end** | 64.00s |
| **Total file length** | 66.00s |
| **BPM** | 96 |
| **Key** | D minor |
| **Mood** | Rising dread and excitement. Percussion enters forcefully — snare rolls, taiko hits. Choir intensifies. Strings ascend. Signals imminent Thunder Blessing or Coin Toss. |
| **Trigger condition** | All 4 FREE letters are lit (cascade count ≥ 4; `HUDComponent.setFreeLetterProgress(4)`). |
| **Transition in** | Crossfade 300ms from `BGM_MAIN`. |
| **Transition out** | Crossfade 800ms when `COIN_TOSS` starts. Returns to `BGM_MAIN` if cascade ends without FG. |
| **Priority** | Overrides `BGM_MAIN`. Overridden by `BGM_COIN_TOSS` and `BGM_FREE_GAME`. |
| **Volume (normalized)** | 0.85 |

---

#### BGM_COIN_TOSS — Coin Toss Suspense

| Parameter | Value |
|-----------|-------|
| **Sound ID** | `BGM_COIN_TOSS` |
| **File path** | `audio/bgm_coin_toss.ogg` / `audio/bgm_coin_toss.mp3` |
| **Loop start** | 1.00s |
| **Loop end** | 32.00s |
| **Total file length** | 34.00s |
| **BPM** | 72 |
| **Key** | D minor (sparse) |
| **Mood** | Tension and held breath. Minimal instrumentation — solo pizzicato strings, heartbeat-like low bass pulse every 2 beats, silence between. Does not resolve harmonically. Designed to sustain unresolved tension for the 3.0–3.5s coin flip duration. |
| **Trigger condition** | `COIN_TOSS` state entry — `CoinTossComponent` overlay opens. |
| **Transition in** | Crossfade 800ms from `BGM_MAIN` or `BGM_ANTICIPATION`. |
| **Transition out** | Hard-cut to `BGM_FREE_GAME` on HEADS (FG entry). Crossfade 500ms back to `BGM_MAIN` on TAILS. |
| **Priority** | Overrides `BGM_MAIN` and `BGM_ANTICIPATION`. |
| **Volume (normalized)** | 0.70 |

---

#### BGM_FREE_GAME — Free Game Epic Theme

| Parameter | Value |
|-----------|-------|
| **Sound ID** | `BGM_FREE_GAME` |
| **File path** | `audio/bgm_free_game.ogg` / `audio/bgm_free_game.mp3` |
| **Loop start** | 8.00s |
| **Loop end** | 192.00s |
| **Total file length** | 200.00s |
| **BPM** | 120 |
| **Key** | D minor (modulates to D major on ×77 transition) |
| **Mood** | Triumphant, epic, divine. Full orchestral forces: brass fanfares, full choir (VICTORY), electric guitar/synth hybrid strings, driving percussion. Feels like riding Zeus's lightning bolt. Significantly more intense than `BGM_MAIN`. |
| **Trigger condition** | `FREE_GAME` state entry — `FreeGameComponent.enterFreeGame()` called. |
| **Transition in** | Crossfade 800ms from `BGM_COIN_TOSS` (HEADS result). |
| **Transition out** | Crossfade 800ms back to `BGM_MAIN` when FG exits. Crossfade 800ms to `BGM_77X` when ×77 multiplier is reached. |
| **Priority** | Overrides all except `BGM_77X`. |
| **Volume (normalized)** | 1.00 |

**Production note:** `BGM_FREE_GAME` must feel qualitatively distinct from `BGM_MAIN` — not just louder. The BPM jump from 88→120 and harmonic brightness shift are deliberate. The 8-second intro (before loop start) contains a build-up fanfare that is played only once on FG entry.

---

#### BGM_77X — Maximum Multiplier Reached

| Parameter | Value |
|-----------|-------|
| **Sound ID** | `BGM_77X` |
| **File path** | `audio/bgm_77x.ogg` / `audio/bgm_77x.mp3` |
| **Loop start** | 4.00s |
| **Loop end** | 96.00s |
| **Total file length** | 100.00s |
| **BPM** | 132 |
| **Key** | D major (bright, triumphant) |
| **Mood** | Maximum intensity. Electronic percussion layers over orchestra. Distorted choir shouts. Lightning SFX woven into the music bed itself. Reserved exclusively for the ×77 multiplier climax — the rarest, highest-stakes state. |
| **Trigger condition** | FG multiplier advances to ×77 (`fgMultiplier = 77`). |
| **Transition in** | Crossfade 800ms from `BGM_FREE_GAME`. |
| **Transition out** | Crossfade 800ms back to `BGM_MAIN` when FG exits (×77 round ends). |
| **Priority** | Highest — overrides all other BGM. |
| **Volume (normalized)** | 1.00 |

---

### 2.2 BGM Priority Table

| Priority | Track | Overrides |
|----------|-------|-----------|
| 1 (highest) | `BGM_77X` | All |
| 2 | `BGM_FREE_GAME` | `BGM_MAIN`, `BGM_ANTICIPATION`, `BGM_COIN_TOSS` |
| 3 | `BGM_COIN_TOSS` | `BGM_MAIN`, `BGM_ANTICIPATION` |
| 4 | `BGM_ANTICIPATION` | `BGM_MAIN` |
| 5 (base) | `BGM_MAIN` | — |

---

## §3 SFX Catalog

All SFX are one-shot (non-looping) unless explicitly marked `[LOOP]`. Durations are the target rendered audio length in milliseconds. All SFX route through `gainNodes.SFX`.

### 3.1 Core Confirmed SFX (FRONTEND.md §7.2)

The following Sound IDs are confirmed in FRONTEND.md §7 and must be implemented exactly as specified:

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_CASCADE` | `audio/sfx_cascade.ogg` | 500 | Symbol elimination animation start | Generic cascade; used as base layer under `SFX_CASCADE_EXPLODE` |
| `SFX_WIN` | `audio/sfx_win.ogg` | 800 | WIN counter start (any win > 0) | Generic win chime; layered under tier-specific SFX |
| `SFX_LIGHTNING` | `audio/sfx_lightning.ogg` | 600 | Lightning Mark scale-in midpoint | Per-mark; pitch-shifts +2 semitones per additional mark (max +8 st at 5+ marks) |
| `SFX_COIN_TOSS` | `audio/sfx_coin_toss.ogg` | 3250 | Coin fly-in animation start | [LOOP] during spin phase; non-looping version for full sequence |
| `SFX_SCATTER` | `audio/sfx_scatter.ogg` | 1000 | Scatter symbol win animation start | Plays when SC lands (win animation begins) |

### 3.2 Extended SFX Catalog

#### Reel Mechanics

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_SPIN_START` | `audio/sfx_spin_start.ogg` | 350 | SPIN button pressed | Mechanical lever/whoosh; immediate on press |
| `SFX_REEL_STOP_1` | `audio/sfx_reel_stop_1.ogg` | 200 | Reel column 1 stops | Thud + brief electronic click |
| `SFX_REEL_STOP_2` | `audio/sfx_reel_stop_2.ogg` | 200 | Reel column 2 stops | +100ms delay from col 1 stop event |
| `SFX_REEL_STOP_3` | `audio/sfx_reel_stop_3.ogg` | 200 | Reel column 3 stops | +200ms delay from col 1 stop event |
| `SFX_REEL_STOP_4` | `audio/sfx_reel_stop_4.ogg` | 200 | Reel column 4 stops | +300ms delay from col 1 stop event |
| `SFX_REEL_STOP_5` | `audio/sfx_reel_stop_5.ogg` | 200 | Reel column 5 stops | +400ms delay from col 1 stop event; slightly heavier than 1–4 |
| `SFX_REEL_EXPAND` | `audio/sfx_reel_expand.ogg` | 400 | Row count increases; cloud dissipation starts | Rumble-whoosh rising; plays once per expansion event |

> **Stagger rule:** Reel stop sounds 1–5 are triggered 120ms apart. The AudioManager fires `SFX_REEL_STOP_N` 120 × (N−1) ms after the first reel stop event. This matches FRONTEND.md §7.2 timing.

---

#### Cascade Mechanics

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_CASCADE_EXPLODE` | `audio/sfx_cascade_explode.ogg` | 400 | Symbol elimination animation start | Short electric crack; pitch randomized ±1 semitone per call |
| `SFX_CASCADE_DROP` | `audio/sfx_cascade_drop.ogg` | 150 | Symbol landing bounce (420ms after drop start) | Soft thud + brief resonance; played per symbol with stagger matching VDD §4.2 delay (col×20ms + row×30ms) |
| `SFX_FREE_LETTER` | `audio/sfx_free_letter.ogg` | 300 | Single FREE letter lights up (letter glow peak) | Ascending chime; pitch rises per letter: F=base, R=+2st, E3=+4st, E4=+7st |

---

#### Lightning Marks

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_LIGHTNING_MARK` | `audio/sfx_lightning_mark.ogg` | 600 | Mark appears (scale-in midpoint at ~200ms) | Alias for `SFX_LIGHTNING` core confirmed ID. Pitch-shifts +2 semitones per cumulative mark count (1 mark = base pitch; 5+ marks = +8 semitones). Implemented via AudioContext `detune` property. |
| `SFX_LIGHTNING_PERSIST` | `audio/sfx_lightning_persist.ogg` | 1200 | [LOOP] Active marks idle state | Very low-level electric hum/crackle loop; level scales with mark count: 1–2 marks = −18 dBFS, 3–4 = −12 dBFS, 5+ = −6 dBFS |
| `SFX_LIGHTNING_ACTIVATE` | `audio/sfx_lightning_activate.ogg` | 800 | Scatter lands; all marks begin pulsing | Arc activation sweep; plays once when SC triggers mark pulse (t=0.2s in TB sequence) |

---

#### Thunder Blessing

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_THUNDER_BLESSING` | `audio/sfx_thunder_blessing.ogg` | 2200 | t=0.8s in Thunder Blessing sequence (all marks explode) | Confirmed in FRONTEND.md §7.2. Layered: massive thunder crack + choir hit + metallic impact. Peak at 0ms, sustains 800ms, tail 1400ms. |
| `SFX_TB_FIRST_HIT` | `audio/sfx_tb_first_hit.ogg` | 1800 | t=0.8s (marks explode) | Full TB first-hit signature. Background white flash sync. |
| `SFX_TB_SYMBOL_UPGRADE` | `audio/sfx_tb_symbol_upgrade.ogg` | 600 | t=1.5s (target symbol assembles) | Ascending shimmer + chime; plays once per position simultaneously |
| `SFX_SECOND_HIT` | `audio/sfx_second_hit.ogg` | 1500 | t=2.3s in TB sequence (second pulse) | Confirmed in FRONTEND.md §7.2. Second white flash sync. Shorter, sharper than first hit — more electric, less thunder. |
| `SFX_TB_SETTLE` | `audio/sfx_tb_settle.ogg` | 400 | t=3.0s (all animations settle) | Gold resonance chime; signals cascade resume |

---

#### Coin Toss

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_COIN_TOSS_START` | `audio/sfx_coin_toss_start.ogg` | 500 | Coin fly-in animation start | Woosh as coin enters frame from top |
| `SFX_COIN_TOSS_FLIP` | `audio/sfx_coin_toss_flip.ogg` | 400 | [LOOP] During spin phase (800ms–2000ms of flip) | Metal spinning sound; loop seamlessly during sustained spin phase |
| `SFX_COIN_HEADS` | `audio/sfx_coin_heads.ogg` | 800 | Coin face settles at HEADS | Gold coin land + triumphant short brass stab |
| `SFX_COIN_TAILS` | `audio/sfx_coin_tails.ogg` | 600 | Coin face settles at TAILS | Duller metal land + minor-chord resolution |
| `SFX_COIN_MULT_PROGRESS` | `audio/sfx_coin_mult_progress.ogg` | 500 | Progress bar animates to next node (HEADS) | Rising electronic ping; pitch rises per stage (×3=base, ×7=+3st, ×17=+6st, ×27=+9st, ×77=+12st) |

---

#### Free Game

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_FG_ENTER` | `audio/sfx_fg_enter.ogg` | 2500 | FG scene cross-dissolve start | Full fanfare: choir + brass + thunder roll. Plays over BGM crossfade. |
| `SFX_FG_BONUS_REVEAL` | `audio/sfx_fg_bonus_reveal.ogg` | 1500 | Bonus multiplier banner appears (×1) | Standard reveal stinger; no fanfare |
| `SFX_FG_BONUS_5X` | `audio/sfx_fg_bonus_5x.ogg` | 2000 | `fgBonusMultiplier = 5` | Moderate gold particle burst sync; ascending arpeggio |
| `SFX_FG_BONUS_20X` | `audio/sfx_fg_bonus_20x.ogg` | 2500 | `fgBonusMultiplier = 20` | Large burst + banner; choir enters |
| `SFX_FG_BONUS_100X` | `audio/sfx_fg_bonus_100x.ogg` | 4000 | `fgBonusMultiplier = 100` | Full-screen gold explosion. Maximum particle event. Confirmed in FRONTEND.md §7.2 as `SFX_FG_BONUS_100X`. |
| `SFX_FG_MULT_UP` | `audio/sfx_fg_mult_up.ogg` | 1200 | FG multiplier upgrades (HEADS confirmed) | Old number explodes → new number scales in. Rising interval. Confirmed in FRONTEND.md §7.2. |
| `SFX_FG_MULT_77` | `audio/sfx_fg_mult_77.ogg` | 3000 | ×77 multiplier reached | Maximum intensity stinger. BGM transitions to `BGM_77X`. Confirmed in FRONTEND.md §7.2. |
| `SFX_FG_ROUND_START` | `audio/sfx_fg_round_start.ogg` | 400 | Each FG round begins (reel spin start within FG) | Lighter whoosh than main game spin; distinguishes FG context |
| `SFX_FG_COMPLETE` | `audio/sfx_fg_complete.ogg` | 3500 | FG summary panel appears | Grand resolution: choir cadence + thunder toll. Win roll-up to `outcome.totalWin` begins simultaneously. |

---

#### Win Tiers

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_WIN_SMALL` | `audio/sfx_win_small.ogg` | 600 | Small win (0 < win < 5× baseBet); WIN counter starts | Light chime; coin clink. Confirmed in FRONTEND.md §7.2 as `SFX_WIN_MEDIUM` category split. |
| `SFX_WIN_MEDIUM` | `audio/sfx_win_medium.ogg` | 900 | Medium win (5×–20× baseBet) | Brighter chime cluster; brief string swell |
| `SFX_WIN_BIG` | `audio/sfx_win_big.ogg` | 2000 | Big Win (20×–100×); "BIG WIN" banner drops | Brass hit + choir exclaim + coin shower begins. Confirmed in FRONTEND.md §7.2. |
| `SFX_WIN_MEGA` | `audio/sfx_win_mega.ogg` | 3000 | Mega Win (100×–500×); "MEGA WIN" effect | Extended brass fanfare; choir builds; lightning crack underneath |
| `SFX_WIN_JACKPOT` | `audio/sfx_win_jackpot.ogg` | 4000 | Jackpot (≥500×); Zeus character animation | Full orchestral + choir peak; Zeus thunder signature. Confirmed in FRONTEND.md §7.2. |
| `SFX_MAX_WIN` | `audio/sfx_max_win.ogg` | 6000 | 30,000× cap reached (Main Game) | Wall-of-sound climax. Golden coin rain. Choir sustain. Confirmed in FRONTEND.md §7.2. |
| `SFX_MAX_WIN_LEGENDARY` | `audio/sfx_max_win_legendary.ogg` | 10000 | 90,000× cap reached (Extra Bet + Buy Feature) | Extended legendary win signature; separate mastering from `SFX_MAX_WIN`. Confirmed in FRONTEND.md §7.2. |
| `SFX_WIN_ROLLUP_TICK` | `audio/sfx_win_rollup_tick.ogg` | 80 | Each tick of WIN counter animation (throttled) | Light coin click; fired at most every 80ms during roll-up to prevent audio spam |

> **Win tier selection logic:** The game state machine selects exactly one win tier SFX based on `totalWin / baseBet`. Win tier SFX are mutually exclusive. `SFX_WIN` (confirmed core ID) is a generic alias pointing to `SFX_WIN_SMALL` for backward compatibility.

---

#### Scatter

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_SCATTER` | `audio/sfx_scatter.ogg` | 1000 | Scatter symbol win animation start | Confirmed core ID. Electric crackle + rising tone as SC lands. |
| `SFX_SCATTER_WIN` | `audio/sfx_scatter_win.ogg` | 1800 | SC participates in winning line (1.8s Scatter win animation) | Sustained electric hum; Scatter-specific win budget per VDD §3.3. |

---

#### Extra Bet & Buy Feature

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_EXTRA_BET_ON` | `audio/sfx_extra_bet_on.ogg` | 300 | Extra Bet toggle ON | Electric activation snap; brief gold chime tail. Confirmed in FRONTEND.md §7.2. |
| `SFX_EXTRA_BET_OFF` | `audio/sfx_extra_bet_off.ogg` | 250 | Extra Bet toggle OFF | Power-down click; lower pitch than ON |
| `SFX_BUY_FG_CONFIRM` | `audio/sfx_buy_fg_confirm.ogg` | 600 | Buy Feature confirmed; dialog closes | Rich coin placement sound + brief divine chord. Confirmed in FRONTEND.md §7.2. |
| `SFX_BUY_FG_OPEN` | `audio/sfx_buy_fg_open.ogg` | 200 | Buy Feature dialog opens | Light shimmer |

---

#### Near Miss

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_NEAR_MISS` | `audio/sfx_near_miss.ogg` | 800 | `nearMissApplied = true`; grid stop moment | Electric crackle near symbol positions; tension-but-no-resolve. Confirmed in FRONTEND.md §7.2. Lightning arc sound that does not complete — intentional unresolved quality. |

---

#### Session & System

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_SESSION_RESTORE` | `audio/sfx_session_restore.ogg` | 1000 | `SESSION_RECONNECT` → `SESSION_RESTORED_FG` or `SESSION_RESTORED_IDLE` | Reconnection chime; reassuring tone. Plays after session data is confirmed valid. |
| `SFX_SESSION_EXPIRE` | `audio/sfx_session_expire.ogg` | 600 | `SESSION_EXPIRED` dialog shown | Descending minor tone; signals session loss |
| `SFX_ERROR` | `audio/sfx_error.ogg` | 400 | `NETWORK_ERROR` state entry | Low-key negative indicator; not alarming |

---

#### UI Sounds

| Sound ID | File | Duration (ms) | Trigger | Notes |
|----------|------|:-------------:|---------|-------|
| `SFX_UI_BUTTON_PRESS` | `audio/sfx_ui_button_press.ogg` | 80 | Any button press (SPIN, BET+/−, INFO, SETTINGS) | Crisp snap; VDD `--duration-snap` 80ms alignment |
| `SFX_UI_BET_UP` | `audio/sfx_ui_bet_up.ogg` | 120 | BET+ pressed | Ascending short click |
| `SFX_UI_BET_DOWN` | `audio/sfx_ui_bet_down.ogg` | 120 | BET− pressed | Descending short click |
| `SFX_UI_SOUND_TOGGLE` | `audio/sfx_ui_sound_toggle.ogg` | 150 | SOUND button toggled | Muted mechanical click (plays at full gain even if BGM/SFX being muted, as last action before mute applies) |
| `SFX_UI_INFO_OPEN` | `audio/sfx_ui_info_open.ogg` | 200 | INFO panel opens | Parchment-scroll unfold texture |
| `SFX_UI_INFO_CLOSE` | `audio/sfx_ui_info_close.ogg` | 150 | INFO panel closes | Reverse of open |
| `SFX_UI_DIALOG_OPEN` | `audio/sfx_ui_dialog_open.ogg` | 200 | Any modal dialog appears | Soft pop |
| `SFX_UI_DIALOG_CLOSE` | `audio/sfx_ui_dialog_close.ogg` | 150 | Any modal dialog dismisses | Soft pop out |

---

### 3.3 Sound ID Master Index

All Sound IDs used in the game, in alphabetical order:

| Sound ID | Category | Confirmed in FRONTEND.md §7 |
|----------|----------|-----------------------------|
| `BGM_77X` | BGM | No (extension) |
| `BGM_ANTICIPATION` | BGM | Yes (§7.2) |
| `BGM_COIN_TOSS` | BGM | Yes (§7.2) |
| `BGM_FREE_GAME` | BGM | Yes (§7 preload list) |
| `BGM_MAIN` | BGM | Yes (§7 preload list) |
| `SFX_BUY_FG_CONFIRM` | SFX | Yes (§7.2) |
| `SFX_BUY_FG_OPEN` | SFX | No (extension) |
| `SFX_CASCADE` | SFX | Yes (§7 preload list) |
| `SFX_CASCADE_DROP` | SFX | Yes (§7.2) |
| `SFX_CASCADE_EXPLODE` | SFX | Yes (§7.2) |
| `SFX_COIN_HEADS` | SFX | Yes (§7.2) |
| `SFX_COIN_MULT_PROGRESS` | SFX | No (extension) |
| `SFX_COIN_TAILS` | SFX | Yes (§7.2) |
| `SFX_COIN_TOSS` | SFX | Yes (§7 preload list) |
| `SFX_COIN_TOSS_FLIP` | SFX | Yes (§7.2 as `SFX_COIN_TOSS_FLIP`) |
| `SFX_COIN_TOSS_START` | SFX | Yes (§7.2 as `SFX_COIN_TOSS_START`) |
| `SFX_ERROR` | SFX | No (extension) |
| `SFX_EXTRA_BET_OFF` | SFX | No (extension) |
| `SFX_EXTRA_BET_ON` | SFX | Yes (§7.2) |
| `SFX_FG_BONUS_100X` | SFX | Yes (§7.2) |
| `SFX_FG_BONUS_20X` | SFX | No (extension) |
| `SFX_FG_BONUS_5X` | SFX | No (extension) |
| `SFX_FG_BONUS_REVEAL` | SFX | No (extension) |
| `SFX_FG_COMPLETE` | SFX | No (extension) |
| `SFX_FG_ENTER` | SFX | Yes (§7.2) |
| `SFX_FG_MULT_77` | SFX | Yes (§7.2) |
| `SFX_FG_MULT_UP` | SFX | Yes (§7.2) |
| `SFX_FG_ROUND_START` | SFX | No (extension) |
| `SFX_FREE_LETTER` | SFX | Yes (§7.2) |
| `SFX_LIGHTNING` | SFX | Yes (§7 preload list) |
| `SFX_LIGHTNING_ACTIVATE` | SFX | No (extension) |
| `SFX_LIGHTNING_MARK` | SFX | Yes (§7.2 as `SFX_LIGHTNING_MARK`) |
| `SFX_LIGHTNING_PERSIST` | SFX | No (extension) |
| `SFX_MAX_WIN` | SFX | Yes (§7.2) |
| `SFX_MAX_WIN_LEGENDARY` | SFX | Yes (§7.2) |
| `SFX_NEAR_MISS` | SFX | Yes (§7.2) |
| `SFX_REEL_EXPAND` | SFX | Yes (§7.2) |
| `SFX_REEL_STOP_1`–`SFX_REEL_STOP_5` | SFX | Yes (§7.2) |
| `SFX_SCATTER` | SFX | Yes (§7 preload list) |
| `SFX_SCATTER_WIN` | SFX | No (extension) |
| `SFX_SECOND_HIT` | SFX | Yes (§7.2) |
| `SFX_SESSION_EXPIRE` | SFX | No (extension) |
| `SFX_SESSION_RESTORE` | SFX | No (extension) |
| `SFX_SPIN_START` | SFX | Yes (§7.2) |
| `SFX_TB_FIRST_HIT` | SFX | No (extension of `SFX_THUNDER_BLESSING`) |
| `SFX_TB_SETTLE` | SFX | No (extension) |
| `SFX_TB_SYMBOL_UPGRADE` | SFX | No (extension) |
| `SFX_THUNDER_BLESSING` | SFX | Yes (§7.2) |
| `SFX_UI_BET_DOWN` | SFX | No (extension) |
| `SFX_UI_BET_UP` | SFX | No (extension) |
| `SFX_UI_BUTTON_PRESS` | SFX | No (extension) |
| `SFX_UI_DIALOG_CLOSE` | SFX | No (extension) |
| `SFX_UI_DIALOG_OPEN` | SFX | No (extension) |
| `SFX_UI_INFO_CLOSE` | SFX | No (extension) |
| `SFX_UI_INFO_OPEN` | SFX | No (extension) |
| `SFX_UI_SOUND_TOGGLE` | SFX | No (extension) |
| `SFX_WIN` | SFX | Yes (§7 preload list) |
| `SFX_WIN_BIG` | SFX | Yes (§7.2) |
| `SFX_WIN_JACKPOT` | SFX | Yes (§7.2) |
| `SFX_WIN_MEDIUM` | SFX | Yes (§7.2) |
| `SFX_WIN_MEGA` | SFX | Yes (§7.2) |
| `SFX_WIN_ROLLUP_TICK` | SFX | No (extension) |
| `SFX_WIN_SMALL` | SFX | Yes (§7.2) |

---

## §4 Adaptive Audio State Machine

### 4.1 Audio State Definitions

The audio state machine is a parallel subsystem of the game state machine (FRONTEND.md §4.2). It does not own game logic — it subscribes to game state transitions and applies the appropriate audio actions.

```
AudioState = {
  bgmTrack: SoundId | null,       // currently playing BGM
  bgmGainFactor: number,          // temporary duck factor (1.0 = normal)
  sfxLayersActive: Set<string>,   // named SFX layers active in this state
  pendingCrossfade: Promise | null
}
```

### 4.2 Full State Transition Table

| From State | To State | Trigger | BGM Action | BGM Duration | SFX Fired |
|------------|----------|---------|------------|:------------:|-----------|
| `IDLE` | `SPINNING` | `SPIN_PRESSED` | Continue `BGM_MAIN` | — | `SFX_SPIN_START` (immediate) |
| `SPINNING` | `CASCADE_RESOLVING` | `SPIN_RESPONSE_OK` | Continue `BGM_MAIN` | — | `SFX_REEL_STOP_1`–`5` (staggered 120ms) |
| `CASCADE_RESOLVING` | `CASCADE_RESOLVING` | `NEXT_CASCADE_STEP` | Continue current BGM | — | Per-step SFX (see §5) |
| `CASCADE_RESOLVING` | `THUNDER_BLESSING` | `TB_TRIGGERED` | Duck current BGM −6dB over 200ms | 200ms duck | `SFX_LIGHTNING_ACTIVATE` |
| `CASCADE_RESOLVING` | `COIN_TOSS` | `CASCADE_COMPLETE_COIN_TOSS` | Crossfade to `BGM_COIN_TOSS` | 800ms | `SFX_COIN_TOSS_START` |
| `CASCADE_RESOLVING` | `RESULT_DISPLAY` | `CASCADE_COMPLETE_WIN` | Continue `BGM_MAIN`, duck −6dB during win tier SFX | 200ms duck | Win tier SFX (see §3.2) |
| `CASCADE_RESOLVING` | `RESULT_DISPLAY` | `CASCADE_COMPLETE_NO_WIN` | Continue `BGM_MAIN` | — | None |
| `THUNDER_BLESSING` | `CASCADE_RESOLVING` | `TB_SEQUENCE_COMPLETE` | Restore BGM gain to 1.0 over 400ms | 400ms restore | `SFX_TB_SETTLE` |
| `COIN_TOSS` | `FREE_GAME` | `COIN_TOSS_HEADS_FG` | Hard-cut `BGM_COIN_TOSS`; crossfade to `BGM_FREE_GAME` | 800ms | `SFX_FG_ENTER` |
| `COIN_TOSS` | `RESULT_DISPLAY` | `COIN_TOSS_TAILS` | Crossfade to `BGM_MAIN` | 500ms | `SFX_COIN_TAILS` |
| `FREE_GAME` | `FREE_GAME` | `FG_ROUND_START` | Continue `BGM_FREE_GAME` (or `BGM_77X`) | — | `SFX_FG_ROUND_START` |
| `FREE_GAME` | `FREE_GAME` | `FG_ROUND_COMPLETE_HEADS` + mult=77 | Crossfade to `BGM_77X` | 800ms | `SFX_FG_MULT_77` |
| `FREE_GAME` | `FREE_GAME` | `FG_ROUND_COMPLETE_HEADS` + mult≠77 | Continue current BGM | — | `SFX_FG_MULT_UP` + `SFX_COIN_MULT_PROGRESS` |
| `FREE_GAME` | `RESULT_DISPLAY` | `FG_ROUND_COMPLETE_TAILS` | Continue until FG_COMPLETE fires | — | `SFX_FG_COMPLETE`, then win tier SFX |
| `RESULT_DISPLAY` | `IDLE` | `RESULT_DISMISSED` | Crossfade to `BGM_MAIN` (if not already playing) | 800ms | None |
| `IDLE` | `IDLE` | All FREE letters lit (cascade ≥ 4) | Crossfade to `BGM_ANTICIPATION` | 300ms | — |
| `IDLE` | `IDLE` | FREE letters reset | Crossfade to `BGM_MAIN` | 800ms | — |
| Any | `NETWORK_ERROR` | `NETWORK_OFFLINE` or API error | Continue current BGM, reduce −3dB | 300ms | `SFX_ERROR` |
| `NETWORK_ERROR` | `IDLE` | `RETRY_CLICKED` | Restore BGM gain; crossfade to `BGM_MAIN` if needed | 500ms | None |
| `SESSION_RECONNECT` | `FREE_GAME` | `SESSION_RESTORED_FG` | Crossfade to `BGM_FREE_GAME` | 800ms | `SFX_SESSION_RESTORE` |
| `SESSION_RECONNECT` | `IDLE` | `SESSION_RESTORED_IDLE` | `BGM_MAIN` (ensure playing) | — | `SFX_SESSION_RESTORE` |
| `SESSION_RECONNECT` | `IDLE` | `SESSION_EXPIRED` | `BGM_MAIN` | — | `SFX_SESSION_EXPIRE` |

### 4.3 Ducking Rules

| Event | BGM Gain Change | Duration In | Hold | Duration Out | Notes |
|-------|:---------------:|:-----------:|:----:|:------------:|-------|
| `THUNDER_BLESSING` state entry | −6 dB (factor 0.5) | 200ms linear | For TB sequence (~3s) | 400ms linear | Restores on `TB_SEQUENCE_COMPLETE` |
| Big Win / Mega Win / Jackpot SFX playing | −6 dB (factor 0.5) | 200ms linear | For win SFX duration | 400ms linear | SFX duration drives hold time |
| Max Win (30,000×) event | −12 dB (factor 0.25) | 300ms linear | 6000ms | 800ms linear | Extended duck for max win |
| `NETWORK_ERROR` state | −3 dB (factor 0.71) | 300ms linear | Until error cleared | 500ms linear | Subtle — game still feels alive |
| FG Bonus ×100 reveal | −9 dB (factor 0.35) | 300ms linear | 4000ms | 600ms linear | Foreground spectacle takes priority |

**Ducking implementation:** Ducking is applied by temporarily setting `gainNodes.BGM.gain.value` via `linearRampToValueAtTime`. The stored `config.volume.bgm` is never modified. Restoration sets `gainNodes.BGM.gain.value` back to `this.muted ? 0 : this.config.volume.bgm` over the restore duration.

### 4.4 SFX Layers Per State

| Game State | Active SFX Layers |
|------------|------------------|
| `IDLE` | UI layer only (`SFX_UI_*`); `SFX_LIGHTNING_PERSIST` (if marks active) |
| `SPINNING` | Reel layer (`SFX_SPIN_START`, `SFX_REEL_STOP_*`) |
| `CASCADE_RESOLVING` | Cascade layer (`SFX_CASCADE_EXPLODE`, `SFX_CASCADE_DROP`, `SFX_REEL_EXPAND`, `SFX_FREE_LETTER`, `SFX_LIGHTNING_MARK`, `SFX_LIGHTNING_PERSIST`), win layer (`SFX_WIN_*`, `SFX_SCATTER`) |
| `THUNDER_BLESSING` | Thunder Blessing layer (`SFX_THUNDER_BLESSING`, `SFX_TB_FIRST_HIT`, `SFX_TB_SYMBOL_UPGRADE`, `SFX_SECOND_HIT`, `SFX_TB_SETTLE`, `SFX_LIGHTNING_ACTIVATE`) |
| `COIN_TOSS` | Coin toss layer (`SFX_COIN_TOSS_START`, `SFX_COIN_TOSS_FLIP` [loop], `SFX_COIN_HEADS` or `SFX_COIN_TAILS`, `SFX_COIN_MULT_PROGRESS`) |
| `FREE_GAME` | All layers (same as CASCADE_RESOLVING + FG layer: `SFX_FG_ENTER`, `SFX_FG_BONUS_*`, `SFX_FG_MULT_UP`, `SFX_FG_MULT_77`, `SFX_FG_ROUND_START`, `SFX_FG_COMPLETE`) |
| `RESULT_DISPLAY` | Win tier layer + FG complete layer |
| `NETWORK_ERROR` | UI error layer (`SFX_ERROR`, `SFX_UI_DIALOG_*`) only |

---

## §5 AnimationQueue Audio Mapping

This section defines which audio events are fired for each `AnimationStep` type dispatched by `AnimationQueue.play()` (FRONTEND.md §6.1). The `AnimationDispatcher.dispatch()` implementation is responsible for triggering audio alongside visual playback.

All timings below are relative to the start of `dispatcher.dispatch(step)` being called.

---

### 5.1 `NEAR_MISS`

**Trigger:** `outcome.nearMissApplied = true`; fires before cascade steps.

| Time offset | Audio Action |
|:-----------:|-------------|
| 0ms | `SFX_NEAR_MISS` — electric crackle at near-miss positions; plays as grid stops |

**Notes:** Near miss plays once at grid-stop moment. Does not affect BGM.

---

### 5.2 `CASCADE_STEP`

**Trigger:** Each `CascadeStep` from `cascadeSequence.steps`. Steps 1 through N in sequence.

| Animation Sub-step | Time Offset | Audio Action |
|-------------------|:-----------:|-------------|
| Symbol win animation starts | 0ms | `SFX_WIN` (generic chime, if `step.stepWin > 0`) |
| Scatter win (if SC in win line) | 0ms | `SFX_SCATTER_WIN` (layered with `SFX_WIN`) |
| WIN counter starts | 0ms | `SFX_WIN_ROLLUP_TICK` (throttled — fire at most every 80ms during roll-up) |
| Symbol elimination starts | ~800ms (after slowest win anim — 1.8s for SC adjusted to elimination start) | `SFX_CASCADE_EXPLODE` (per symbol; pitch ±1 semitone randomized) |
| Lightning Mark appears | concurrent with elimination | `SFX_LIGHTNING_MARK` (per new mark; pitch +2st × mark count) |
| Reel expansion (if `step.rows > prev`) | ~1000ms | `SFX_REEL_EXPAND` |
| FREE letter lights | concurrent with expansion | `SFX_FREE_LETTER` (per letter lit; pitch shifts by letter position) |
| Symbol falls and lands | ~1420ms (drop start + 420ms) | `SFX_CASCADE_DROP` (per symbol; staggered per VDD §4.2 delay formula) |
| Lightning Marks persist | continuous | `SFX_LIGHTNING_PERSIST` [loop] gain adjusted by mark count |

**Win tier SFX mapping** (fired at WIN counter start, `step.stepWin / baseBet`):

| Step Win / baseBet | SFX Fired |
|:-----------------:|-----------|
| 0 | None |
| > 0 and < 5 | `SFX_WIN_SMALL` |
| 5–19 | `SFX_WIN_MEDIUM` |
| ≥ 20 | `SFX_WIN_BIG` or higher (evaluated on final `WIN_DISPLAY` step, not per cascade step) |

> **Important:** Per-cascade-step SFX uses only `SFX_WIN_SMALL` / `SFX_WIN_MEDIUM` for in-step feedback. The major win tier SFX (`SFX_WIN_BIG`, `SFX_WIN_MEGA`, `SFX_WIN_JACKPOT`, `SFX_MAX_WIN`) are reserved exclusively for the `WIN_DISPLAY` step evaluated against the cumulative `totalWin`.

---

### 5.3 `THUNDER_BLESSING`

**Trigger:** After the cascade step that sets `thunderBlessingTriggeredAfterStep = true`.

| Time Offset | Audio Action |
|:-----------:|-------------|
| 0ms | `SFX_LIGHTNING_ACTIVATE` — Scatter lands; all marks begin to pulse |
| 800ms | `SFX_THUNDER_BLESSING` — all marks explode; white flash sync |
| 800ms | `SFX_TB_FIRST_HIT` — layered with `SFX_THUNDER_BLESSING` for first hit signature |
| 800ms | BGM duck −6dB begins (200ms ramp) |
| 1500ms | `SFX_TB_SYMBOL_UPGRADE` — target symbol assembles at each converted position |
| 2300ms (if `thunderBlessingSecondHit = true`) | `SFX_SECOND_HIT` — second pulse white flash |
| 3000ms | `SFX_TB_SETTLE` — sequence complete; cascade resume signal |
| 3000ms + 400ms | BGM gain restores to 1.0 (400ms ramp) |

---

### 5.4 `COIN_TOSS`

**Trigger:** When `coinTossTriggered = true` (Main Game) or after each FG round's cascade resolves.

| Time Offset | Audio Action |
|:-----------:|-------------|
| 0ms | BGM crossfade to `BGM_COIN_TOSS` (800ms) |
| 0ms | `SFX_COIN_TOSS_START` — coin fly-in woosh |
| 500ms | `SFX_COIN_TOSS_FLIP` [loop starts] — spinning metal sound |
| 500ms–2000ms | `SFX_COIN_TOSS_FLIP` loop continues for 1000–1500ms (spin phase) |
| ~2000ms | `SFX_COIN_TOSS_FLIP` loop stops |
| 3000ms–3500ms (on deceleration settle) | `SFX_COIN_HEADS` or `SFX_COIN_TAILS` — result reveal |
| On HEADS: deceleration settle + 0ms | `SFX_COIN_MULT_PROGRESS` — progress bar animates |
| On TAILS: deceleration settle + 0ms | BGM crossfade to `BGM_MAIN` (500ms) |
| On HEADS (FG entry): +0ms | BGM hard-cut `BGM_COIN_TOSS`; crossfade to `BGM_FREE_GAME` (800ms) |

---

### 5.5 `FG_ENTRY`

**Trigger:** FG triggered (`fgTriggered = true`); plays before first `FG_ROUND`.

| Time Offset | Audio Action |
|:-----------:|-------------|
| 0ms | `SFX_FG_ENTER` — full fanfare; plays over BGM crossfade |
| 0ms | BGM crossfade to `BGM_FREE_GAME` (800ms) |
| 800ms | Scene cross-dissolve to Sky Temple background |
| 1800ms (banner drop + multiplier reveal) | `SFX_FG_BONUS_REVEAL` (for ×1), or `SFX_FG_BONUS_5X` / `SFX_FG_BONUS_20X` / `SFX_FG_BONUS_100X` based on `fgBonusMultiplier` value |

**Bonus multiplier SFX selection:**

| `fgBonusMultiplier` | SFX Fired |
|:-------------------:|-----------|
| 1 | `SFX_FG_BONUS_REVEAL` |
| 5 | `SFX_FG_BONUS_5X` |
| 20 | `SFX_FG_BONUS_20X` |
| 100 | `SFX_FG_BONUS_100X` + BGM duck −9dB for 4000ms |

---

### 5.6 `FG_ROUND`

**Trigger:** Each element of `fgRounds` array, in sequence. Internally plays a full cascade sequence plus a post-round coin toss.

| Sub-phase | Time Offset | Audio Action |
|-----------|:-----------:|-------------|
| Round start | 0ms | `SFX_FG_ROUND_START` |
| Cascade steps (each) | Per-cascade | Same SFX mapping as `CASCADE_STEP` (§5.2) |
| Post-round coin toss | After cascade resolves | Same SFX mapping as `COIN_TOSS` (§5.4) |
| HEADS → multiplier advance | Post-coin result | `SFX_FG_MULT_UP`; if new mult = 77 → `SFX_FG_MULT_77` + BGM crossfade to `BGM_77X` (800ms) |
| HEADS → multiplier display | +0ms | `SFX_COIN_MULT_PROGRESS` |

---

### 5.7 `FG_COMPLETE`

**Trigger:** After all FG rounds complete (last coin toss result = TAILS or max 5 rounds consumed).

| Time Offset | Audio Action |
|:-----------:|-------------|
| 0ms | `SFX_FG_COMPLETE` — summary panel appears |
| 0ms | WIN roll-up to `outcome.totalWin` begins; `SFX_WIN_ROLLUP_TICK` fires throttled |
| End of roll-up | Win tier SFX (evaluated against `totalWin / baseBet`): `SFX_WIN_BIG` / `SFX_WIN_MEGA` / `SFX_WIN_JACKPOT` / `SFX_MAX_WIN` / `SFX_MAX_WIN_LEGENDARY` |
| End of win tier SFX + 800ms | BGM crossfade back to `BGM_MAIN` (800ms) |

---

### 5.8 `WIN_DISPLAY`

**Trigger:** `outcome.totalWin > 0` and `!outcome.fgTriggered` — non-FG win resolution.

| `totalWin / baseBet` | Time Offset | Audio Action |
|:-------------------:|:-----------:|-------------|
| < 5 | 0ms | `SFX_WIN_SMALL` |
| 5–19 | 0ms | `SFX_WIN_MEDIUM` |
| 20–99 | 0ms | `SFX_WIN_BIG` + BGM duck −6dB for 2000ms |
| 100–499 | 0ms | `SFX_WIN_MEGA` + BGM duck −6dB for 3000ms |
| 500–29999 | 0ms | `SFX_WIN_JACKPOT` + BGM duck −6dB for 4000ms |
| 30000 (Main Game max) | 0ms | `SFX_MAX_WIN` + BGM duck −12dB for 6000ms |
| 90000 (Buy Feature max) | 0ms | `SFX_MAX_WIN_LEGENDARY` + BGM duck −12dB for 10000ms |

WIN roll-up (`SFX_WIN_ROLLUP_TICK`) fires throttled to once per 80ms during the roll-up animation (FRONTEND.md §6.7 win roll-up algorithm drives timing).

---

## §6 Audio Implementation Notes

### 6.1 AudioManager API Integration

All audio interactions go through `AudioManager.getInstance()` (FRONTEND.md §7.1). Key integration rules:

**Preload priority order** (executed in `MobileAudioUnlock.preloadAudioAssets`):

1. **Tier 1 — Critical (block on load):**
   - `BGM_MAIN` (`audio/bgm_main.ogg`)

2. **Tier 2 — High priority (fire-and-forget after Tier 1):**
   - `BGM_FREE_GAME`, `BGM_COIN_TOSS`, `BGM_ANTICIPATION`
   - `SFX_CASCADE`, `SFX_WIN`, `SFX_LIGHTNING`, `SFX_COIN_TOSS`, `SFX_SCATTER`

3. **Tier 3 — Deferred (loaded in background after Tier 2):**
   - `BGM_77X`
   - All `SFX_WIN_*` tier sounds
   - `SFX_THUNDER_BLESSING`, `SFX_SECOND_HIT`
   - `SFX_FG_ENTER`, `SFX_FG_BONUS_*`, `SFX_FG_MULT_*`
   - `SFX_MAX_WIN`, `SFX_MAX_WIN_LEGENDARY`

4. **Tier 4 — Lazy (loaded on first approach):**
   - All `SFX_UI_*` sounds
   - `SFX_SESSION_*`, `SFX_ERROR`
   - `SFX_EXTRA_BET_*`, `SFX_BUY_FG_*`

**Missing-audio fallback:** If a Tier 3 or Tier 4 sound is not yet loaded when triggered, the `AudioManager.play()` call is a no-op (no error thrown). This is acceptable for non-critical SFX. Critical sounds (Tier 1–2) must be loaded before gameplay begins.

**Crossfade usage:**
```typescript
// Crossfade BGM on state transition
await AudioManager.getInstance().crossfadeBGM('BGM_FREE_GAME', 800);

// Play one-shot SFX
AudioManager.getInstance().play('SFX_THUNDER_BLESSING', 'SFX');

// Play looping SFX (e.g., coin flip)
AudioManager.getInstance().play('SFX_COIN_TOSS_FLIP', 'SFX', true);
```

The `SoundId` type in `AudioManager` is `string`. All Sound IDs in this document map directly to the `soundId` parameter.

### 6.2 Mobile Audio Unlock Pattern

As defined in FRONTEND.md §7.4, the `MobileAudioUnlock` class handles iOS Safari / Chrome for Android constraints:

- `AudioContext` must not be created until a user gesture (`touchstart` or `click`) fires.
- `MobileAudioUnlock.setup(audioManager)` is called once at app initialization (before any audio plays).
- On first gesture: `audioManager.unlock()` creates `AudioContext`, initializes `gainNodes`, calls `context.resume()`.
- After unlock: `BGM_MAIN` is preloaded immediately; remaining assets deferred.
- The `once: true` option on event listeners prevents double-invocation.
- If the player mutes before the first interaction, `muted = true` is set in `AudioManager` config; the unlock still runs but gain stays at 0.

**Pre-unlock state:** No audio plays. The SOUND toggle button is visible and functional (sets the `muted` flag) before unlock, so when unlock occurs, the muted state is already correct.

### 6.3 Volume Mixing Levels

| Category | Default Gain | Range | Notes |
|----------|:------------:|:-----:|-------|
| BGM (`gainNodes.BGM`) | 0.80 | 0.0–1.0 | User-adjustable (future settings panel) |
| SFX (`gainNodes.SFX`) | 1.00 | 0.0–1.0 | User-adjustable |
| BGM during duck | 0.5 × current (−6dB) | — | Temporary; auto-restores |
| SFX_LIGHTNING_PERSIST (1–2 marks) | 0.13 (−18dBFS of SFX gain) | — | Applied per-source via source gain |
| SFX_LIGHTNING_PERSIST (3–4 marks) | 0.25 (−12dBFS) | — | |
| SFX_LIGHTNING_PERSIST (5+ marks) | 0.50 (−6dBFS) | — | |
| SFX_WIN_ROLLUP_TICK | 0.30 | — | Kept low; background feedback only |
| Win tier SFX (Big Win+) | 1.00 | — | Full gain; BGM ducked to compensate |

**Master volume:** There is no separate master gain node in the current `AudioManager`. Per-player volume adjustments are implemented by scaling both `gainNodes.BGM` and `gainNodes.SFX` together. A future settings panel may add a master gain node between the category nodes and destination.

### 6.4 Looping Specifications

Seamless loop markers must be set by the audio artist in the source DAW (Pro Tools / Logic / Reaper) before export. The loop point is encoded in the OGG file's `LOOPSTART` and `LOOPEND` metadata tags so the `AudioBufferSourceNode` loop aligns without client-side trimming.

| Sound ID | `source.loop` | `source.loopStart` (s) | `source.loopEnd` (s) | Notes |
|----------|:------------:|:----------------------:|:--------------------:|-------|
| `BGM_MAIN` | `true` | 4.00 | 128.00 | Set after `AudioBufferSourceNode` creation |
| `BGM_ANTICIPATION` | `true` | 2.00 | 64.00 | |
| `BGM_COIN_TOSS` | `true` | 1.00 | 32.00 | |
| `BGM_FREE_GAME` | `true` | 8.00 | 192.00 | |
| `BGM_77X` | `true` | 4.00 | 96.00 | |
| `SFX_COIN_TOSS_FLIP` | `true` | 0.00 | 0.40 | Loop for spin phase only; stopped manually on decelerate |
| `SFX_LIGHTNING_PERSIST` | `true` | 0.00 | 1.20 | Per-mark instance; one source node per active mark group |

All other SFX: `source.loop = false`. They play once and the node is discarded.

**Loop integrity requirement:** The amplitude at `loopEnd` must match `loopStart` within ±1 dBFS. Phase must match within ±5°. The audio team must export a reference listen test at 44.1 kHz mono (looped 3×) before delivery. Loop click artifacts fail QA.

### 6.5 File Format Requirements

| Format | Usage | Codec | Target Bitrate | Sample Rate | Channels |
|--------|-------|-------|:--------------:|:-----------:|:--------:|
| OGG Vorbis | Primary (all browsers except Safari < 11) | Vorbis q7 (~224kbps) | ~224kbps | 44100 Hz | Stereo for BGM; Mono for SFX |
| MP3 | Fallback (Safari, iOS WebAudio) | LAME 3.100 | 192kbps CBR | 44100 Hz | Stereo for BGM; Mono for SFX |

**Format detection:**

```typescript
const supportsOgg = new Audio().canPlayType('audio/ogg; codecs=vorbis') !== '';
const ext = supportsOgg ? 'ogg' : 'mp3';
// Preload URL: `audio/bgm_main.${ext}`
```

**SFX normalization:** All SFX must be normalized to −1.0 dBFS peak before encode. BGM tracks normalized to −3.0 dBFS (headroom for layering). No SFX should contain DC offset (high-pass filter at 20 Hz before encode).

### 6.6 Memory Budget

Target: **< 50 MB total decoded audio in memory** at peak (all Tier 1–3 loaded simultaneously).

| Track / Group | Estimated Decoded Size | Notes |
|---------------|:----------------------:|-------|
| `BGM_MAIN` (132s stereo 44.1kHz) | ~22 MB | Largest single asset |
| `BGM_FREE_GAME` (200s stereo) | ~34 MB | Exceeds budget alone if all BGMs loaded simultaneously |
| `BGM_COIN_TOSS` (34s stereo) | ~6 MB | |
| `BGM_ANTICIPATION` (66s stereo) | ~11 MB | |
| `BGM_77X` (100s stereo) | ~17 MB | |
| All SFX (est. 60 files × ~1s mono avg) | ~10 MB | |

**BGM budget strategy:** BGM tracks are loaded sequentially on demand, not all at once. Only one BGM track beyond `BGM_MAIN` is held in memory at a time. When `crossfadeBGM` completes, the old BGM buffer is garbage-collected (the `AudioBufferSourceNode` is stopped and dereferenced; the `AudioBuffer` is removed from `sounds` Map). This requires tracking which BGM buffers are evictable.

**Practical peak memory with sequential loading:**
- `BGM_MAIN` + next BGM + all SFX ≈ 22 MB + 34 MB (worst case `BGM_FREE_GAME`) + 10 MB = ~66 MB.
- To meet the < 50 MB target: BGM durations should be reduced. Target `BGM_FREE_GAME` ≤ 90s loop (≈15 MB decoded) and `BGM_MAIN` ≤ 60s loop (≈10 MB decoded). The audio artist should design loops to be musically complete within these durations.
- Alternatively, the budget is revised to < 80 MB and approved by the Engineering Lead.

---

## §7 Accessibility

### 7.1 Mute Control Behavior

The SOUND button in the HUD (`HUDComponent`) toggles `AudioManager.setMuted(true/false)`. When muted:

- `gainNodes.BGM.gain.value` is set to `0` immediately (no fade).
- `gainNodes.SFX.gain.value` is set to `0` immediately.
- All currently playing `AudioBufferSourceNode` instances continue their internal time position (they are not stopped). This preserves loop synchronization so that when unmuted, BGM resumes at the correct position without restart.
- The mute state persists in `localStorage` under key `thunder_blessing_muted` so it survives page reload.

**Mute during unlock:** If the player interacts with the SOUND button before the first gameplay interaction, the `muted` flag is set in `AudioManager.config`. On unlock, `AudioContext` is created with both gain nodes at 0.

**SFX_UI_SOUND_TOGGLE** plays at full gain before the mute is applied (so the player gets tactile click feedback even when muting). On unmute, `SFX_UI_SOUND_TOGGLE` plays at full gain after the gain nodes are restored.

### 7.2 Reduced Motion / Audio Mode

Players using platform accessibility settings (iOS Reduce Motion, Android Accessibility, browser `prefers-reduced-motion`) may experience reduced animation fidelity (per VDD §4 rules). Audio design accommodates:

- **Reduced motion does NOT automatically reduce audio.** Audio is independently mutable.
- If `prefers-reduced-motion: reduce` is detected, the following audio changes apply:
  - `SFX_NEAR_MISS` gain reduced by −6 dB (crackle is associated with lightning animation; reduced if animation is suppressed).
  - `SFX_LIGHTNING_MARK` plays once per mark appearance but pitch-shift algorithm is disabled (fixed pitch).
  - All other audio remains unchanged.

### 7.3 Visual Alternatives for Audio Cues

For players who are deaf or hard of hearing, every significant audio cue has a corresponding visual indicator. The following table maps audio events to their visual counterpart:

| Audio Cue | Visual Alternative | Component |
|-----------|-------------------|-----------|
| `BGM_COIN_TOSS` starts | Full-screen coin toss overlay activates with spotlight cone | `CoinTossComponent` |
| `SFX_COIN_HEADS` | "ZEUS SMILES!" banner with gold burst particles | `CoinTossComponent` |
| `SFX_COIN_TAILS` | "NOT THIS TIME" silver text; coin dims | `CoinTossComponent` |
| `SFX_THUNDER_BLESSING` | White flash (opacity 0→0.9→0); fx_thunder_blessing_hit1.spine | `ThunderBlessingComponent` |
| `SFX_SECOND_HIT` | White flash (opacity 0→0.6→0); fx_thunder_blessing_hit2.spine | `ThunderBlessingComponent` |
| `SFX_LIGHTNING_MARK` | Gold lightning bolt overlay scales in (scale 0→1.2→1.0) | `LightningMarkComponent` |
| `SFX_LIGHTNING_PERSIST` | Continuous gold arc particles (Additive blend) on marked cells | `LightningMarkComponent` |
| `BGM_ANTICIPATION` starts | All 4 FREE letters glow at full brightness simultaneously | `HUDComponent` |
| `SFX_FREE_LETTER` | Individual FREE letter lights up with brightness animation | `HUDComponent` |
| `SFX_FG_ENTER` | Scene cross-dissolves to Sky Temple; FG banner drops | `FreeGameComponent` |
| `SFX_FG_MULT_UP` | Old multiplier explodes; new multiplier scales in from center | `CoinTossComponent` |
| `SFX_WIN_BIG` / `SFX_WIN_MEGA` / `SFX_WIN_JACKPOT` | BIG WIN / MEGA WIN / JACKPOT overlay with particle effects | `BalanceComponent.showWinTier()` |
| `SFX_MAX_WIN` | MAX WIN overlay + gold coin rain animation | `ResultScene` overlay |
| `SFX_NEAR_MISS` | Lightning crackle VFX near near-miss symbol positions | `ReelComponent.showNearMiss()` |
| `SFX_REEL_STOP_N` | Reel column physically snaps to stop position | `ReelComponent` |
| `SFX_REEL_EXPAND` | Cloud dissipation effect; reel frame extends downward | `ReelComponent.expandToRows()` |
| `SFX_EXTRA_BET_ON` | EXTRA BET toggle button activates with orange color state | `BetPanelComponent` |
| Error/network state | Offline banner appears in red (`--color-error`) at screen top | `HUDComponent.showOfflineBanner()` |

### 7.4 Volume Controls (Future v1.1)

A dedicated settings panel (planned for v1.1) will expose:
- BGM volume slider (0–100%, maps to `gainNodes.BGM.gain.value` × `config.volume.bgm`).
- SFX volume slider (0–100%, maps to `gainNodes.SFX.gain.value` × `config.volume.sfx`).
- Both sliders persist to `localStorage` and are restored on load.

The `AudioManager.config.volume` fields support these controls natively — no architectural changes are required.

---

*End of AUDIO.md*
