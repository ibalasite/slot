@client @extra_bet @toggle
Feature: Extra Bet Toggle — UI Behavior
  As a player who wants to activate the Extra Bet feature
  I want the toggle switch to clearly indicate its state and update relevant costs
  So that I know when Extra Bet is active and what it costs

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the Extra Bet toggle is in the OFF state (grey, left position)

  # ---------------------------------------------------------------------------
  # Happy Path — toggling Extra Bet ON
  # ---------------------------------------------------------------------------

  @TC-E2E-EXBT-001
  Scenario: Toggling Extra Bet ON changes toggle appearance and updates BET display
    Given the current base bet is "$0.25"
    And the BET field shows "$0.25"
    When the player clicks the EXTRA BET toggle switch
    Then the toggle slider animates to the right position over ~0.2 s
    And the toggle background transitions from grey to gold over ~0.3 s
    And electric arc particles appear around the gold toggle
    And the "EXTRA BET" label text turns gold and glows
    And the BET field immediately updates to "$0.75" (3× base bet) in orange text
    And an electric-arc activation sound effect plays

  @TC-E2E-EXBT-002
  Scenario: Toggling Extra Bet OFF restores original BET display
    Given the Extra Bet toggle is currently ON (gold, slider right)
    And the BET field shows "$0.75"
    When the player clicks the EXTRA BET toggle again
    Then the toggle slider animates back to the left over ~0.2 s
    And the toggle background returns to grey
    And the BET field reverts to "$0.25" in white text
    And no special sound effect plays (or a neutral click plays)

  @TC-E2E-EXBT-003
  Scenario: Extra Bet ×3 cost indicator is visible when toggle is ON
    Given the player has toggled Extra Bet to ON
    When viewing the BET display area
    Then an "×3" cost indicator badge appears adjacent to or within the BET field
    And the combined bet amount displayed is 3× the selected base bet level
    And the SPIN button remains enabled

  # ---------------------------------------------------------------------------
  # Buy Feature cost reflects Extra Bet state
  # ---------------------------------------------------------------------------

  @TC-E2E-EXBT-004
  Scenario: Buy Feature confirmation dialog cost updates when Extra Bet is ON
    Given the Extra Bet toggle is ON
    And the base bet is "$0.25"
    When the player opens the BUY FREE GAME confirmation dialog
    Then the dialog shows "Cost: 100 × Total BET = $75.00"
    And an "×3 EXTRA BET" orange label is displayed in the dialog
    And no "100 × BET" (normal cost) text is shown

  # ---------------------------------------------------------------------------
  # Toggle disabled during spin / FG
  # ---------------------------------------------------------------------------

  @TC-E2E-EXBT-005
  Scenario: Extra Bet toggle is disabled while a spin is in flight
    Given the player has pressed the SPIN button and a spin is in progress
    When the player clicks the EXTRA BET toggle
    Then the toggle does not change state
    And no visual transition plays on the toggle
    And the BET field does not change
    And the toggle re-enables only after the spin and all animations have completed

  @TC-E2E-EXBT-006
  Scenario: Extra Bet toggle is disabled during Free Game mode
    Given the player is in Free Game mode
    When the player is in Free Game mode and views the Extra Bet toggle area
    Then the EXTRA BET toggle is visually disabled (greyed out, non-interactive)
    And the toggle preserves whichever state it was in when FG was entered
    And clicking the toggle produces no visual or audio change
