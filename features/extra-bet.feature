@extra-bet
Feature: Extra Bet Mechanics — POST /v1/spin with extraBet=true
  As a player
  I want to enable Extra Bet to guarantee a Scatter symbol appears in the grid
  So that I pay 3× baseBet per spin and increase my Thunder Blessing and Free Game trigger rate

  Background:
    Given a player "player_001" exists with balance 1000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"
    And the slot game is configured with standard bet levels
    And no active FG session exists for "player_001"

  # ─────────────────────────────────────────────
  # Happy Path
  # ─────────────────────────────────────────────

  @smoke @TC-UNIT-EXBT-001-HAPPY
  Scenario: Extra Bet ON deducts 3× baseBet from player balance
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.totalBet" should equal 1.50
    And the response body field "data.baseBet" should equal 0.50
    And the response body field "data.extraBetActive" should be true
    And the player balance should be decreased by exactly 1.50 USD
    And the "spins" table should have extra_bet_active set to true for this spin

  @TC-UNIT-EXBT-002-HAPPY
  Scenario: Extra Bet ON with natural SC in grid preserves it without forced injection
    Given the player balance is 1000.00 USD
    And the RNG seed produces a grid that naturally contains SC in the visible 3 rows
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.initialGrid" should contain at least one "SC" symbol in rows 0 to 2
    And the response body field "data.extraBetActive" should be true

  @TC-UNIT-EXBT-003-HAPPY
  Scenario: Extra Bet ON without natural SC forces SC injection into visible grid
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-009"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.extraBetActive" should be true
    And the response body field "data.initialGrid" should contain exactly one "SC" symbol in rows 0 to 2

  @TC-UNIT-EXBT-004-HAPPY
  Scenario: Extra Bet OFF spin uses standard mainGame weights and standard baseBet cost
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.totalBet" should equal 0.50
    And the response body field "data.extraBetActive" should be false
    And the player balance should be decreased by exactly 0.50 USD

  @TC-UNIT-EXBT-005-HAPPY @TC-INT-BUYF-002-HAPPY
  Scenario: Extra Bet ON combined with Buy Feature deducts 300× baseBet
    Given the player balance is 5000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | true       |
    Then the response status should be 200
    And the response body field "data.totalBet" should equal 150.00
    And the response body field "data.extraBetActive" should be true
    And the response body field "data.buyFeatureActive" should be true
    And the player balance should be decreased by exactly 150.00 USD
    And the response body field "data.sessionFloorValue" should equal 30.00
