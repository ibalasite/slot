# FRONTEND.md — Frontend Technical Design Document
# Thunder Blessing Slot Game

---

## §0 Document Control

| Field | Content |
|-------|---------|
| **DOC-ID** | FRONTEND-THUNDERBLESSING-20260426 |
| **Product** | Thunder Blessing Slot Game |
| **Version** | v1.0 |
| **Status** | DRAFT |
| **Author** | AI Generated (gendoc D10-FRONTEND) |
| **Date** | 2026-04-26 |
| **Upstream Documents** | IDEA.md, BRD.md, PRD.md, PDD.md v1.0, VDD.md v1.0, EDD.md v1.3, API.md v1.0, SCHEMA.md v1.0 |
| **Reviewers** | Frontend Engineer Lead, QA Lead, Art Director |
| **Approver** | Engineering Lead |

### Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | AI Generated | Initial generation covering all 12 sections |

---

## §1 Overview

### 1.1 Frontend Tech Stack

**Primary Recommendation: Cocos Creator 3.x (TypeScript)**

Cocos Creator 3.x is the primary recommended frontend framework for Thunder Blessing. It provides:
- Native TypeScript support with full type safety
- Integrated Spine 2D runtime (≥ 4.1) for symbol and effect animations
- WebGL 2.0 rendering with fallback to WebGL 1.0
- Built-in scene manager, asset pipeline, and component-based architecture
- Web export targeting HTML5 Canvas / WebGL, optimized for browser delivery
- Physics-based tween system (`cc.tween`) compatible with Cocos Creator 3.x API

**Alternative: PixiJS 7.x (TypeScript)**

PixiJS 7.x is a viable alternative if the team has existing PixiJS expertise:
- WebGL 2.0 rendering via `@pixi/core`
- Spine integration via `pixi-spine` (must target Spine Runtime 4.1)
- Manual scene management required (implement SceneManager as described in §2)
- Use `KawaseBlurFilter` from `@pixi/filter-kawase-blur` for Bloom/Glow effects (referenced in VDD §5.5)
- `gsap` (GreenSock) or `@tweenjs/tween.js` for timeline-based animation sequences

All architecture patterns in this document apply equally to both frameworks. Framework-specific implementation notes are marked with `[Cocos]` or `[PixiJS]` where they diverge.

### 1.2 Architecture Principles

The frontend follows a strict three-layer separation:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Scenes, Components, Animation Queue) │
├─────────────────────────────────────────┤
│         Game Logic Layer                │
│  (State Machine, Win Calculator,       │
│   Animation Sequencer)                 │
├─────────────────────────────────────────┤
│         Network Layer                   │
│  (SpinService, SessionService,         │
│   ConfigService, ErrorHandler)         │
└─────────────────────────────────────────┘
```

**Core architectural rules:**
- The UI is a Pure View: it never calculates win amounts, modifies game state, or computes paylines. All authoritative values come from the backend `FullSpinOutcome` response.
- `totalWin` displayed to the player must always equal `outcome.totalWin` from the API response. The frontend must never derive or adjust this value.
- The entire FG sequence (all rounds, all Cascade steps) is received in a single POST `/v1/spin` response. The client animates the full sequence by consuming the stored `fgRounds` array sequentially — no additional network requests are made during FG playback.
- Game state (Lightning Mark positions, FG multiplier, session status) is owned by the backend. The frontend holds it only transiently for animation playback.

### 1.3 Target Platforms

| Platform | Minimum Requirement |
|----------|-------------------|
| Web (Desktop) | Chrome 90+, Firefox 88+, Safari 14+; WebGL 2.0 preferred; WebGL 1.0 fallback |
| Mobile Web | iOS Safari 14+ (iPhone SE and above); Chrome for Android 90+ |
| Screen resolutions | 320px – 1920px wide; portrait and landscape orientations |

### 1.4 Performance Budget

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Frame rate | 60fps sustained on desktop | Drop gracefully to 30fps on mobile (reduce particles) |
| Initial load time | < 5s on 4G (10 Mbps) | Lazy-load audio; defer non-critical assets |
| Memory footprint | < 300MB total | Object pooling for symbols; single texture atlas |
| API round-trip | POST /v1/spin response received < 2s P95 | Show loading indicator after 500ms |
| JS bundle (gzipped) | < 300KB initial chunk | Dynamic import for FG and Coin Toss modules |
| Texture atlas | Single 2048×2048px atlas for all symbols + UI | Separate atlas for FG-exclusive assets |
| Audio deferred | All audio loaded after first user interaction | Mobile audio unlock pattern (§7.4) |

---

## §2 Scene Architecture

### 2.1 Scene List and Transitions

```
LoadingScene
    │  Config loaded, assets preloaded
    ▼
LobbyScene  ←──────────────────────────────┐
    │  Player selects bet, presses SPIN     │
    ▼                                      │
GameScene  ─── FG exits or session error ──┘
    │
    ▼  (Big Win / Mega Win / Jackpot / Max Win)
ResultScene (overlay within GameScene, not a full scene transition)
```

**Scene transition rules:**
- Scenes never reference each other directly. All transitions go through `SceneManager`.
- `SceneManager` emits typed events that scenes subscribe to; scenes do not hold references to sibling scenes.
- Scene transitions use cross-dissolve (opacity 0→1, 800ms) as defined in VDD §4.6.

### 2.2 Scene Descriptions

#### LoadingScene

**Purpose:** Bootstrap application, load configuration, and preload critical assets.

**Entry actions:**
1. Display loading spinner with Zeus logo on `--color-blue-olympus` background.
2. Call `ConfigService.loadConfig()` → `GET /v1/config`.
3. Preload critical assets: symbol idle textures, HUD atlas, background layer 0 and 1.
4. Preload primary fonts: `Orbitron-Bold.woff2` and `OpenSans-SemiBold.woff2`.

**Exit actions:**
1. Set loading progress bar to 100%.
2. Transition to `LobbyScene` (or directly to `GameScene` if session is active).

**Asset preload manifest (LoadingScene):**
```typescript
const CRITICAL_ASSETS = [
  'symbols/symbol_atlas.png',       // All symbol idle frames
  'ui/ui_hud_atlas.png',            // HUD elements
  'backgrounds/bg_main_sky.png',    // Layer 0 background
  'fonts/Orbitron-Bold.woff2',
  'fonts/OpenSans-SemiBold.woff2',
];
```

#### LobbyScene

**Purpose:** Pre-game configuration UI. Player sets bet level, currency, Extra Bet toggle.

**Entry actions:**
1. Display balance fetched from `GET /v1/session` (or cached from login).
2. Apply bet level limits from `ConfigService.getConfig()`.
3. Enable/disable Buy Feature button based on `config.buyFeatureEnabled`.

**Exit actions:**
1. Store selected `betLevel`, `extraBet`, `currency` in `GameContext` singleton.
2. Transition to `GameScene`.

#### GameScene

**Purpose:** Main game loop. Hosts all game components described in §3.

**Entry actions:**
1. Initialize all components with config and initial state.
2. Restore Lightning Mark positions if reconnecting during FG (from `GET /v1/session`).
3. Set state machine to `IDLE`.

**Exit actions:**
1. Clear `AnimationQueue`.
2. Release object pools.

**Asset preload manifest (GameScene — deferred after LoadingScene completes):**
```typescript
const GAME_ASSETS = [
  'symbols/symbol_wild.spine',
  'symbols/symbol_sc.spine',
  'symbols/symbol_p1.spine',
  'symbols/symbol_p2.spine',
  'symbols/symbol_p3.spine',
  'symbols/symbol_p4.spine',
  'fx/fx_cascade_explode_premium.spine',
  'fx/fx_lightning_mark_appear.spine',
  'fx/fx_thunder_blessing_hit1.spine',
  'fx/fx_thunder_blessing_hit2.spine',
  'fx/fx_coin_toss_flip.spine',
  'backgrounds/bg_main_temple.png',
];
```

#### ResultScene

`ResultScene` is implemented as a full-screen overlay panel within `GameScene`, not a separate Cocos scene. It renders the Big Win / Mega Win / Jackpot / Max Win celebration (PDD §9.1) on top of the frozen reel state. After the celebration completes or the player taps to skip, the overlay is dismissed and the game returns to `IDLE`.

### 2.3 SceneManager Pattern

```typescript
// src/scenes/SceneManager.ts

type SceneId = 'loading' | 'lobby' | 'game';

interface SceneTransition {
  readonly from: SceneId;
  readonly to: SceneId;
  readonly durationMs: number;
}

class SceneManager {
  private static instance: SceneManager;
  private currentScene: SceneId = 'loading';

  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  async transitionTo(target: SceneId, params?: Record<string, unknown>): Promise<void> {
    // Cross-dissolve: fade out current, load next, fade in
    await this.fadeOut(300);
    // [Cocos] cc.director.loadScene(target)
    // [PixiJS] swap stage children
    await this.fadeIn(300);
    this.currentScene = target;
  }

  private fadeOut(ms: number): Promise<void> { /* ... */ return Promise.resolve(); }
  private fadeIn(ms: number): Promise<void> { /* ... */ return Promise.resolve(); }
}
```

---

## §3 Component Architecture

All components follow the principle: **receive data from the state machine, render it, emit events upward**. Components never call the API directly.

### 3.1 ReelComponent

**Responsibilities:**
- Manage 5 reel strips, each containing a column of `SymbolComponent` instances.
- Handle cascade expansion from 3 rows to up to 6 rows, adding new rows below.
- Coordinate symbol fall-down animation when new symbols fill empty positions.
- Emit reel-stop events per reel column in sequence.

**Public interface:**

```typescript
interface ReelComponent {
  // Initialize with config-supplied reel strip data
  initialize(config: ReelConfig): void;

  // Display the initial grid from FullSpinOutcome.initialGrid
  setInitialGrid(grid: SymbolId[][]): void;

  // Animate cascade step: eliminate winning symbols, drop new symbols, expand rows
  playCascadeStep(step: CascadeStep): Promise<void>;

  // Expand reel height to accommodate additional rows (max 6)
  expandToRows(newRowCount: number): Promise<void>;

  // Reset to 3-row state at start of each new spin
  resetToInitialRows(): void;

