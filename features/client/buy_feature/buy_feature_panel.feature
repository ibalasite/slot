@client @buy_feature @panel
Feature: Buy Feature Panel — UI Behavior
  As a player who wants to purchase a Free Game entry directly
  I want the Buy Feature button and confirmation dialog to behave correctly
  So that I can confirm the cost, complete the purchase, and enter Free Game immediately

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the player's balance is sufficient to cover the Buy Feature cost

  # ---------------------------------------------------------------------------
  # Happy Path — successful purchase
  # ---------------------------------------------------------------------------

  @TC-E2E-BUY-001
  Scenario: BUY FREE GAME button is visible and shows a purple-gold style in IDLE state
    Given the game is in IDLE state
    When the player views the main game HUD in IDLE state
    Then the "BUY FREE GAME" button is visible in the bottom-right area of the HUD
    And the button displays a purple-gold color with a small coin icon
    And hovering over the button produces a subtle gold-edge glow and slight scale-up (~1.05×)

  @TC-E2E-BUY-002
  Scenario: Clicking BUY FREE GAME opens the confirmation dialog
    Given the current bet is "$0.25"
    When the player clicks the "BUY FREE GAME" button
    Then a confirmation dialog appears in the center of the screen
    And the dialog has a stone-carved frame with a deep blue background and gold border
    And the dialog title reads "BUY FREE GAME" in Greek-style large text
    And the dialog body shows the cost: "Cost: 100 × BET = $25.00"
    And CONFIRM and CANCEL buttons are both visible and accessible

  @TC-E2E-BUY-003
  Scenario: Clicking CONFIRM deducts balance and launches Free Game via Coin Toss
    Given the confirmation dialog is open showing cost "$25.00"
    When the player clicks the CONFIRM button
    Then the dialog closes with a click sound and a brief visual concave-press effect on CONFIRM
    And the BALANCE field immediately decrements by $25.00
    And the game transitions directly to the Coin Toss overlay (guaranteed Heads = FG entry)
    And the Coin Toss coin appears and flips as normal
    And after the Coin Toss the FG scene begins

  @TC-E2E-BUY-004
  Scenario: Clicking CANCEL closes the dialog with no balance change
    Given the confirmation dialog is open
    When the player clicks the CANCEL button
    Then the dialog closes with a fade-out animation
    And the player's BALANCE remains unchanged
    And the game returns to IDLE state with the SPIN button enabled

  # ---------------------------------------------------------------------------
  # Extra Bet interaction with Buy Feature cost
  # ---------------------------------------------------------------------------

  @TC-E2E-BUY-005
  Scenario: With Extra Bet ON the confirmation dialog shows the 3× higher cost
    Given the Extra Bet toggle is set to ON
    And the base bet is "$0.25"
    When the player clicks the "BUY FREE GAME" button
    Then the confirmation dialog shows: "Cost: 100 × Total BET = $75.00"
    And an "×3 EXTRA BET" orange badge is displayed next to the cost line
    And the CONFIRM button reflects the higher cost

  # ---------------------------------------------------------------------------
  # Disabled states
  # ---------------------------------------------------------------------------

  @TC-E2E-BUY-006
  Scenario: BUY FREE GAME button is disabled and greyed-out during Free Game
    Given the player has entered Free Game mode
    When the player is in Free Game mode and views the HUD
    Then the "BUY FREE GAME" button is hidden from the HUD
    And no click interaction is possible on the button area

  @TC-E2E-BUY-007
  Scenario: BUY FREE GAME button is disabled when balance is insufficient
    Given the player's balance is "$5.00"
    And the Buy Feature cost at current bet would be "$25.00"
    When the game evaluates the button state
    Then the "BUY FREE GAME" button is displayed in a greyed-out, half-transparent disabled state
    And clicking the button produces no dialog or action
