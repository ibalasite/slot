@buy-feature
Feature: POST /v1/spin with buyFeature=true — Buy Feature Mechanics
  As a player
  I want to purchase Free Game entry via buyFeature=true
  So that I bypass the main game and enter a guaranteed 5-round FG sequence with a session floor guarantee

  Background:
    Given a player "player_001" exists with balance 5000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"
    And the slot game is configured with standard bet levels
    And no active FG session exists for "player_001"

  # ─────────────────────────────────────────────
  # Happy Path — Buy Feature
  # ─────────────────────────────────────────────

  @smoke @contract @TC-INT-API-009-HAPPY @TC-INT-BUYF-001-HAPPY
  Scenario: Buy Feature with sufficient balance triggers guaranteed 5-round FG sequence
    Given the player balance is 5000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | true       |
    Then the response status should be 200
    And the response body field "success" should be true
    And the response body field "data.totalBet" should equal 50.00
    And the response body field "data.baseBet" should equal 0.50
    And the response body field "data.buyFeatureActive" should be true
    And the response body field "data.fgTriggered" should be true
    And the response body field "data.fgRounds" should have exactly 5 elements
    And each FG round's "coinTossResult" should equal "HEADS" for rounds 1 through 5
    And the FG multiplier sequence across rounds should be 3, 7, 17, 27, 77
    And the response body field "data.sessionFloorApplied" should be true
    And the response body field "data.sessionFloorValue" should equal 10.00
    And the player balance should be decreased by exactly 50.00 USD
    And the "spins" table should have buy_feature_active set to true for this spin

  @TC-INT-BUYF-002-HAPPY
  Scenario: Extra Bet ON plus Buy Feature deducts 300× baseBet combined cost
    Given the player balance is 5000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | true       |
    Then the response status should be 200
    And the response body field "data.totalBet" should equal 150.00
    And the response body field "data.baseBet" should equal 0.50
    And the response body field "data.extraBetActive" should be true
    And the response body field "data.buyFeatureActive" should be true
    And the response body field "data.fgRounds" should have exactly 5 elements
    And the response body field "data.sessionFloorValue" should equal 30.00
    And the player balance should be decreased by exactly 150.00 USD

  @TC-INT-BUYF-003-HAPPY @TC-UNIT-FLOOR-001-HAPPY
  Scenario: Buy Feature session floor guarantees totalWin is at least 20× baseBet
    Given the player balance is 5000.00 USD
    And the RNG seed is set to "seed-008"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | true       |
    Then the response status should be 200
    And the response body field "data.fgTriggered" should be true
    And the response body field "data.totalWin" should be greater than or equal to 10.00
    And the response body field "data.sessionFloorApplied" should be true
    And the response body field "data.sessionFloorValue" should equal 10.00
    And the "spins" table record should have session_floor_applied set to true

  # ─────────────────────────────────────────────
  # Error Scenarios
  # ─────────────────────────────────────────────

  @TC-INT-BUYF-002
  Scenario: Buy Feature with insufficient balance returns 400 INSUFFICIENT_FUNDS
    Given the player balance is 40.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | true       |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "INSUFFICIENT_FUNDS"
    And the player balance should remain 40.00 USD
    And no new record should be inserted into the "spins" table

  @TC-INT-BUYF-003
  Scenario: Extra Bet ON + Buy Feature insufficient balance for 300× returns 400 INSUFFICIENT_FUNDS
    Given the player balance is 100.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | true       |
      | buyFeature | true       |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "INSUFFICIENT_FUNDS"
    And the player balance should remain 100.00 USD

  @TC-INT-BUYF-004
  Scenario: Buy Feature rejected due to jurisdiction restriction returns 400 BUY_FEATURE_NOT_ALLOWED
    Given the game configuration has buyFeature disabled for the current jurisdiction
    And the player balance is 5000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | true       |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "BUY_FEATURE_NOT_ALLOWED"
    And the player balance should remain unchanged