  // Highlight winning symbol positions during win line display
  highlightPositions(positions: Position[], highlight: boolean): void;

  // Show Near Miss visual effect on specified positions
  showNearMiss(positions: Position[]): void;

  // Events
  onReelStop: EventEmitter<{ reelIndex: number }>;
  onCascadeStepComplete: EventEmitter<{ stepIndex: number }>;
  onExpansionComplete: EventEmitter<{ newRows: number }>;
}

interface ReelConfig {
  readonly reelStrips: SymbolId[][];  // From GET /v1/config
  readonly initialRows: 3;
  readonly maxRows: 6;
  readonly symbolSizePx: number;       // 190px at 1920×1080
  readonly gapPx: number;              // 10px
}
```

**Dependencies:** `SymbolComponent` (pool), `AnimationQueue`, `LightningMarkComponent`.

### 3.2 SymbolComponent

**Responsibilities:**
- Render a single symbol (W, SC, P1–P4, L1–L4) using Spine animation or static texture.
- Switch between animation states: `idle`, `win`, `special`.
- Play cascade elimination animation (shrink + particle burst).
- Support symbol upgrade animation for Thunder Blessing (current symbol → target symbol).

**Public interface:**

```typescript
interface SymbolComponent {
  // Assign symbol type and reset to idle state
  setSymbol(symbolId: SymbolId): void;

  // Play win animation (triggered when this symbol participates in a win line)
  playWin(): Promise<void>;

  // Play special animation (Thunder Blessing upgrade to this symbol)
  playSpecial(): Promise<void>;

  // Play elimination animation (cascade removal)
  playEliminate(): Promise<void>;

  // Upgrade symbol from current to targetSymbol with upgrade animation
  upgradeToSymbol(targetSymbol: SymbolId): Promise<void>;

  // Set visual opacity (dim non-winning symbols during win line display)
  setOpacity(opacity: number): void;

  // Pool lifecycle
  onRecycled(): void;
  onReused(symbolId: SymbolId): void;

  readonly symbolId: SymbolId;
  readonly position: Position;  // { row, col }
}

type SymbolId = 'W' | 'SC' | 'P1' | 'P2' | 'P3' | 'P4' | 'L1' | 'L2' | 'L3' | 'L4';
```

**Pool size:** 30 active symbols (5 cols × 6 rows max) plus 5 buffer for incoming cascade symbols = 35 total.

**Animation durations (per VDD §3.3 and PDD §2):**

| Symbol | Win Duration | Special Duration |
|--------|-------------|-----------------|
| Wild (W) | 1.2s (72 frames@60fps) | 2.5s |
| Scatter (SC) | 1.8s (108 frames@60fps) | 1.5s |
| P1 Zeus | 1.5s | 2.0s |
| P2 Pegasus | 1.3s | 1.8s |
| P3 Athena | 1.2s | 1.8s |
| P4 Eagle | 1.0s | 1.5s |
| L1–L4 | 0.8s | 1.5s |

### 3.3 LightningMarkComponent

**Responsibilities:**
- Track all active Lightning Mark positions on the grid (persists across cascade steps).
- Render gold lightning bolt overlay on each marked position (60% opacity, Additive blend mode).
- Animate mark appearance: `scale 0 → 1.2 → 1.0` in 0.4s with `ease-out-back`.
- Animate mark activation when Thunder Blessing Scatter triggers (all marks pulse, arc lines to SC).
- During FG: marks accumulate across rounds without clearing between spins.
- Clear all marks when: new Main Game spin starts (not in FG); or FG fully completes.

**Public interface:**

```typescript
interface LightningMarkComponent {
  // Add marks at positions from CascadeStep.newLightningMarks
  addMarks(positions: Position[]): Promise<void>;

  // Trigger activation animation (Scatter landed, marks begin to pulse)
  playActivation(): Promise<void>;

  // Animate all marks converting (Thunder Blessing first hit)
  playConversion(targetSymbol: SymbolId): Promise<void>;

  // Clear all marks (new spin in Main Game, or post-FG cleanup)
  clearAllMarks(): void;

  // Restore marks from session data (reconnect flow)
  restoreMarks(positions: Position[]): void;

  // Count of currently active marks (drives counter display)
  readonly activeMarkCount: number;

  // Events
  onMarkAdded: EventEmitter<{ position: Position }>;
  onAllMarksCleared: EventEmitter<void>;
}
```

**Dependencies:** `SymbolComponent` (z-order above symbols, below win lines).

**Lightning mark counter display:** Updates when `activeMarkCount` changes. Counter appearance thresholds (PDD §4.2):
- 1–2 marks: gold, constant.
- 3–4 marks: electric arc flicker, orange-gold.
- 5+ marks: pulsing white-gold, expanded background glow.

### 3.4 ThunderBlessingComponent

**Responsibilities:**
- Orchestrate the two-hit Thunder Blessing upgrade sequence when `thunderBlessingTriggered = true` in `FullSpinOutcome`.
- First hit: all Lightning Mark positions convert to `upgradedSymbol` (from `thunderBlessingResult.convertedSymbol`).
- Second hit (when `thunderBlessingSecondHit = true`): all converted positions upgrade one tier higher per symbol upgrade path.
- Symbol upgrade path: L1/L2/L3/L4 → P4 → P3 → P2 → P1 (direct L-to-P4 with no intermediate step).
- Coordinate with `LightningMarkComponent` and `SymbolComponent` for visual sequence.

**Public interface:**

```typescript
interface ThunderBlessingComponent {
  // Animate full Thunder Blessing sequence from FullSpinOutcome data
  playSequence(params: ThunderBlessingParams): Promise<void>;

  // Events
  onFirstHitComplete: EventEmitter<{ convertedSymbol: SymbolId; positions: Position[] }>;
  onSecondHitComplete: EventEmitter<{ upgradedPositions: Position[] }>;
  onSequenceComplete: EventEmitter<void>;
}

interface ThunderBlessingParams {
  readonly thunderBlessingResult: ThunderBlessingResult;  // From FullSpinOutcome
  readonly thunderBlessingFirstHit: boolean;
  readonly thunderBlessingSecondHit: boolean;
  readonly upgradedSymbol: 'P1' | 'P2' | 'P3' | 'P4';
}

// Mirrors API.md §4 ThunderBlessingResult schema
interface ThunderBlessingResult {
  readonly marksConverted: Position[];
  readonly convertedSymbol: 'P1' | 'P2' | 'P3' | 'P4';
  readonly firstHitApplied: boolean;
  readonly secondHitApplied: boolean;
}
```

**Animation sequence timing (PDD §4.3 and VDD §7.4):**

| Time (from trigger) | Action |
|---------------------|--------|
| 0.0s | SC lands, electric arcs radiate from SC position |
| 0.2s | All Lightning Marks pulse simultaneously, arc lines to SC |
| 0.8s | All marks explode (gold flash), background white flash (0→0.9 opacity, 300ms) |
| 1.2s | Marked positions shatter and reassemble as `convertedSymbol` |
| 1.8s | Converted symbols settle; gold glow persists 0.5s |
| 2.3s (if secondHit) | Second pulse — symbols upgrade one tier per upgrade path |
| 3.0s | Sequence complete, resume cascade evaluation |

### 3.5 CoinTossComponent

**Responsibilities:**
- Display full-screen coin toss overlay when `coinTossTriggered = true`.
- Animate 3D coin flip (Y-axis rotation, 3000–3500ms total per VDD §4.5).
- Display HEADS result ("ZEUS SMILES!" banner) or TAILS result ("NOT THIS TIME").
- Drive FG multiplier progress bar (§6.4 of PDD) showing current stage.
- During FG: toss is shown before each FG round (driven by `fgRounds[i].coinTossResult`).

**Public interface:**

```typescript
interface CoinTossComponent {
  // Show Coin Toss overlay and animate flip to result
  playToss(result: 'HEADS' | 'TAILS', currentMultiplierStage: number): Promise<void>;

  // Update the multiplier progress bar to reflect current FG stage
  updateMultiplierProgress(stage: number): void;

  // Hide the overlay
  hide(): void;

  // Events
  onTossComplete: EventEmitter<{ result: 'HEADS' | 'TAILS' }>;
}
```

**Coin flip animation stages (VDD §4.5):**

| Stage | Duration | Easing |
|-------|----------|--------|
| Coin fly-in (Y: -800px → 0) | 500ms | `ease-out-cubic` |
| Accelerating spin (0° → 2520°, 7 full Y-rotations) | 800ms | `ease-in` |
| Sustained spin (random extra rotations) | 200–700ms (randomized) | `linear` |
| Decelerate to face (HEADS or TAILS) | 1500ms | `ease-coin-decel` (`cubic-bezier(0.05, 0.7, 0.1, 1.0)`) |
| **Total** | **3000–3500ms** | — |

**Multiplier progress bar colors (VDD §4.8):**

| Stage | Multiplier | Heads Probability | Node Color (OKLCH) |
|-------|-----------|------------------|--------------------|
| 1 | ×3 | 80% | `oklch(70% 0.17 142)` (green) |
| 2 | ×7 | 68% | `oklch(80% 0.18 88)` (yellow) |
| 3 | ×17 | 56% | `oklch(72% 0.19 55)` (yellow-orange) |
| 4 | ×27 | 48% | `oklch(68% 0.21 40)` (orange-red) |
| 5 | ×77 | 40% | `oklch(62% 0.22 25)` (deep red) |

### 3.6 FreeGameComponent

**Responsibilities:**
- Display FG overlay/mode UI: FG banner, current multiplier display, spin counter.
- Show FG Bonus multiplier reveal animation (×1/×5/×20/×100) from `fgBonusMultiplier`.
- Orchestrate FG round playback from `fgRounds` array in sequence.
- Display FG total win summary when all rounds complete.
- Handle scene background switch to "Sky Temple" (night scene) during FG.

**Public interface:**

```typescript
interface FreeGameComponent {
  // Enter FG mode: show banner, reveal bonus multiplier, start rounds
  enterFreeGame(params: FGEntryParams): Promise<void>;

  // Play a single FG round (drives reel + cascade animation for that round)
  playFGRound(round: FGRound, roundIndex: number): Promise<void>;

