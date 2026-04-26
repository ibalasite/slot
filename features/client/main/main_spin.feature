@client @main @spin
Feature: Main Game Spin — UI Behavior
  As a player on the Thunder Blessing main game screen
  I want the spin button and game UI to behave correctly during a spin cycle
  So that I receive clear visual feedback for every action and outcome

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the player's balance is displayed as "$1,000.00" in the BALANCE field
    And the reel grid shows a 5×3 layout

  # ---------------------------------------------------------------------------
  # Happy Path — standard spin cycle
  # ---------------------------------------------------------------------------

  @TC-E2E-SPIN-001
  Scenario: Spin button disables while spin is in flight
    Given the player has a bet of "$0.25" selected
    When the player clicks the SPIN button
    Then the SPIN button becomes visually disabled (greyed-out, not clickable)
    And the reel symbols begin scrolling upward on all five columns
    And the AUTO SPIN button becomes visually disabled
    And the BUY FREE GAME button becomes visually disabled

  @TC-E2E-SPIN-002
  Scenario: Reel stops column by column and balance updates after a non-winning spin
    Given the player clicks the SPIN button
    When each reel column stops in left-to-right sequence
    Then column 1 symbols lock into place first
    And column 2 symbols lock into place second
    And columns 3, 4, and 5 follow in succession with a slight delay between each
    And after all five columns stop the WIN field displays "$0.00"
    And the BALANCE field decrements by the bet amount to reflect the deduction
    And the SPIN button re-enables and returns to its normal gold appearance
    And the game state returns to IDLE

  @TC-E2E-SPIN-003
  Scenario: Small win — WIN counter updates and winning symbols highlight
    Given the spin outcome contains a winning payline
    When all five reel columns have stopped
    Then the winning symbols play their Win animation (glow and pulse, ~1.0 s)
    And the WIN field rolls up from "$0.00" to the winning amount
    And a gold highlight line traces the winning payline path across the grid
    And non-winning symbols dim to reduced opacity
    And after the win presentation the SPIN button re-enables

  @TC-E2E-SPIN-004
  Scenario: Big Win overlay displays for wins ≥ 20× bet
    Given the current bet is "$0.25"
    And the spin outcome produces a total win of "$5.00" or more (≥ 20× bet)
    When the win evaluation completes
    Then a full-screen "BIG WIN" banner slides down over the game grid
    And a gold coin-rain particle effect fills the screen
    And the WIN counter animates from zero up to the final win value
    And the player can tap anywhere to skip the presentation
    And after dismissal the SPIN button re-enables and normal IDLE state resumes

  @TC-E2E-SPIN-005
  Scenario: Spin button remains disabled until the full animation sequence drains
    Given a winning spin with a cascade chain of 3 steps has resolved
    When the cascade animations are still playing
    Then the SPIN button remains visually disabled throughout all cascade steps
    And the SPIN button only re-enables after the final cascade step WIN counter update completes

  # ---------------------------------------------------------------------------
  # Error / Edge Flows
  # ---------------------------------------------------------------------------

  @TC-E2E-SPIN-006
  Scenario: Insufficient balance — spin button stays disabled when balance is zero
    Given the player's balance is "$0.00"
    When the game loads or balance updates to zero
    Then the SPIN button is displayed in a disabled (greyed-out) state
    And clicking the SPIN button produces no action or animation
    And a subtle insufficient-funds indicator appears near the BALANCE field

  @TC-E2E-SPIN-007
  Scenario: Network timeout during spin shows loading indicator then error
    Given the player clicks the SPIN button
    When the server response is not received within 500 ms
    Then a loading indicator appears overlaid on the reel grid
    And the SPIN button remains disabled
    When the response has not arrived after the configured timeout threshold
    Then an error dialog appears with a human-readable message
    And the SPIN button re-enables so the player can retry
    And the player's balance is not double-debited

  # ---------------------------------------------------------------------------
  # Auth Guard
  # ---------------------------------------------------------------------------

  @TC-E2E-SPIN-008
  Scenario: Unauthenticated player cannot spin
    Given the player's session token has expired before a spin attempt
    When the player clicks the SPIN button
    Then the game displays a "Session Expired" dialog with a stone-carved frame and gold border
    And the SPIN button remains disabled
    And the dialog prompts the player to log in again
