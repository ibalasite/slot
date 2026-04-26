@client @free_game @animation
Feature: Free Game Mode — UI Behavior
  As a player who has entered Free Game mode
  I want to see the FG scene, multiplier display, and spin counter
  So that I can track my progress and enjoy the distinct Free Game visual experience

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated
    And 5 or more Lightning Marks accumulated at round end triggering Free Game entry

  # ---------------------------------------------------------------------------
  # Happy Path — FG entry and scene
  # ---------------------------------------------------------------------------

  @TC-E2E-FG-009
  Scenario: Free Game entry triggers reel expansion to 5×6 layout
    Given the Free Game was just triggered by 5 accumulated Lightning Marks
    When the Free Game entry animation completes
    Then the reel grid visually displays 6 rows of symbols across 5 columns
    And the expanded row count indicator confirms 6 active rows
    And the Free Game HUD shows "10 free spins remaining"

  @TC-E2E-FG-001
  Scenario: Free Game entry — scene cross-dissolve and fanfare animation
    Given 5 or more Lightning Marks have accumulated and the Free Game entry sequence has been triggered
    When the Free Game entry animation plays after 5+ Lightning Marks accumulated
    Then the screen cross-dissolves from the main game (dusk temple) to the FG scene (night sky temple) over ~0.8 s
    And starfield particles drift slowly across the FG background
    And the temple columns in the FG scene glow brighter with gold light
    And a "FREE GAME" gold banner drops from the top of the screen
    And the current multiplier "×3" appears in large gold text at center screen then shrinks to its HUD position
    And the background music transitions to "BGM_FREE_GAME"

  @TC-E2E-FG-002
  Scenario: FG HUD shows SPIN COUNT and MULTIPLIER; BUY FG button is hidden
    Given the player has entered Free Game mode
    When the Free Game scene has loaded and the HUD is visible
    Then the top-left area of the HUD shows a "FREE GAME" label
    And the current multiplier (e.g., "×3") is displayed in the upper-left reel area
    And the SPIN COUNT area shows "0 / 10" before the first FG spin has been taken
    And the BUY FREE GAME button is hidden from the HUD
    And the SPIN button is not visible or is replaced by the auto-spin mechanism for FG
    And the BET adjustment controls are locked (greyed out)

  @TC-E2E-FG-003
  Scenario: FG spin counter increments with each completed FG round
    Given the player is in Free Game mode and on round 1
    When the first FG spin and Cascade sequence complete
    Then the SPIN COUNT display shows "Spin #1" in gold text
    When the second FG round completes
    Then the SPIN COUNT display updates to "Spin #2" with a number-flip animation (~0.3 s)

  @TC-E2E-FG-004
  Scenario: Multiplier upgrades visually when Coin Toss Heads advances the stage
    Given the current FG multiplier is ×3
    When a Coin Toss within Free Game resolves to Heads
    Then the old multiplier number (×3) explodes outward from its position
    And the new multiplier number (×5) flies in from center screen large then shrinks to the HUD position
    And the multiplier progress bar node for ×5 lights up with a flash animation
    And the multiplier label in the HUD updates to "×5" in gold text

  @TC-E2E-FG-005
  Scenario: Lightning Marks from the main game entry persist and accumulate across FG rounds
    Given the player entered Free Game with 3 Lightning Marks on the grid from the main game
    When the first FG spin completes with a cascade that produces 2 new marks
    Then the reel grid shows 5 Lightning Marks total (3 inherited + 2 new)
    And the Lightning Mark counter shows "⚡ × 5" with a pulsing white-gold effect

  @TC-E2E-FG-006
  Scenario: FG Bonus ×100 triggers full-screen explosion effect
    Given the spin outcome data includes a fgBonus value of "×100"
    When the FG Bonus reveal animation fires
    Then a full-screen gold particle explosion fills the screen (3,000+ particles, ~3.0 s)
    And the text "×100 BONUS!" erupts from center screen scaling from 0 to 3× then settling at ~60% screen height
    And the background flashes white briefly (~0.2 s)
    And thunder and coin-rain audio plays simultaneously
    And after ~3.5 s the bonus animation resolves and the FG round continues

  # ---------------------------------------------------------------------------
  # FG Termination
  # ---------------------------------------------------------------------------

  @TC-E2E-FG-007
  Scenario: FG ends when Coin Toss resolves Tails — FINAL label appears then game exits
    Given the player is in Free Game mode and a Coin Toss resolves to Tails
    When the Tails result is displayed
    Then the SPIN COUNT area updates to show "FINAL" in flashing gold text for ~2 s
    And the Lightning Marks are cleared from the grid with a dissolve animation
    And the total FG WIN amount is shown in a summary overlay before exiting
    And the scene cross-dissolves back to the main game (dusk temple)
    And the background music transitions back to "BGM_MAIN"
    And the game returns to IDLE state with the SPIN button re-enabled

  # ---------------------------------------------------------------------------
  # Error / Edge Flows
  # ---------------------------------------------------------------------------

  @TC-E2E-FG-008
  Scenario: Near Miss visual appears in FG — brief edge flash without text
    Given the player is in Free Game mode and a spin result qualifies as Near Miss
    When the reel columns stop
    Then the near-miss cell borders flash orange briefly (~0.4 s with vibration effect)
    And no text label such as "ALMOST!" appears
    And the near-miss effect fades and the round continues normally