  // Show FG complete summary with total win
  showFGComplete(totalFGWin: number, fgMultiplier: number, bonusMultiplier: number): Promise<void>;

  // Exit FG mode (restore main game scene)
  exitFreeGame(): Promise<void>;

  // Update spin counter display
  updateSpinCounter(currentRound: number, isFinal: boolean): void;

  // Events
  onFGComplete: EventEmitter<{ totalFGWin: number }>;
}

interface FGEntryParams {
  readonly fgBonusMultiplier: 1 | 5 | 20 | 100;  // From FullSpinOutcome.fgBonusMultiplier
  readonly initialMultiplier: 3;
  // Individual FG rounds are enqueued as separate FG_ROUND steps in AnimationQueue —
  // FGEntryParams only covers the entry phase (multiplier reveal + fanfare + background switch).
}
```

**FG Bonus Multiplier reveal animation (PDD §7.4):**
- ×1: standard reveal, no fanfare.
- ×5: moderate gold particle burst.
- ×20: large particle burst + banner.
- ×100: full-screen gold explosion (3000+ particles desktop, 800+ mobile), `×100 BONUS!` text with SFX.

### 3.7 BetPanelComponent

**Responsibilities:**
- Display and control bet level selector (betLevel 1–20 for USD, 1–320 for TWD).
- Control Extra Bet toggle ON/OFF (updates displayed total bet = baseBet × 3 when ON).
- Display Buy Feature button with cost label (100× baseBet normal; 300× baseBet if Extra Bet ON).
- Lock bet changes during spin / FG.
- Read all limits from `ConfigService` — never hardcode bet ranges.

**Public interface:**

```typescript
interface BetPanelComponent {
  // Initialize with config-derived bet levels and currency
  initialize(config: BetConfig): void;

  // Lock/unlock bet controls
  setLocked(locked: boolean): void;

  // Sync Extra Bet toggle state
  setExtraBet(active: boolean): void;

  // Show Buy Feature button with computed cost label
  setBuyFeatureEnabled(enabled: boolean, cost: number): void;

  // Events
  onBetLevelChanged: EventEmitter<{ betLevel: number }>;
  onExtraBetToggled: EventEmitter<{ active: boolean }>;
  onBuyFeatureClicked: EventEmitter<void>;
  onSpinClicked: EventEmitter<void>;
}

interface BetConfig {
  readonly levels: BetLevel[];  // From GET /v1/config
  readonly extraBetEnabled: boolean;
  readonly buyFeatureEnabled: boolean;
  readonly currency: 'USD' | 'TWD';
}
```

### 3.8 BalanceComponent

**Responsibilities:**
- Display player balance from `FullSpinOutcome.newBalance` (post-spin).
- Display current round WIN value, rolling up from 0 to `totalWin` during cascade animation.
- Win roll-up algorithm: exponential decay (`(target - current) × 0.15` per frame) for 200ms–5000ms depending on win size (VDD §4.7).
- Large wins (≥ 20× baseBet): trigger win tier banner overlay (Big Win, Mega Win, Jackpot, Max Win).

**Public interface:**

```typescript
interface BalanceComponent {
  // Update balance display immediately (no animation)
  setBalance(amount: number, currency: 'USD' | 'TWD'): void;

  // Animate WIN counter rolling up from current to targetWin
  animateWin(targetWin: number, durationMs: number): Promise<void>;

  // Reset WIN display to 0 at start of new spin
  resetWin(): void;

  // Show Big Win / Mega Win overlay based on win tier
  showWinTier(winAmount: number, baseBet: number): Promise<void>;

  // Events
  onWinAnimationComplete: EventEmitter<{ finalWin: number }>;
}
```

**Win tier thresholds (PDD §9.1):**

| Tier | Condition | Duration |
|------|-----------|---------|
| Small Win | 0 < win < 5× baseBet | auto |
| Medium Win | 5× ≤ win < 20× baseBet | 1.5s |
| Big Win | 20× ≤ win < 100× baseBet | 3.0s |
| Mega Win | 100× ≤ win < 500× baseBet | 4.0s |
| Jackpot | win ≥ 500× baseBet | 5.0s |
| Max Win (30,000×) | win at Main Game cap | 6.0s |
| Max Win (90,000×) | win at Extra Bet + Buy FG cap | 10s+ |

### 3.9 HUDComponent

**Responsibilities:**
- Render top toolbar: INFO, SOUND, LINES display, SETTINGS.
- Render FREE letter progress indicator (F-R-E-E) — each letter lights up on each successive cascade expansion.
- Update LINES count dynamically as rows expand (25 → 33 → 45 → 57, driven by `cascadeSequence.steps[i].rows`).
- Manage sound toggle state and call `AudioManager.setMuted()`.
- Open Info panel (static 57-line payline diagram).

**Public interface:**

```typescript
interface HUDComponent {
  // Update FREE letter progress (lit count = cascade expansion count, 0-4)
  setFreeLetterProgress(litCount: number): void;

  // Update LINES counter
  setActiveLines(lineCount: number): void;

  // Toggle sound mute state
  setSoundMuted(muted: boolean): void;

  // Show/hide loading indicator (during API call)
  setLoading(loading: boolean): void;

  // Events
  onInfoClicked: EventEmitter<void>;
  onSoundToggled: EventEmitter<{ muted: boolean }>;
  onSettingsClicked: EventEmitter<void>;
}
```

**FREE letter lit rules (PDD §5.3):**

| Cascade Count | Lit Letters | Row Count |
|:-------------:|:-----------:|:---------:|
| 0 | none | 3 |
| 1 | F | 4 |
| 2 | F, R | 5 |
| 3 | F, R, E | 6 (partial) |
| 4+ | F, R, E, E (all) | 6 (full) |

---

## §4 Game Flow State Machine

### 4.1 State Definitions

```typescript
enum GameState {
  IDLE             = 'IDLE',
  SPINNING         = 'SPINNING',
  CASCADE_RESOLVING = 'CASCADE_RESOLVING',
  THUNDER_BLESSING = 'THUNDER_BLESSING',
  COIN_TOSS        = 'COIN_TOSS',
  FREE_GAME        = 'FREE_GAME',
  RESULT_DISPLAY   = 'RESULT_DISPLAY',
  NETWORK_ERROR    = 'NETWORK_ERROR',
  TIMEOUT_RETRY    = 'TIMEOUT_RETRY',
  SESSION_RECONNECT = 'SESSION_RECONNECT',
}
```

### 4.2 Main State Machine Transition Table

| Current State | Event | Next State | Actions |
|---------------|-------|------------|---------|
| `IDLE` | `SPIN_PRESSED` | `SPINNING` | Lock UI; call `SpinService.spin()`; show loading indicator after 500ms |
| `SPINNING` | `SPIN_RESPONSE_OK` | `CASCADE_RESOLVING` | Store `FullSpinOutcome`; set initial grid; hide loading indicator |
| `SPINNING` | `SPIN_RESPONSE_ERROR` | `NETWORK_ERROR` | Unlock UI; display error |
| `SPINNING` | `SPIN_TIMEOUT` | `TIMEOUT_RETRY` | Increment retry count |
| `CASCADE_RESOLVING` | `NEXT_CASCADE_STEP` | `CASCADE_RESOLVING` | Play `AnimationQueue.dequeue()` step |
| `CASCADE_RESOLVING` | `TB_TRIGGERED` | `THUNDER_BLESSING` | After current step completes |
| `CASCADE_RESOLVING` | `CASCADE_COMPLETE_COIN_TOSS` | `COIN_TOSS` | All steps done; `coinTossTriggered = true` |
| `CASCADE_RESOLVING` | `CASCADE_COMPLETE_NO_WIN` | `RESULT_DISPLAY` | `totalWin = 0` |
| `CASCADE_RESOLVING` | `CASCADE_COMPLETE_WIN` | `RESULT_DISPLAY` | `totalWin > 0`; animate win counter |
| `THUNDER_BLESSING` | `TB_SEQUENCE_COMPLETE` | `CASCADE_RESOLVING` | Resume cascade evaluation |
| `COIN_TOSS` | `COIN_TOSS_HEADS_FG` | `FREE_GAME` | `fgTriggered = true` |
| `COIN_TOSS` | `COIN_TOSS_TAILS` | `RESULT_DISPLAY` | FG not triggered |
| `FREE_GAME` | `FG_ROUND_START` | `FREE_GAME` | Play `fgRounds[currentRound]` |
| `FREE_GAME` | `FG_ROUND_COMPLETE_HEADS` | `FREE_GAME` | Advance multiplier; start next round |
| `FREE_GAME` | `FG_ROUND_COMPLETE_TAILS` | `RESULT_DISPLAY` | FG sequence ended |
| `RESULT_DISPLAY` | `RESULT_DISMISSED` | `IDLE` | Reset grid; clear marks (if not FG); enable SPIN |
| `NETWORK_ERROR` | `RETRY_CLICKED` | `IDLE` | Reset state |
| `TIMEOUT_RETRY` | `RETRY_COUNT_OK` | `SPINNING` | Retry API call |
| `TIMEOUT_RETRY` | `RETRY_COUNT_EXCEEDED` | `NETWORK_ERROR` | Max 3 retries exhausted |
| `SESSION_RECONNECT` | `SESSION_RESTORED_FG` | `FREE_GAME` | Replay from stored FG position |
| `SESSION_RECONNECT` | `SESSION_RESTORED_IDLE` | `IDLE` | No active FG |
| `SESSION_RECONNECT` | `SESSION_EXPIRED` | `IDLE` | Show "Session Expired" dialog |
| Any | `NETWORK_OFFLINE` | `NETWORK_ERROR` | Show offline banner; disable SPIN; wait for connectivity restore |

### 4.3 State Entry and Exit Actions

#### IDLE
- **Entry:** Enable SPIN button; clear WIN display; reset FREE letter progress (if not in FG).
- **Exit:** Disable SPIN button; lock bet panel.

#### SPINNING
- **Entry:** Call `SpinService.spin(request)`; start 500ms timeout before showing loading indicator.
- **Exit:** Store `FullSpinOutcome` in `GameContext.currentOutcome`; build `AnimationQueue`.

#### CASCADE_RESOLVING
- **Entry:** Initialize cascade step iterator from `cascadeSequence.steps`.
- **Per-step:** Dequeue next `CascadeStep` from `AnimationQueue`; play it; update LINES counter from `step.rows`; update FREE letters.
- **Exit (to THUNDER_BLESSING):** Only when `thunderBlessingTriggered = true` detected in step.
- **Exit (to COIN_TOSS):** When all cascade steps consumed and `coinTossTriggered = true`.

#### THUNDER_BLESSING
- **Entry:** Call `ThunderBlessingComponent.playSequence()` with `thunderBlessingResult`.
- **Exit:** Return to `CASCADE_RESOLVING` to process any win lines generated by upgraded symbols.

#### COIN_TOSS
- **Entry:** Show `CoinTossComponent` overlay; spotlight effect.
- **Exit:** Either enter `FREE_GAME` (HEADS + `fgTriggered = true`) or `RESULT_DISPLAY` (TAILS).

#### FREE_GAME
- **Entry:** Call `FreeGameComponent.enterFreeGame()` with `{ fgBonusMultiplier, initialMultiplier }`. FG rounds are handled as separate FG_ROUND animation steps in the AnimationQueue — not passed to enterFreeGame.
- **Per-round:** Call `FreeGameComponent.playFGRound(fgRounds[i], i)`.
- **Exit:** Call `FreeGameComponent.exitFreeGame()`; clear Lightning Marks; transition to `RESULT_DISPLAY`.

#### NETWORK_ERROR
- **Entry:** Display offline indicator UI; show error code (if `RATE_LIMITED`, show cooldown timer from `retryAfter`).
- **Exit:** User dismisses error; reset to `IDLE`.

#### TIMEOUT_RETRY
- **Entry:** Increment `retryCount`; wait `Math.pow(2, retryCount - 1)` seconds (1s, 2s, 4s).
- **Exit:** If `retryCount <= 3` retry spin; else enter `NETWORK_ERROR`.

### 4.4 FG Sub-State Detail

During `FREE_GAME`, the internal sub-state sequence per round is:

```
FG_ENTRY (bonus multiplier reveal)
    │
    ▼
