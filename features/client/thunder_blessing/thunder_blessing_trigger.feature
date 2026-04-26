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
    And each arc line animates from the SC outward to the Lightning Mark cell (~0.3 s per arc)

  @TC-E2E-TB-002
  Scenario: Thunder Blessing dual-hit — each Lightning Mark cell upgrades to a premium symbol
    Given the SC symbol has landed and arc lines connect to all Lightning Mark cells
    When the arc animation reaches each Lightning Mark cell
    Then each marked cell displays a burst flash effect (white → gold, ~0.2 s)
    And each Lightning Mark is replaced by an upgraded premium symbol (P1, P2, P3, or P4)
    And the upgrade animation plays sequentially from left-to-right, top-to-bottom
    And the SC symbol dims slightly after all arc connections complete

  @TC-E2E-TB-003
  Scenario: Thunder Blessing completes and payline evaluation resumes
    Given all Lightning Marks have been upgraded by the Thunder Blessing dual-hit
    When all symbol upgrade animations finish
    Then the reel grid displays the upgraded premium symbols in their settled positions
    And any winning paylines that include the upgraded symbols are highlighted with gold lines
    And the WIN counter increments to reflect the total cumulative win including upgraded symbols
    And the game proceeds to the next cascade evaluation step

  @TC-E2E-TB-004
  Scenario: Multiple Lightning Marks upgraded in a single Thunder Blessing event
    Given the grid has three Lightning Marks at different row and column positions
    And an SC symbol lands anywhere on the grid
    When the Thunder Blessing sequence fires
    Then three separate arc lines emanate from the SC symbol simultaneously
    And all three Lightning Mark cells upgrade to premium symbols in sequence
    And the WIN counter updates once after all three upgrades complete
    And the Thunder Blessing sequence does not repeat a second time

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
