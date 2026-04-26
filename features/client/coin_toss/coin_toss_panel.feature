@client @coin_toss @animation
Feature: Coin Toss Panel — UI Behavior
  As a player who has triggered Coin Toss (all 4 FREE letters lit)
  I want to see the full Coin Toss mini-game overlay
  So that I can experience the suspense of whether I win Free Game entry

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And a spin has resolved with all four "F R E E" letters lit on the reel frame
    And the game has transitioned to the COIN_TOSS state

  # ---------------------------------------------------------------------------
  # Happy Path — Coin Toss Heads (FG entry)
  # ---------------------------------------------------------------------------

  @TC-E2E-COIN-001
  Scenario: Coin Toss overlay appears with spotlight and coin fly-in animation
    When the COIN_TOSS state activates
    Then the reel grid and background dim with a dark overlay (opacity ~0.7, ~0.4 s transition)
    And a spotlight light cone appears from the top of the screen pointing downward
    And a large golden coin flies in from above into the spotlight center (~0.5 s)
    And the coin's face (Zeus Heads side) is visible at rest before spinning
    And background music transitions to the tense "BGM_COIN_TOSS" track

  @TC-E2E-COIN-002
  Scenario: Coin spins in 3D and gradually decelerates before showing result
    Given the Coin Toss overlay is active and the coin is in frame
    When the coin flip animation begins
    Then the coin rotates rapidly on its Y-axis simulating a real toss (720°/s initial speed)
    And the coin's edge and both sides are visible alternately during the spin
    And the coin gradually decelerates over 2.5–3.5 seconds
    And the coin settles to a stop showing either the Heads (Zeus) or Tails (thunderbolt) face

  @TC-E2E-COIN-003
  Scenario: Heads result — "ZEUS SMILES!" text and gold burst effect
    Given the coin flip has resolved to Heads
    When the coin face locks onto the Zeus (Heads) side
    Then a gold burst particle effect erupts from the coin
    And the text "ZEUS SMILES!" appears in large gold letters above the coin
    And a victory sound effect plays
    And the multiplier progress bar at the bottom advances to the next multiplier node (×3 initially)
    And the progress bar node lights up with a scale-in flash animation (~0.3 s)
    And after a brief display (~1.5 s) the game transitions to the Free Game scene

  @TC-E2E-COIN-004
  Scenario: Tails result — "NOT THIS TIME" text and coin darkens
    Given the coin flip has resolved to Tails
    When the coin face locks onto the Tails (thunderbolt) side
    Then the coin dims with a blue-grey color shift
    And the text "NOT THIS TIME" appears in silver letters
    And a low-resonance sound effect plays
    And no multiplier progress bar advancement occurs
    And the Coin Toss overlay fades out
    And the game returns to the IDLE state in the main game scene

  # ---------------------------------------------------------------------------
  # FG Multiplier progress bar behavior
  # ---------------------------------------------------------------------------

  @TC-E2E-COIN-005
  Scenario: Multiplier progress bar shows node sequence and color gradient
    Given the Coin Toss overlay is active
    Then the multiplier progress bar is visible at the bottom of the overlay
    And the bar shows five multiplier nodes: ×3, ×7, ×17, ×27, ×77 from left to right
    And the current (highest achieved) node is filled with gold
    And un-reached nodes are displayed in a dimmed state
    And the connecting segments use a color gradient from green (×3) through yellow, orange, and red (×77)

  @TC-E2E-COIN-006
  Scenario: Reaching ×77 multiplier shows MAX MULTIPLIER banner
    Given the player has previously earned ×27 in this FG sequence
    And the current Coin Toss resolves to Heads
    When the multiplier advances from ×27 to ×77
    Then all five progress nodes simultaneously pulse gold
    And the progress bar background shows a rainbow shimmer effect (~0.5 s)
    And a "MAX MULTIPLIER ×77" banner slides in and remains visible for ~2.0 s before dissolving
    And the ×77 node displays a red lightning arc particle effect

  # ---------------------------------------------------------------------------
  # Error / Edge Flows
  # ---------------------------------------------------------------------------

  @TC-E2E-COIN-007
  Scenario: Player cannot interact with game controls during Coin Toss
    Given the Coin Toss overlay is active and the coin is spinning
    When the player attempts to click the SPIN button, bet buttons, or Extra Bet toggle
    Then all game control buttons are unresponsive (hidden behind the overlay)
    And the Coin Toss sequence completes without interruption