FG_COIN_TOSS_PRE_ROUND (show Coin Toss for this round)
    │
    ├── TAILS ──────────────────────────────► FG_RESULT (final summary)
    │
    └── HEADS ──► FG_SPINNING (play round cascade from fgRounds[i])
                        │
                        ▼
                  FG_CASCADE (process CascadeSteps in fgRounds[i].cascadeSequence)
                        │
                        ▼
                  (loop back to FG_COIN_TOSS_PRE_ROUND for next round)
```

**Key rules:**
- `fgRounds[i].multiplier` sets the active multiplier for that round's win calculation display.
- `fgRounds[i].roundWin` is the raw win (before multiplier) displayed during the round.
- `fgRounds[i].coinTossResult === 'TAILS'` terminates the FG loop.
- Lightning Marks from `lightningMarksBefore`/`lightningMarksAfter` track cumulative marks per round.

---

## §5 API Integration Layer

### 5.1 SpinService

**Responsibility:** Execute POST `/v1/spin` and return a typed `FullSpinOutcome`.

```typescript
// src/services/SpinService.ts

interface SpinRequest {
  readonly playerId: string;        // UUID from JWT sub claim
  readonly sessionId: string | null;
  readonly betLevel: number;
  readonly currency: 'USD' | 'TWD';
  readonly extraBet: boolean;
  readonly buyFeature: boolean;
}

interface SpinResponse {
  readonly success: true;
  readonly requestId: string;
  readonly timestamp: string;
  readonly data: FullSpinOutcome;
}

class SpinService {
  private readonly BASE_URL = '/v1';
  private readonly TIMEOUT_MS = 10_000;

  async spin(request: SpinRequest): Promise<FullSpinOutcome> {
    const response = await this.fetchWithTimeout(
      `${this.BASE_URL}/spin`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokenStore.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      this.TIMEOUT_MS,
    );
    if (!response.ok) {
      throw await this.parseErrorResponse(response);
    }
    const json: SpinResponse = await response.json();
    return json.data;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  private async parseErrorResponse(response: Response): Promise<GameError> {
    const body = await response.json().catch(() => ({}));
    return new GameError(body.code ?? 'INTERNAL_ERROR', body.message ?? 'Unknown error', response.status);
  }
}
```

### 5.2 SessionService

**Responsibility:** Execute `GET /v1/session/:sessionId` for reconnect flow.

```typescript
// src/services/SessionService.ts

interface SessionData {
  readonly sessionId: string;
  readonly playerId: string;
  readonly status: 'SPINNING' | 'FG_ACTIVE' | 'COMPLETE';
  readonly fgMultiplier: 3 | 7 | 17 | 27 | 77 | null;
  readonly fgRound: number;
  // 0 when FG not active (status ≠ FG_ACTIVE); ≥1 when FG is active (1-indexed round in progress)
  // i.e., fgRound=1 means round 1 is upcoming, fgRound=2 means round 2 is upcoming, etc.
  readonly lightningMarks: LightningMarkSet;  // Persisted Lightning Mark positions
  readonly currency: 'USD' | 'TWD';
  readonly baseBet: number;
  readonly extraBet: boolean;
  readonly buyFeature: boolean;
  readonly fgBonusMultiplier: 1 | 5 | 20 | 100 | null;
  readonly totalFGWin: number;
  readonly floorValue: number | null;
  readonly completedRounds: FGRound[];
  readonly remainingMaxRounds: number;
  readonly ttlSeconds: number;
}

class SessionService {
  async getSession(sessionId: string): Promise<SessionData> {
    const response = await fetch(`/v1/session/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${this.tokenStore.getToken()}` },
    });
    if (response.status === 404) {
      throw new GameError('SESSION_NOT_FOUND', 'Session expired or not found', 404);
    }
    if (!response.ok) {
      throw await this.parseError(response);
    }
    const json = await response.json();
    return json.data;
  }
}
```

**Reconnect protocol:**
1. On app resume (visibility change to `visible`), call `SessionService.getSession(storedSessionId)`.
2. If `status === 'FG_ACTIVE'`: enter `SESSION_RECONNECT` state; restore Lightning Marks from `lightningMarks.positions`; call `LightningMarkComponent.restoreMarks(session.lightningMarks.positions)`; resume FG from `fgRound` index (if `session.fgRound >= 1`, FG is active from that round onward).
3. If `status === 'SPINNING'` or `status === 'COMPLETE'`: return to `IDLE` state normally.
4. If `SESSION_NOT_FOUND` (404): show "Session Expired" dialog; return to `IDLE`.

### 5.3 ConfigService

**Responsibility:** Load and cache game configuration from `GET /v1/config` at startup.

```typescript
// src/services/ConfigService.ts

interface GameConfig {
  readonly betLevels: BetLevel[];
  readonly reelStrips: SymbolId[][];    // Symbol sequences per reel
  readonly paytable: PaytableEntry[];   // Symbol win multipliers
  readonly extraBetEnabled: boolean;
  readonly buyFeatureEnabled: boolean;
  readonly maxWinMultiplier: number;    // 30000 (Main Game) or 90000 (Extra Bet + Buy FG)
  readonly fgMults: [3, 7, 17, 27, 77];
  readonly coinProbs: [0.80, 0.68, 0.56, 0.48, 0.40];
}

class ConfigService {
  private cachedConfig: GameConfig | null = null;

  async loadConfig(): Promise<GameConfig> {
    if (this.cachedConfig) return this.cachedConfig;
    const response = await fetch('/v1/config', {
      headers: { 'Authorization': `Bearer ${this.tokenStore.getToken()}` },
    });
    if (!response.ok) throw new Error('Failed to load game config');
    const json = await response.json();
    this.cachedConfig = json.data;
    return this.cachedConfig!;
  }

  getConfig(): GameConfig {
    if (!this.cachedConfig) throw new Error('Config not loaded');
    return this.cachedConfig;
  }
}
```

**Config is loaded once at startup (LoadingScene). It is never refetched during gameplay unless the user explicitly refreshes the page.**

### 5.4 Request Lifecycle

```
Player presses SPIN
    │
    ▼
BetPanelComponent.onSpinClicked (emits event)
    │
    ▼
GameStateMachine.handleSpinPressed()
    ├── Lock UI (BetPanelComponent.setLocked(true))
    ├── Set state = SPINNING
    └── SpinService.spin(request)
             │
             ├── (> 500ms elapsed) → show loading indicator (HUDComponent.setLoading(true))
             │
             ├── Success (200 OK)
             │    └── Store outcome in GameContext
             │         ├── HUDComponent.setLoading(false)
             │         ├── AnimationQueue.build(outcome.cascadeSequence.steps)
             │         └── State transition → CASCADE_RESOLVING
             │
             ├── Rate Limited (429)
             │    └── State = NETWORK_ERROR; show cooldown timer from retryAfter field
             │
             ├── Service Unavailable (503/504)
             │    └── State = TIMEOUT_RETRY (max 3 retries)
             │
             └── Validation Error (422)
                  └── State = NETWORK_ERROR; show user-friendly error message
