@client @main @bet
Feature: Bet Level Selection — UI Behavior
  As a player on the main game screen
  I want to adjust my bet level using the −BET+ controls
  So that I can control how much I wager per spin

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the BET field shows the current total bet amount in gold text

  # ---------------------------------------------------------------------------
  # Happy Path — adjusting bet level
  # ---------------------------------------------------------------------------

  @TC-E2E-BET-001
  Scenario: Increasing bet level with the + button updates the BET display
    Given the current total bet shown in the BET field is "$0.25"
    When the player clicks the "+" bet adjustment button
    Then the BET field immediately updates to the next available bet level (e.g., "$0.50")
    And the SPIN button remains enabled
    And the balance display does not change until a spin is triggered

  @TC-E2E-BET-002
  Scenario: Decreasing bet level with the − button updates the BET display
    Given the current total bet shown in the BET field is "$1.00"
    When the player clicks the "−" bet adjustment button
    Then the BET field updates to the previous bet level (e.g., "$0.50")
    And the SPIN button remains enabled

  @TC-E2E-BET-003
  Scenario: Bet controls are disabled during an active spin
    Given the player has pressed the SPIN button and a spin is in flight
    When the animation sequence is playing
    Then the "+" and "−" bet adjustment buttons are visually disabled
    And clicking either bet button produces no change to the BET display
    And both bet buttons re-enable once the spin and all animations complete

  @TC-E2E-BET-004
  Scenario: Minimum bet level — the − button becomes visually disabled
    Given the BET field shows the minimum allowed bet level
    When the player attempts to click the "−" bet button
    Then the "−" button appears greyed-out and does not respond to clicks
    And the BET field does not change

  @TC-E2E-BET-005
  Scenario: Maximum bet level — the + button becomes visually disabled
    Given the BET field shows the maximum allowed bet level
    When the player attempts to click the "+" bet button
    Then the "+" button appears greyed-out and does not respond to clicks
    And the BET field does not change

  # ---------------------------------------------------------------------------
  # Extra Bet interaction with bet display
  # ---------------------------------------------------------------------------

  @TC-E2E-BET-006
  Scenario: Extra Bet ON triples the displayed BET amount in orange text
    Given the current base bet is "$0.25"
    When the player toggles the EXTRA BET switch to ON
    Then the BET field updates to "$0.75" (3× the base bet)
    And the BET amount is displayed in orange text to signal the multiplied cost
    And the EXTRA BET toggle shows a gold glowing "ON" state with electric arc particles
    And the SPIN button remains enabled

  # ---------------------------------------------------------------------------
  # FG period — bet controls locked
  # ---------------------------------------------------------------------------

  @TC-E2E-BET-007
  Scenario: Bet adjustment controls are locked during Free Game mode
    Given the player has entered Free Game mode
    When the player attempts to click the "+" or "−" bet buttons
    Then both buttons are visually disabled and unresponsive
    And the BET field shows the bet that was active when the Free Game was triggered
    And a lock indicator or tooltip communicates that bet changes are not allowed during FG
