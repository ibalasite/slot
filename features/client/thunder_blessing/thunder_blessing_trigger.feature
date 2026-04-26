@client @thunder_blessing @animation
Feature: Thunder Blessing Scatter Trigger — UI Behavior
  As a player watching a Thunder Blessing event
  I want to see the full visual sequence of Scatter landing, arc connection, and symbol upgrade
  So that I understand what just happened and feel the magnitude of the event

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the reel contains at least one Lightning Mark before the spin

  # ---------------------------------------------------------------------------
  # Happy Path — full Thunder Blessing sequence
  # ---------------------------------------------------------------------------

  @TC-E2E-TB-001
  Scenario: SC symbol lands and activates the Thunder Blessing visual sequence
    Given the spin result includes an SC (Scatter) symbol landing on the grid
    And the grid has one or more Lightning Marks present
    When the SC symbol settles into its reel position
    Then the SC symbol displays its "Idle" electric arc rotation animation
    And after approximately 0.2 s all Lightning Marks on the grid begin flashing simultaneously
    And blue-white electric arc lines visually connect the SC symbol to each marked cell

  @TC-E2E-TB-002
  Scenario: Thunder Blessing first hit — marked cells explode and symbols upgrade
    Given the Thunder Blessing activation sequence has begun (arcs connecting SC to marks)
    When approximately 0.8 s after SC landing the first hit triggers
    Then all Lightning Mark cells burst with a gold explosion particle effect
    And the background flashes briefly white (approximately 0.3 s)
    And each marked cell's symbol shatters into fragments ("碎片化" effect)
    And a new upgraded symbol assembles itself at each previously marked cell
    And the WIN field begins updating to reflect any newly formed winning combinations

  @TC-E2E-TB-003
  Scenario: Thunder Blessing second hit — symbol tier upgrades visually (when triggered)
    Given the Thunder Blessing first hit has completed
    And the game outcome data includes a second hit event
    When approximately 1.5 s after the first hit the second pulse fires
    Then the SC symbol icon emits a golden wave that spreads across the entire reel
    And each upgraded symbol from the first hit plays a further tier-upgrade animation
    And the new tier symbol appears with a bright flash (scale 0 → 1.05 → 1.0, ~0.5 s)
    And the WIN field updates again with the second-hit win contribution

  @TC-E2E-TB-004
  Scenario: Thunder Blessing sequence ends and payline evaluation resumes
    Given the full Thunder Blessing sequence (one or two hits) has played out
    When all upgrade animations have completed
    Then the reel grid displays the final upgraded symbols in their settled positions
    And any winning paylines are highlighted with gold lines
    And the WIN counter shows the total cumulative win
    And the game continues to the next cascade evaluation step if applicable

  # ---------------------------------------------------------------------------
  # Edge Cases
  # ---------------------------------------------------------------------------

  @TC-E2E-TB-005
  Scenario: SC lands but no Lightning Marks are present — no Thunder Blessing fires
    Given the reel has zero Lightning Marks before the spin
    And the spin result contains an SC symbol
    When all reel columns stop
    Then the SC symbol displays its idle electric arc animation
    And no Thunder Blessing activation sequence plays
    And no arc lines connect the SC symbol to any cells
    And the game proceeds with normal payline evaluation

  @TC-E2E-TB-006
  Scenario: Multiple SC symbols on the grid — Thunder Blessing still fires once
    Given the spin result places SC symbols at two different reel positions
    And the grid has Lightning Marks present
    When the Thunder Blessing sequence fires
    Then the visual sequence plays from the first SC symbol as the focal point
    And all Lightning Marks are addressed in a single unified arc burst
    And the Thunder Blessing sequence does not repeat a second time independently