```

### 5.5 Error Handling Matrix

| HTTP Status | Error Code | Frontend Action |
|-------------|-----------|----------------|
| 400 | `INSUFFICIENT_FUNDS` | Show "Insufficient balance" dialog; unlock UI; return to IDLE |
| 400 | `INVALID_BET_LEVEL` | Should not occur if ConfigService is respected; log error; return to IDLE |
| 400 | `INVALID_CURRENCY` | Should not occur; log error; return to IDLE |
| 400 | `BUY_FEATURE_NOT_ALLOWED` | Show 'Buy Feature unavailable at current configuration' dialog; unlock UI; transition to IDLE state |
| 401 | `UNAUTHORIZED` | Trigger token refresh via Supabase SDK; retry once; else redirect to login |
| 403 | `FORBIDDEN` | Show "Account suspended" dialog; disable SPIN permanently |
| 409 | `SPIN_IN_PROGRESS` | Show brief "Please wait" message; do not retry automatically — wait for player to re-submit |
| 422 | `VALIDATION_ERROR` | Show "Feature unavailable" dialog; return to IDLE |
| 429 | `RATE_LIMITED` | Show cooldown timer from `retryAfter` field; auto-enable SPIN after timer |
| 500 | `INTERNAL_ERROR` | Show generic error dialog; offer retry (max 3 attempts) |
| 503 | `SERVICE_UNAVAILABLE` | Show "Service temporarily unavailable" with retry after `retryAfter` seconds |
| 504 | `ENGINE_TIMEOUT` | Show "Connection timeout" with note "Bet has been refunded"; return to IDLE |
| Network timeout | — | Enter `TIMEOUT_RETRY` state; exponential backoff (1s, 2s, 4s) |

---

## §6 Animation Playback Engine

### 6.1 AnimationQueue

The `AnimationQueue` is the central animation sequencer. It receives the complete `FullSpinOutcome` after a successful spin response and drives all subsequent animations in the correct order. No animation is played ad-hoc — everything goes through the queue.

```typescript
// src/animation/AnimationQueue.ts

type AnimationStep =
  | { type: 'CASCADE_STEP'; data: CascadeStep }
  | { type: 'THUNDER_BLESSING'; data: ThunderBlessingParams }
  | { type: 'COIN_TOSS'; data: { result: 'HEADS' | 'TAILS'; stage: number } }
  | { type: 'FG_ENTRY'; data: FGEntryParams }
  | { type: 'FG_ROUND'; data: { round: FGRound; index: number } }
  | { type: 'FG_COMPLETE'; data: { totalFGWin: number; fgMultiplier: number; bonusMultiplier: number } }
  | { type: 'WIN_DISPLAY'; data: { totalWin: number; baseBet: number } }
  | { type: 'NEAR_MISS'; data: { positions: Position[] } };

class AnimationQueue {
  private queue: AnimationStep[] = [];
  private isPlaying = false;

  // Build queue from complete FullSpinOutcome
  build(outcome: FullSpinOutcome): void {
    this.queue = [];

    // Near miss (if applicable) — plays before cascade
    if (outcome.nearMissApplied) {
      this.queue.push({ type: 'NEAR_MISS', data: { positions: this.getNearMissPositions(outcome) } });
    }

    // Cascade steps
    for (const step of outcome.cascadeSequence.steps) {
      this.queue.push({ type: 'CASCADE_STEP', data: step });
    }

    // Thunder Blessing sequence (after cascade steps that triggered it)
    if (outcome.thunderBlessingTriggered) {
      this.queue.push({
        type: 'THUNDER_BLESSING',
        data: {
          thunderBlessingResult: outcome.thunderBlessingResult!,
          thunderBlessingFirstHit: outcome.thunderBlessingFirstHit,
          thunderBlessingSecondHit: outcome.thunderBlessingSecondHit,
          upgradedSymbol: outcome.upgradedSymbol!,
        },
      });
    }

    // Coin Toss
    if (outcome.coinTossTriggered) {
      this.queue.push({
        type: 'COIN_TOSS',
        data: { result: outcome.coinTossResult!, stage: 0 },
      });
    }

    // Free Game sequence
    if (outcome.fgTriggered) {
      this.queue.push({
        type: 'FG_ENTRY',
        data: {
          fgBonusMultiplier: outcome.fgBonusMultiplier!,
          initialMultiplier: 3,
        },
      });
      for (let i = 0; i < outcome.fgRounds.length; i++) {
        this.queue.push({ type: 'FG_ROUND', data: { round: outcome.fgRounds[i], index: i } });
      }
      this.queue.push({
        type: 'FG_COMPLETE',
        data: {
          totalFGWin: outcome.totalFGWin!,
          fgMultiplier: outcome.fgMultiplier!,
          bonusMultiplier: outcome.fgBonusMultiplier!,
        },
      });
    }

    // Final win display
    if (outcome.totalWin > 0) {
      this.queue.push({ type: 'WIN_DISPLAY', data: { totalWin: outcome.totalWin, baseBet: outcome.baseBet } });
    }
  }

  async play(dispatcher: AnimationDispatcher): Promise<void> {
    this.isPlaying = true;
    for (const step of this.queue) {
      await dispatcher.dispatch(step);
    }
    this.isPlaying = false;
    this.queue = [];
  }

  clear(): void {
    this.queue = [];
    this.isPlaying = false;
  }
}
```

### 6.2 CascadeStep Animation Sequence

Each `CascadeStep` from `cascadeSequence.steps` drives the following sequential animation:

```
1. SYMBOL WIN ANIMATION (parallel, all positions in step.winLines simultaneously)
   └── Each winning SymbolComponent.playWin() → duration varies by symbol type (0.8s–1.8s)

2. WIN LINE HIGHLIGHT (concurrent with win animation)
   └── Draw gold path lines on winning paylines
   └── Dim non-winning symbols to opacity 0.5

3. WIN COUNTER UPDATE
   └── BalanceComponent.animateWin(step.stepWin) — rolling increment

4. ELIMINATION ANIMATION (after win animation completes)
   └── Each winning SymbolComponent.playEliminate() → 500ms
   └── Particle burst (碎片飛散): 12–16 fragments per symbol, 400ms

5. LIGHTNING MARK APPEARANCE (concurrent with elimination)
   └── LightningMarkComponent.addMarks(step.newLightningMarks) → 400ms
   └── Counter display updates

6. REEL EXPANSION (if step.rows > previous rows)
   └── ReelComponent.expandToRows(step.rows) → 300ms frame extend
   └── Cloud dissipation effect → 250ms
   └── New row fade-in → 300ms
   └── FREE letter lights up → 200ms

7. NEW SYMBOL FALL (fills empty positions + any new row positions)
   └── Staggered by column×20ms + row×30ms (VDD §4.2)
   └── Each symbol: translateY -200px → 0 in 420ms (ease-out-bounce)
   └── Landing bounce: scale 1.0→1.05→1.0 in 150ms
```

**Total typical cascade step duration:** 1.5s – 2.5s depending on symbol count.

### 6.3 Lightning Mark Animation

| Event | Animation |
|-------|-----------|
| Mark appears (post-elimination) | Scale 0→1.2→1.0 in 400ms, ease-out-back. Gold arc particles (6–12) drift upward. |
| Marks persist on screen | Continuous low-intensity electric arc particle emission (Additive blend). |
| Scatter lands (activation) | All marks pulse simultaneously; thin arc lines from SC → each mark (Bezier curve, blue-white). |
| SC triggers first hit | All marks explode (80–120 particles each); background white flash (0→0.9 in 300ms). |
| Marks convert to symbol | Shatter animation → reassemble as `convertedSymbol` (SymbolComponent.upgradeToSymbol). |
| FG cross-round persistence | Marks from `fgRounds[i].lightningMarksBefore` restore at start of each FG round. |

### 6.4 ThunderBlessing Sequence Detail

The full Thunder Blessing animation sequence is driven by `ThunderBlessingComponent.playSequence()`:

```
t=0.0s  SC symbol win animation (playWin → 1.8s)
t=0.2s  All marks pulse (brightness 1→2→1, 300ms loop)
        Arc lines SC → each mark (thin, blue-white, Additive)
t=0.8s  All marks explode simultaneously
        Background white flash (opacity 0→0.9→0, 300ms)
        fx_thunder_blessing_hit1.spine plays on center of reel
t=1.2s  Marked positions: current symbol shatters (playEliminate variant)
t=1.5s  Target symbol assembles at each position (SymbolComponent.upgradeToSymbol)
        Whole reel gold glow (filter: sepia(0.3) brightness(1.4))
t=1.8s  Gold glow fades out
--- if thunderBlessingSecondHit === true ---
t=2.3s  Second pulse (white flash opacity 0→0.6→0, 300ms)
        fx_thunder_blessing_hit2.spine plays
        Each converted symbol upgrades one tier (upgrade path animation)
t=3.0s  All animations settle; resume cascade evaluation
```

### 6.5 Coin Toss Animation

Driven by `CoinTossComponent.playToss(result, stage)`:

1. **Stage setup (0–500ms):** Backdrop darkens (opacity 0→0.7), spotlight cone appears, coin flies in from top (`translateY -800px→0`, ease-out-cubic, 500ms).
2. **Spin phase (500–1300ms):** Y-axis rotation accelerates (ease-in, 7 full rotations in 800ms).
3. **Sustained phase (1300–2000ms):** Linear spin for 200–700ms (randomized to create suspense).
4. **Deceleration (2000–3500ms):** Coin decelerates to face matching result (ease-coin-decel, 1500ms). HEADS face = Zeus portrait; TAILS face = lightning bolt.
5. **Result (3500ms+):**
   - HEADS: Gold burst particles (scale 1.0→1.3→1.0, ease-out-back, 600ms); "ZEUS SMILES!" banner.
   - TAILS: Brightness 1.0→0.6 (ease-in-out-cubic, 400ms); "NOT THIS TIME" silver text.
6. **Multiplier progress bar:** On HEADS, animate progress line from current node to next node (500ms, ease-in-out-cubic).

### 6.6 FG Sequence Animation

Driven by `FreeGameComponent`:

1. **FG Entry (cross-dissolve 800ms):** Scene transitions to Sky Temple background (night, starfield particles).
2. **FG Bonus Reveal (always shown):** Banner from top reveals the bonus multiplier ("×1 BONUS", "×5 BONUS!", "×20 BONUS!", "×100 BONUS!" etc.) before the first FG round begins. ×1 shows a standard reveal animation with no particle fanfare; higher values add proportionally larger particle bursts.
3. **Per-round loop:** For each `FGRound` in `fgRounds`:
   a. Show pre-round Coin Toss (CoinTossComponent.playToss).
   b. If TAILS: skip to FG summary.
   c. If HEADS: update multiplier display (old number explodes, new number scales in from center, 2s).
   d. Play `round.cascadeSequence` through `AnimationQueue` (same cascade step logic as §6.2).
   e. Update spin counter display.
4. **FG Complete:** Summary panel shows total FG win, final multiplier, bonus multiplier. Win roll-up to `totalFGWin × fgMultiplier × bonusMultiplier`.

**Animation time budget:**
- Base spin typical: ≤ 8s total (initial grid stop + cascade steps).
- FG sequence: ≤ 30s for 5 rounds (assuming modest cascades per round).
- Single FG round (no cascade): ~5s (coin toss 3.5s + grid stop 1.5s).

### 6.7 Win Roll-Up Algorithm

```typescript
// src/animation/WinRollup.ts

