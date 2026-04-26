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
    And the Coin Toss overlay appears over the reel grid

  @TC-E2E-TB-002
  Scenario: Coin Toss HEADS path — multiplier wheel spins and is applied to Lightning Marks
    Given the SC symbol has landed and the Coin Toss overlay is active
    When the coin flip resolves to HEADS
    Then the multiplier wheel animation plays, spinning and decelerating to a final value
    And the selected multiplier (e.g., ×3, ×5, ×10, ×25, ×50, or ×100) is displayed prominently
    And the multiplier is applied to all active Lightning Mark positions
    And each Lightning Mark cell shows a gold burst effect as the multiplier is applied
    And the WIN field updates to reflect the multiplied win contribution from all marked cells

  @TC-E2E-TB-003
  Scenario: Coin Toss TAILS path — Lightning Marks convert to an upgraded symbol
    Given the SC symbol has landed and the Coin Toss overlay is active
    When the coin flip resolves to TAILS
    Then the coin dims with a blue-grey color shift and "NOT THIS TIME" text appears
    And each Lightning Mark position shows a "fragmentation" effect as the mark dissolves
    And each previously marked cell displays a converted upgraded symbol in its place
    And the Coin Toss overlay fades out and the game returns to normal payline evaluation

  @TC-E2E-TB-004
  Scenario: Thunder Blessing sequence ends and payline evaluation resumes
    Given the full Thunder Blessing Coin Toss sequence (HEADS or TAILS) has completed
    When all conversion or multiplier animations have finished
    Then the reel grid displays the final resulting symbols in their settled positions
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
