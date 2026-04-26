@client @cascade @animation
Feature: Cascade Elimination — UI Animation Behavior
  As a player watching a cascade chain play out
  I want each elimination step to be visually distinct and sequential
  So that I can follow the cascade progress and feel the momentum building

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state
    And the reel grid currently shows a 5×3 layout

  # ---------------------------------------------------------------------------
  # Happy Path — cascade step sequence
  # ---------------------------------------------------------------------------

  @TC-E2E-CASC-001
  Scenario: Winning symbols explode and disappear before new symbols fall
    Given a spin result contains a winning combination on the 5×3 grid
    When the reel has fully stopped
    Then the winning symbols play their Win animation (glow, ~0.6 s)
    And the winning symbols then explode into metallic particles that fly outward
    And the vacant grid cells are clearly empty (transparent) after elimination
    And new symbols fall downward from above the reel into the empty cells
    And each new symbol plays a landing bounce animation (Ease Out Bounce)
    And the WIN field updates to show the cascade step's win contribution

  @TC-E2E-CASC-002
  Scenario: "CASCADE × N" floating label appears for each cascade step
    Given a cascade chain has at least two successive winning steps
    When the second cascade step's winning symbols are eliminated
    Then a gold "CASCADE × 2" floating label appears above the reel grid center
    And the label scales from 0.5× to 1.2× then settles at 1.0× size
    And the label fades out after approximately 0.5 seconds
    And for each subsequent step the number increments (CASCADE × 3, etc.)

  @TC-E2E-CASC-003
  Scenario: Multiple consecutive cascade rounds play sequentially without interruption
    Given a spin result produces a winning combination on the 5×3 grid
    When the first cascade step eliminates winning symbols and new symbols fall in
    And the new symbols form another winning combination
    And the second cascade step eliminates those symbols and new symbols fall in
    And the new symbols form a third winning combination
    Then three successive cascade elimination rounds have played out in sequence
    And the "CASCADE × 3" floating label appears above the reel grid center
    And the WIN field shows the cumulative total win from all three cascade steps
    And a cascade win sound plays for each elimination step

  @TC-E2E-CASC-004
  Scenario: New symbols fall from above into vacated cells after cascade elimination
    Given a cascade step has eliminated winning symbols leaving empty cells in the grid
    When the elimination animation completes
    Then new symbols enter from above the visible reel area
    And each new symbol falls downward into its vacated cell
    And each new symbol plays a landing bounce animation (Ease Out Bounce, ~0.3 s)
    And the symbols come to rest in the correct grid positions
    And the reel grid is fully populated with no empty cells after all symbols land

  @TC-E2E-CASC-005
  Scenario: Lightning Marks appear on eliminated winning positions after cascade
    Given a cascade step eliminates winning symbols at specific grid positions
    When the symbol explosion animation completes
    Then a golden lightning-bolt mark appears at each eliminated position (0.4 s scale-in animation)
    And each mark is overlaid on the newly fallen symbol at that cell (60% opacity)
    And the Lightning Mark counter in the top-right corner of the reel frame increments

  @TC-E2E-CASC-006
  Scenario: Lightning Mark counter shows electric arc effects at 3+ marks
    Given the reel has accumulated 2 Lightning Marks (gold steady counter)
    When a cascade step adds a third Lightning Mark
    Then the counter number updates to "3" with an electric arc flickering effect
    And the counter color shifts to orange-gold
    When the total mark count reaches 5 or more
    Then the counter background glows and pulses white-gold rhythmically

  # ---------------------------------------------------------------------------
  # Edge / Error Flows
  # ---------------------------------------------------------------------------

  @TC-E2E-CASC-007
  Scenario: Non-winning result after a cascade — animation sequence ends cleanly
    Given a cascade chain resolves with a step that produces no winning combination
    When the newly fallen symbols are in place and no paylines are active
    Then no WIN animation plays for that step
    And the WIN field shows the cumulative total from previous steps (not reset mid-cascade)
    And if all four FREE letters are lit the game transitions to Coin Toss
    And otherwise the reel remains static and the SPIN button re-enables

  @TC-E2E-CASC-008
  Scenario: Animation queue does not allow a new spin during cascade playback
    Given a cascade chain animation sequence is actively playing
    When the player attempts to click the SPIN button
    Then the SPIN button remains visually disabled and unresponsive
    And the SPIN button remains visually disabled and no reel movement occurs
    And the cascade animation completes without interruption