function animateWinRollup(
  startValue: number,
  targetValue: number,
  onUpdate: (current: number) => void,
  onComplete: () => void,
): void {
  const maxDurationMs = Math.min((targetValue - startValue) / 50, 5000);
  const minDurationMs = 200;
  const durationMs = Math.max(maxDurationMs, minDurationMs);

  let current = startValue;
  let startTime: number | null = null;

  function frame(timestamp: number): void {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / durationMs, 1);

    // Exponential decay: each frame closes 15% of remaining gap
    current += (targetValue - current) * 0.15;

    // Clamp to target on final frame
    if (progress >= 1) current = targetValue;

    onUpdate(Math.floor(current * 100) / 100);  // 2 decimal places

    if (current < targetValue) {
      requestAnimationFrame(frame);
    } else {
      // Landing bounce: scale 1.0→1.08→1.0, 200ms, ease-out-back
      onComplete();
    }
  }

  requestAnimationFrame(frame);
}
```

---

## §7 Audio System

### 7.1 AudioManager

Singleton responsible for all audio playback, preloading, and state management.

```typescript
// src/audio/AudioManager.ts

type SoundCategory = 'BGM' | 'SFX';

interface AudioConfig {
  readonly volume: { bgm: number; sfx: number };  // 0.0–1.0
  readonly muted: boolean;
}

class AudioManager {
  private static instance: AudioManager;
  private context: AudioContext | null = null;
  private bgmNode: AudioBufferSourceNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private muted = false;
  private config: AudioConfig = { volume: { bgm: 1.0, sfx: 1.0 }, muted: false };

  // Per-category gain nodes — BGM and SFX are routed through independent gain nodes
  // so volume and mute can be applied per-category without disconnecting sources.
  private gainNodes!: Record<SoundCategory, GainNode>;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  // Must be called from a user gesture handler (mobile unlock)
  async unlock(): Promise<void> {
    if (this.context) return;
    this.context = new AudioContext();
    // Initialize per-category gain nodes after context is created
    this.gainNodes = {
      BGM: this.context.createGain(),
      SFX: this.context.createGain(),
    };
    this.gainNodes.BGM.gain.value = this.config.volume.bgm;
    this.gainNodes.SFX.gain.value = this.config.volume.sfx;
    this.gainNodes.BGM.connect(this.context.destination);
    this.gainNodes.SFX.connect(this.context.destination);
    await this.context.resume();
  }

  async preload(soundId: string, url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
    this.sounds.set(soundId, audioBuffer);
  }

  play(soundId: string, category: SoundCategory = 'SFX', loop = false): void {
    if (this.muted) return;
    const buffer = this.sounds.get(soundId);
    if (!buffer || !this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    // Route through category gain node (not directly to destination)
    source.connect(this.gainNodes[category]);
    // Track BGM node so setMuted() and crossfadeBGM() can control it
    if (loop) {
      this.bgmNode?.stop();
      this.bgmNode = source;
    }
    source.start();
  }

  async crossfadeBGM(newSoundId: string, durationMs = 1000): Promise<void> {
    const oldNode = this.bgmNode;
    // play() assigns this.bgmNode to the new source via the loop=true branch
    await this.play(newSoundId, 'BGM', true);
    // Fade out old node over durationMs (ramp gain to 0, then stop)
    if (oldNode) setTimeout(() => oldNode.stop(), durationMs);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    // Mute/unmute all categories via their gain nodes (avoids disconnect/reconnect churn)
    if (this.gainNodes) {
      this.gainNodes.BGM.gain.value = muted ? 0 : this.config.volume.bgm;
      this.gainNodes.SFX.gain.value = muted ? 0 : this.config.volume.sfx;
    }
  }
}
```

### 7.2 Sound Categories and IDs

**Background Music (BGM):**

| Sound ID | Trigger | Description |
|----------|---------|-------------|
| `BGM_MAIN` | GameScene entry | Greek myth epic ambient, moderate intensity |
| `BGM_ANTICIPATION` | All 4 FREE letters lit | Rising tension, drums enter |
| `BGM_COIN_TOSS` | Coin Toss overlay opens | Suspense music, minimal |
| `BGM_FREE_GAME` | FG entry | Victory epic theme, higher energy than BGM_MAIN |
| `BGM_77X` | ×77 multiplier reached | Maximum intensity, electronic elements added |

**Sound Effects (SFX):**

| Sound ID | Trigger | Timing |
|----------|---------|--------|
| `SFX_SPIN_START` | SPIN pressed | Immediate on button press |
| `SFX_REEL_STOP_1` – `SFX_REEL_STOP_5` | Each reel column stops | Staggered 120ms apart |
| `SFX_WIN_SMALL` | Small win (< 5×) | On WIN counter start |
| `SFX_WIN_MEDIUM` | Medium win (5–20×) | On WIN counter start |
| `SFX_WIN_BIG` | Big win (20–100×) | On "BIG WIN" banner drop |
| `SFX_WIN_MEGA` | Mega win (100–500×) | On "MEGA WIN" effect |
| `SFX_WIN_JACKPOT` | Jackpot (500×+) | On Zeus character animation |
| `SFX_CASCADE_EXPLODE` | Symbol eliminated | Sync with elimination animation start |
| `SFX_CASCADE_DROP` | Symbol lands | Sync with landing bounce |
| `SFX_REEL_EXPAND` | Row count increases | Cloud dissipation start |
| `SFX_FREE_LETTER` | Single FREE letter lights up | Letter glow peak |
| `SFX_LIGHTNING_MARK` | Mark appears | Mark scale-in midpoint |
| `SFX_THUNDER_BLESSING` | First TB hit begins | t=0.8s in TB sequence |
| `SFX_SECOND_HIT` | Second TB hit | t=2.3s in TB sequence |
| `SFX_COIN_TOSS_START` | Coin fly-in | On coin enter animation start |
| `SFX_COIN_TOSS_FLIP` | Coin spinning | Loop during spin phase |
| `SFX_COIN_HEADS` | HEADS result | Coin face settles at HEADS |
| `SFX_COIN_TAILS` | TAILS result | Coin face settles at TAILS |
| `SFX_FG_ENTER` | FG scene transition | Cross-dissolve start |
| `SFX_FG_MULT_UP` | FG multiplier upgrades | Progress bar animation start |
| `SFX_FG_MULT_77` | ×77 reached | MAX MULTIPLIER banner |
| `SFX_FG_BONUS_100X` | `fgBonusMultiplier = 100` | Full-screen effect start |
| `SFX_EXTRA_BET_ON` | Extra Bet toggle ON | Toggle click |
| `SFX_BUY_FG_CONFIRM` | Buy Feature confirmed | Dialog close animation |
| `SFX_NEAR_MISS` | `nearMissApplied = true` | Grid stop moment |
| `SFX_MAX_WIN` | 30,000× cap reached | Zeus character animation |
| `SFX_MAX_WIN_LEGENDARY` | 90,000× cap reached | Legendary Win animation |

### 7.3 Audio State Machine

The audio state machine mirrors the game state machine:

| Game State | BGM Action |
|-----------|-----------|
| `IDLE` | Play/continue `BGM_MAIN` |
| `SPINNING` → `CASCADE_RESOLVING` | Continue `BGM_MAIN` |
| `THUNDER_BLESSING` | No BGM change; `SFX_THUNDER_BLESSING` plays |
| `COIN_TOSS` | Crossfade to `BGM_COIN_TOSS` (800ms) |
| `FREE_GAME` entered | Crossfade to `BGM_FREE_GAME` (800ms) |
| FG multiplier = 77 | Crossfade to `BGM_77X` (800ms) |
| `FREE_GAME` exits | Crossfade back to `BGM_MAIN` (800ms) |
| FREE letters all lit | Crossfade to `BGM_ANTICIPATION` (300ms) |

### 7.4 Mobile Audio Unlock Pattern

Mobile browsers (iOS Safari, Chrome on Android) block audio until a user gesture occurs. The unlock sequence:

```typescript
// src/audio/MobileAudioUnlock.ts

class MobileAudioUnlock {
  static setup(audioManager: AudioManager): void {
    const unlockHandler = async (): Promise<void> => {
      await audioManager.unlock();
      // Start deferred audio preloads
      await this.preloadAudioAssets(audioManager);
      // Remove listeners after first interaction
      document.removeEventListener('touchstart', unlockHandler);
      document.removeEventListener('click', unlockHandler);
    };

    document.addEventListener('touchstart', unlockHandler, { once: true });
    document.addEventListener('click', unlockHandler, { once: true });
  }

  private static async preloadAudioAssets(manager: AudioManager): Promise<void> {
    // Load audio in priority order: BGM_MAIN first, then SFX in background
    await manager.preload('BGM_MAIN', 'audio/bgm_main.ogg');
    // Defer remaining loads without blocking gameplay
    setTimeout(() => this.loadRemainingAudio(manager), 0);
  }
}
```

---

## §8 Network Resilience

### 8.1 Retry Policy

```typescript
// src/network/RetryPolicy.ts

const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [1000, 2000, 4000],  // Exponential backoff
  retryableStatusCodes: [500, 503, 504],
  nonRetryableCodes: ['INSUFFICIENT_FUNDS', 'INVALID_BET_LEVEL', 'UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'SPIN_IN_PROGRESS'],
} as const;

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof GameError && RETRY_CONFIG.nonRetryableCodes.includes(error.code as never)) {
        throw error;  // Do not retry non-retryable errors
      }
      lastError = error as Error;
      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        await delay(RETRY_CONFIG.backoffMs[attempt]);
      }
    }
  }
  throw lastError!;
}
```

### 8.2 Request Timeout

All API requests use a 10-second timeout enforced by `AbortController`:

```typescript
const SPIN_TIMEOUT_MS = 10_000;
const CONFIG_TIMEOUT_MS = 5_000;
const SESSION_TIMEOUT_MS = 5_000;
```

### 8.3 Reconnect Protocol

On page visibility change to `visible` (player returns to tab):

```typescript
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;

  const sessionId = GameContext.getInstance().sessionId;
  if (!sessionId) return;

  stateMachine.transition('APP_RESUME');  // → SESSION_RECONNECT

  try {
    const session = await sessionService.getSession(sessionId);
    if (session.status === 'FG_ACTIVE') {
      lightningMarkComponent.restoreMarks(session.lightningMarks.positions);
      freeGameComponent.restoreFromSession(session.fgMultiplier!, session.fgRound!);
      stateMachine.transition('SESSION_RESTORED_FG');
    } else {
      stateMachine.transition('SESSION_RESTORED_IDLE');
    }
  } catch (error) {
    if (error instanceof GameError && error.code === 'SESSION_NOT_FOUND') {
      showDialog('Session Expired', 'Your session has expired. The game will return to the main screen.');
    }
    stateMachine.transition('SESSION_EXPIRED');
  }
});
```

### 8.4 Offline Indicator UI

```typescript
// Monitor network connectivity
window.addEventListener('offline', () => {
  HUDComponent.getInstance().showOfflineBanner('No internet connection');
  GameStateMachine.getInstance().transition('NETWORK_OFFLINE');
});

window.addEventListener('online', () => {
  HUDComponent.getInstance().hideOfflineBanner();
  // Attempt reconnect
  triggerSessionReconnect();
});
```

The offline banner displays at the top of the screen with a warning color (`--color-error`), dismissible after connectivity restores.

---

## §9 Configuration and Initialization

### 9.1 Config Loading Flow

```
Application starts
    │
    ▼
LoadingScene.onLoad()
    │
    ▼
ConfigService.loadConfig()  →  GET /v1/config
    │
    ├── Success: store config in ConfigService cache
    │
    └── Failure: show "Failed to load game config" error; offer reload button
```

### 9.2 Bet Level Configuration

Bet levels are **never hardcoded** in the frontend. All values come from `GET /v1/config`:

```typescript
interface BetLevel {
  readonly level: number;     // 1–20 for USD; 1–320 for TWD
  readonly baseBet: number;   // e.g., 0.50 for USD level 5
  readonly currency: 'USD' | 'TWD';
}
```

The `BetPanelComponent` populates its level selector from `config.betLevels` filtered by the player's selected currency.

### 9.3 Extra Bet and Buy Feature Toggles

```typescript
const config = ConfigService.getInstance().getConfig();

// Extra Bet availability
BetPanelComponent.setExtraBetEnabled(config.extraBetEnabled);

// Buy Feature availability
if (config.buyFeatureEnabled) {
  const cost = GameContext.getInstance().baseBet
    * 100
    * (GameContext.getInstance().extraBet ? 3 : 1);
  BetPanelComponent.setBuyFeatureEnabled(true, cost);
} else {
  BetPanelComponent.setBuyFeatureEnabled(false, 0);
}
```

### 9.4 Reel Strip Configuration

The `ReelComponent` uses `config.reelStrips` (5 arrays of symbol IDs) to determine what symbols appear in each reel. This drives both the visual reel strip and the initial grid display.

### 9.5 Paytable Configuration

The paytable from `config.paytable` is used only for display in the Info panel (not for win calculation — the backend computes all win amounts). The frontend never uses the paytable to compute `payout` values.

---

## §10 Performance and Memory

### 10.1 Object Pooling

#### SymbolComponent Pool

```typescript
// src/pools/SymbolPool.ts

class SymbolPool {
  private readonly POOL_SIZE = 35;  // 30 active + 5 buffer
  private available: SymbolComponent[] = [];
  private inUse: Set<SymbolComponent> = new Set();

  acquire(symbolId: SymbolId): SymbolComponent {
    let symbol = this.available.pop();
    if (!symbol) {
      // Pool exhausted — create new instance (should not happen in normal play)
      symbol = new SymbolComponent();
    }
    symbol.onReused(symbolId);
    this.inUse.add(symbol);
    return symbol;
  }

  release(symbol: SymbolComponent): void {
    symbol.onRecycled();
    this.inUse.delete(symbol);
    this.available.push(symbol);
  }

  prewarm(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.available.push(new SymbolComponent());
    }
  }
}
```

### 10.2 Texture Atlas Strategy

| Atlas | Contents | Size | Usage |
|-------|----------|------|-------|
| `symbols_atlas.png` | All 10 symbol idle frames (W, SC, P1–P4, L1–L4) + win highlight overlays | 2048×2048px | Loaded in LoadingScene |
| `ui_atlas.png` | All HUD elements, buttons, dialog frames, FREE letters | 2048×2048px | Loaded in LoadingScene |
| `fx_atlas.png` | Particle sprite sheets (lightning arc, gold coin, explosion) | 2048×2048px | Loaded in GameScene |
| `fg_atlas.png` | FG-exclusive UI (multiplier progress bar, coin toss overlay) | 1024×1024px | Loaded on FG entry (lazy) |

Spine animation files (`.spine` + `.atlas`) are loaded per-symbol as separate assets, not embedded in the main atlas.

### 10.3 GC Pressure Avoidance

**Rules enforced throughout the codebase:**

1. **No per-frame object creation:** `Position` objects, `WinLine` arrays, and animation interpolation values must be pre-allocated and reused.
2. **Pre-allocate particle buffers:** Particle system uses a fixed-size `Float32Array` for positions/velocities.
3. **Animation step objects:** `AnimationQueue` builds its step array once per spin and reuses pooled objects.
4. **Event emitters:** Use static listener arrays; do not create closure-bound lambdas inside the animation loop.

```typescript
// BAD: creates new object every frame
function updateParticle(dt: number): void {
  const velocity = { x: this.vx * dt, y: this.vy * dt };  // Allocation!
  this.position.x += velocity.x;
}

// GOOD: reuse pre-allocated temp vector
const tempVec = { x: 0, y: 0 };
function updateParticle(dt: number): void {
  tempVec.x = this.vx * dt;
  tempVec.y = this.vy * dt;
  this.position.x += tempVec.x;
}
```

### 10.4 Memory Budget by Scene

| Scene | Textures | Spine | Audio | Total |
|-------|----------|-------|-------|-------|
| LoadingScene | 5 MB | — | — | 5 MB |
| GameScene (base) | 40 MB | 30 MB | 15 MB (SFX) | 85 MB |
| GameScene + FG active | 45 MB | 35 MB | 25 MB | 105 MB |
| Peak (Thunder Blessing + particles) | 55 MB | 40 MB | 25 MB | 120 MB |

These budgets apply per-platform. Mobile devices reduce texture resolution by loading 1× or 2× assets instead of 3× (asset switching driven by `devicePixelRatio` and `navigator.deviceMemory`).

### 10.5 Lazy Load Strategy

**Deferred until first user interaction:**
- All audio assets (BGM and SFX)
- FG-exclusive Spine animations (`fx_fg_bonus_100x.spine`, `fx_coin_toss_flip.spine`)
- Big Win / Mega Win banner Spine files

**Deferred until FG entry:**
- `fg_atlas.png` (FG UI textures)
- FG background variants (`bg_freegame_sky.png`)
- `BGM_FREE_GAME` and `BGM_77X` audio buffers

### 10.6 Mobile Performance Degradation

When `navigator.hardwareConcurrency <= 4` or `navigator.deviceMemory <= 2`:
- Reduce particle count to mobile limits (VDD §5.4: 200 absolute; 800 FG Bonus ×100; 600 Max Win).
- Disable Idle animations on symbols (PDD §10.4): only Win and Special animations play.
- Disable background parallax layers 2–4.
- Load 1× texture resolution instead of 2×.
- Reduce Spine animation framerate to 24fps for Idle animations.

---

## §11 Error and Edge Case Handling

### 11.1 Near Miss (`nearMissApplied = true`)

When `FullSpinOutcome.nearMissApplied` is `true`, the reel stop animation includes:
- A brief gold border flash (400ms) on near-miss grid positions (identified by the engine's reel stop configuration, not computed by the client).
- Subtle orange-gold color highlight (`--color-orange-thunder`) on affected cell borders.
- `SFX_NEAR_MISS` plays (0.5s suspense string sound).
- No text label is shown (per PDD §7.5 — "ALMOST!" or similar are explicitly forbidden).
- `totalWin = 0` is still displayed normally; the near-miss is a pure visual effect.

```typescript
if (outcome.nearMissApplied) {
  await animationQueue.enqueueNearMiss();  // Resolves before cascade steps
}
```

### 11.2 Session Floor (`sessionFloorApplied = true`)

When `FullSpinOutcome.sessionFloorApplied = true` (Buy Feature spin where floor was needed):
- After all FG animations complete, display a brief "BONUS WIN GUARANTEED" indicator (gold ribbon banner, 1.5s auto-dismiss).
- The WIN counter rolls up to `totalWin` normally — no special floor-specific animation.
- The displayed value is always `outcome.totalWin` (the sole authority), which already incorporates the floor guarantee.

### 11.3 Max Win Cap

Cap selection logic:
- buyFeature = true (with or without extraBet): maxWin = config.maxWin.buyFeature (90,000×)
- extraBet = true, buyFeature = false: maxWin = config.maxWin.mainGame (30,000×)
- neither: maxWin = config.maxWin.mainGame (30,000×)

When `totalWin` equals the applicable max win cap:

```typescript
const maxWinMultiplier = outcome.buyFeatureActive
  ? configService.config.maxWin.buyFeature        // 90,000×
  : configService.config.maxWin.mainGame;          // 30,000×
const maxWinValue = maxWinMultiplier * outcome.baseBet;
const isMaxWin = Math.abs(outcome.totalWin - maxWinValue) < 0.01;
```

- Trigger full Max Win celebration (PDD §9.4): Zeus character animation, rainbow color burst, 6s display.
- For 90,000× cap (buyFeature = true): additionally show "LEGENDARY WIN" overlay with Zeus + Pegasus + Athena three-character sequence (10s+ display).
- Player can tap to skip after 3s.

### 11.4 Zero-Win Spin

When `outcome.totalWin === 0` and `outcome.cascadeSequence.steps.length === 0`:
- Display initial grid with no win animations.
- No WIN counter animation (stays at 0).
- No special effects.
- After reel stop (~1s), return to `IDLE` immediately.

When `outcome.totalWin === 0` but `cascadeSequence.steps` is non-empty (cascade occurred but ultimately 0 win due to no winning lines in all steps):
- Play full cascade animation sequence (symbols fall and expand) per §6.2.
- WIN counter remains at 0 throughout.
- Return to `IDLE` after last cascade step.

### 11.5 FG Active on Reconnect

When `GET /v1/session` returns `status === 'FG_ACTIVE'`:

```typescript
// Reconstruct FG state from session data
async function restoreFGSession(session: SessionData): Promise<void> {
  // 1. Switch to FG background (no cross-dissolve on reconnect)
  await sceneManager.switchBackground('freegame', false);

  // 2. Restore Lightning Marks
  lightningMarkComponent.restoreMarks(session.lightningMarks.positions);

  // 3. Restore multiplier progress bar to session.fgMultiplier
  coinTossComponent.updateMultiplierProgress(
    fgMults.indexOf(session.fgMultiplier!) + 1
  );

  // 4. Update spin counter to session.fgRound (already 1-indexed from API)
  freeGameComponent.updateSpinCounter(session.fgRound, false);

  // 5. Show "Restoring Session..." overlay during the above
  // 6. Remove overlay, resume FG from current round
  stateMachine.transition('SESSION_RESTORED_FG');
}
```

**Visual states during reconnect (PDD §7.6):**

| State | Visual |
|-------|--------|
| Loading | Spinning loading icon on FG background; "Restoring Session..." text (white, Open Sans 18px) |
| Restored | FG multiplier bar animates to correct position (0.5s); marks redraw; overlay disappears |
| Expired (404) | Return to Main Game background; "Session Expired" stone-frame dialog |

### 11.6 Buy Feature Confirmation Dialog

Before executing a `buyFeature = true` spin, show confirmation dialog (PDD §8.2):
- Display cost: `100 × baseBet` (normal) or `300 × baseBet` (Extra Bet ON).
- Show "Win floor: 20× BET" guarantee text.
- CONFIRM: execute spin.
- CANCEL: dismiss dialog, no spin.
- Dialog blocks background interaction (modal overlay).

### 11.7 Concurrent Spin Guard (`SPIN_IN_PROGRESS` — HTTP 409)

If `SPIN_IN_PROGRESS` (409) is received (should not normally occur with proper UI locking):
- Show a brief "Please wait" message to the player.
- Do not retry automatically — wait for the player to re-submit the spin.
- Unlock the SPIN button so the player can re-submit when ready.

---

## §12 Testing Approach

### 12.1 Unit Tests

**State Machine:**
```typescript
// src/__tests__/GameStateMachine.test.ts

describe('GameStateMachine', () => {
  it('transitions IDLE → SPINNING on SPIN_PRESSED', () => {
    const sm = new GameStateMachine();
    sm.transition('SPIN_PRESSED');
    expect(sm.currentState).toBe(GameState.SPINNING);
  });

  it('transitions SPINNING → CASCADE_RESOLVING on valid spin response', () => {
    const sm = new GameStateMachine();
    sm.setState(GameState.SPINNING);
    sm.transition('SPIN_RESPONSE_OK');
    expect(sm.currentState).toBe(GameState.CASCADE_RESOLVING);
  });

  it('transitions TIMEOUT_RETRY → NETWORK_ERROR after 3 retries', () => {
    const sm = new GameStateMachine();
    sm.setState(GameState.TIMEOUT_RETRY);
    sm.setRetryCount(3);
    sm.transition('RETRY_COUNT_EXCEEDED');
    expect(sm.currentState).toBe(GameState.NETWORK_ERROR);
  });
});
```

**Win Calculator (display only — verifies roll-up, not authoritative win):**
```typescript
describe('WinRollupAnimation', () => {
  it('reaches target value exactly at completion', async () => {
    const frames: number[] = [];
    await new Promise<void>((resolve) => {
      animateWinRollup(0, 10.25, (v) => frames.push(v), resolve);
    });
    expect(frames[frames.length - 1]).toBeCloseTo(10.25, 2);
  });
});
```

**AnimationQueue:**
```typescript
describe('AnimationQueue', () => {
  it('builds correct step count for a FG-triggered outcome', () => {
    const queue = new AnimationQueue();
    queue.build(mockFGOutcome);  // 3 cascade steps + TB + coin toss + FG entry + 3 FG rounds + FG complete + win display
    expect(queue.length).toBe(11);
  });

  it('places FG_ENTRY before first FG_ROUND in queue', async () => {
    const queue = new AnimationQueue();
    queue.build(mockFGOutcome);
    const types: string[] = [];
    const dispatcher = createMockDispatcher({
      default: (step: AnimationStep) => types.push(step.type),
    });
    await queue.play(dispatcher);
    const fgEntryIdx = types.indexOf('FG_ENTRY');
    const fgRoundIdx = types.indexOf('FG_ROUND');
    expect(fgEntryIdx).toBeGreaterThanOrEqual(0);
    expect(fgRoundIdx).toBeGreaterThanOrEqual(0);
    expect(fgEntryIdx).toBeLessThan(fgRoundIdx);
  });
});
```

### 12.2 Integration Tests

Mock server responses → animation sequence validation:

```typescript
// src/__tests__/integration/SpinFlow.test.ts

describe('Spin flow integration', () => {
  it('plays cascade steps sequentially from FullSpinOutcome', async () => {
    const mockOutcome = loadFixture('cascade_3_steps.json');
    const playedSteps: number[] = [];

    const dispatcher = createMockDispatcher({
      'CASCADE_STEP': (data) => playedSteps.push(data.index),
    });

    const queue = new AnimationQueue();
    queue.build(mockOutcome);
    await queue.play(dispatcher);

    expect(playedSteps).toEqual([0, 1, 2]);
  });

  it('plays Thunder Blessing sequence after cascade completes', async () => {
    const mockOutcome = loadFixture('thunder_blessing_triggered.json');
    const played: string[] = [];

    const dispatcher = createMockDispatcher({
      'CASCADE_STEP': () => played.push('cascade'),
      'THUNDER_BLESSING': () => played.push('tb'),
    });

    const queue = new AnimationQueue();
    queue.build(mockOutcome);
    await queue.play(dispatcher);

    const tbIndex = played.indexOf('tb');
    const lastCascadeIndex = played.lastIndexOf('cascade');
    expect(tbIndex).toBeGreaterThan(lastCascadeIndex);
  });

  it('plays all FG rounds in order from fgRounds array', async () => {
    const mockOutcome = loadFixture('fg_3_rounds.json');
    const roundsPlayed: number[] = [];

    const dispatcher = createMockDispatcher({
      'FG_ROUND': (data) => roundsPlayed.push(data.index),
    });

    const queue = new AnimationQueue();
    queue.build(mockOutcome);
    await queue.play(dispatcher);

    expect(roundsPlayed).toEqual([0, 1, 2]);
  });
});
```

### 12.3 Visual Regression Tests

Using Playwright for screenshot-based regression across key game states:

```typescript
// src/__tests__/visual/GameStates.visual.test.ts

import { test, expect } from '@playwright/test';

const BREAKPOINTS = [320, 768, 1024, 1440];

for (const width of BREAKPOINTS) {
  test.describe(`${width}px breakpoint`, () => {
    test('IDLE state — initial 3-row grid', async ({ page }) => {
      await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
      await page.goto('/game?state=idle');
      await expect(page.locator('.reel-container')).toBeVisible();
      await expect(page).toHaveScreenshot(`idle-${width}.png`);
    });

    test('FG active state — multiplier ×17 displayed', async ({ page }) => {
      await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
      await page.goto('/game?state=fg&multiplier=17');
      await expect(page.locator('.fg-multiplier')).toContainText('×17');
      await expect(page).toHaveScreenshot(`fg-x17-${width}.png`);
    });

    test('Win screen — Big Win overlay', async ({ page }) => {
      await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
      await page.goto('/game?state=bigwin&amount=500');
      await expect(page.locator('.win-banner')).toBeVisible();
      await expect(page).toHaveScreenshot(`bigwin-${width}.png`);
    });

    test('Coin Toss overlay — HEADS result', async ({ page }) => {
      await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
      await page.goto('/game?state=cointoss&result=heads');
      await expect(page.locator('.coin-toss-overlay')).toBeVisible();
      await expect(page).toHaveScreenshot(`cointoss-heads-${width}.png`);
    });
  });
}
```

**Visual test scenarios required:**

| Scenario | Breakpoints | Notes |
|----------|------------|-------|
| IDLE — 3-row grid, no marks | 320, 768, 1024, 1440 | Baseline; catch layout regressions |
| Cascade active — 6-row expanded | 320, 1440 | Verify cloud mask at bottom |
| Lightning Marks — 5+ marks on grid | 1024, 1440 | Counter display threshold |
| Thunder Blessing first hit | 1440 | Full-screen flash; white overlay |
| Coin Toss — HEADS | 1440 | Multiplier bar at ×3 |
| Coin Toss — TAILS | 1440 | Dimmed coin state |
| Free Game active — ×77 multiplier | 1024, 1440 | Pulsing red node |
| FG Bonus ×100 reveal | 1440 | Full-screen particle state |
| Big Win overlay | 320, 768, 1440 | Font scaling |
| Reconnect — FG restore loading | 1440 | Loading overlay on FG bg |

---

*FRONTEND.md version 1.0 — generated from IDEA.md, BRD.md, PRD.md, PDD.md v1.0, VDD.md v1.0, EDD.md v1.3, API.md v1.0, SCHEMA.md v1.0.*
*All API field names (FullSpinOutcome, CascadeStep, FGRound, ThunderBlessingResult, etc.) match API.md §3.1 and §4 exact definitions.*
*All animation timing values derive from PDD §4–§7 and VDD §4 Token system.*
*The frontend is a Pure View: totalWin is always outcome.totalWin; win amounts are never computed on the client.*
