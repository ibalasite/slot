@spin
Feature: POST /v1/spin — Core Spin Mechanics
  As a player
  I want to execute a spin via POST /v1/spin
  So that I receive a complete FullSpinOutcome with correct accounting and game state

  Background:
    Given a player "player_001" exists with balance 1000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"
    And the slot game is configured with standard bet levels
    And no active FG session exists for "player_001"

  # ─────────────────────────────────────────────
  # Happy Path — Basic Spin
  # ─────────────────────────────────────────────

  @smoke @contract @TC-INT-API-001-HAPPY
  Scenario: Happy path spin with no special features triggered
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "success" should be true
    And the response body field "data.totalWin" should be a number greater than or equal to 0
    And the response body field "data.totalBet" should equal 0.50
    And the response body field "data.baseBet" should equal 0.50
    And the response body field "data.currency" should equal "USD"
    And the response body field "data.extraBetActive" should be false
    And the response body field "data.buyFeatureActive" should be false
    And the response body field "data.fgTriggered" should be false
    And the response body field "data.fgRounds" should be an empty array
    And the response body field "data.fgMultiplier" should be null
    And the response body field "data.fgBonusMultiplier" should be null
    And the response body field "data.totalFGWin" should be null
    And the response body field "data.initialGrid" should be a 3-row by 5-column array
    And the response body field "data.spinId" should match pattern "spin-[uuid]"
    And the response body field "data.sessionId" should match pattern "sess-[uuid]"
    And the player balance should be decreased by 0.50 USD
    And the "spins" table should have a new record with player_id "player_001" and bet_level 5

  @smoke @TC-UNIT-EXBT-004-HAPPY
  Scenario: Extra Bet OFF spin uses standard bet deduction and mainGame weights
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

  @contract @TC-UNIT-EXBT-001-HAPPY
  Scenario: Extra Bet ON spin deducts 3× baseBet and guarantees SC in grid
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
    And the response body field "data.initialGrid" should contain at least one "SC" symbol in rows 0 to 2
    And the player balance should be decreased by exactly 1.50 USD

  # ─────────────────────────────────────────────
  # Cascade Chain
  # ─────────────────────────────────────────────

  @TC-UNIT-CASC-001-HAPPY @TC-INT-API-010-HAPPY
  Scenario: Cascade chain executes multiple steps with correct balance after all cascades
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-002"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.cascadeSequence.steps" should have at least 3 elements
    And each cascade step should have an "index" field incrementing from 0
    And each cascade step should have a "stepWin" field greater than or equal to 0
    And each cascade step should have a "rows" field between 3 and 6
    And the response body field "data.cascadeSequence.totalWin" should equal the sum of all step "stepWin" values
    And the response body field "data.finalRows" should be between 3 and 6
    And the player balance should equal 1000.00 minus 0.50 plus data.totalWin

  @TC-UNIT-CASC-001-HAPPY
  Scenario: Lightning Marks accumulate correctly across multiple cascade steps
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-002"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.cascadeSequence.lightningMarks.count" should be greater than 0
    And each cascade step's "newLightningMarks" positions should not contain duplicates
    And the total accumulated lightning mark positions should not contain duplicate grid coordinates
    And the response body field "data.cascadeSequence.lightningMarks.positions" should be an array of objects with "row" and "col" fields

  # ─────────────────────────────────────────────
  # Thunder Blessing
  # ─────────────────────────────────────────────

  @TC-UNIT-TB-001-HAPPY
  Scenario: Thunder Blessing triggers when SC lands on a grid with Lightning Marks
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-003"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.thunderBlessingTriggered" should be true
    And the response body field "data.thunderBlessingFirstHit" should be true
    And the response body field "data.upgradedSymbol" should be one of "P1", "P2", "P3", "P4"
    And the response body field "data.thunderBlessingResult.convertedSymbol" should match "data.upgradedSymbol"
    And the response body field "data.thunderBlessingResult.marksConverted" should be a non-empty array
    And the response body field "data.thunderBlessingResult.firstHitApplied" should be true
    And the "spins" table should have thunder_blessing_triggered set to true for this spin

  @TC-UNIT-TB-002-HAPPY @TC-UNIT-TB-003-HAPPY
  Scenario: Thunder Blessing second hit applies when RNG is below 0.40 threshold
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-004"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.thunderBlessingTriggered" should be true
    And the response body field "data.thunderBlessingSecondHit" should be true
    And the response body field "data.thunderBlessingResult.secondHitApplied" should be true

  # ─────────────────────────────────────────────
  # Coin Toss
  # ─────────────────────────────────────────────

  @TC-UNIT-COIN-001-HAPPY @TC-INT-FG-001-HAPPY
  Scenario: Coin Toss triggers after grid reaches 6 rows with a cascade win
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-005"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.coinTossTriggered" should be true
    And the response body field "data.coinTossResult" should be one of "HEADS", "TAILS"
    And the response body field "data.finalRows" should equal 6

  @contract @TC-INT-FG-001-HAPPY
  Scenario: Coin Toss Heads triggers Free Game and returns FG rounds in single response
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-005"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.coinTossResult" should equal "HEADS"
    And the response body field "data.fgTriggered" should be true
    And the response body field "data.fgMultiplier" should be one of 3, 7, 17, 27, 77
    And the response body field "data.fgRounds" should have at least 1 element
    And the response body field "data.fgBonusMultiplier" should be one of 1, 5, 20, 100
    And the response body field "data.totalFGWin" should be a number greater than or equal to 0
    And each FG round should have fields "round", "multiplier", "bonusMultiplier", "grid", "cascadeSequence", "roundWin", "coinTossResult", "lightningMarksBefore", "lightningMarksAfter"

  # ─────────────────────────────────────────────
  # Free Game — Lightning Marks Across Rounds
  # ─────────────────────────────────────────────

  @TC-INT-FG-002-HAPPY
  Scenario: Lightning Marks accumulate and persist across Free Game rounds
    Given the player balance is 1000.00 USD
    And the RNG seed is set to "seed-006"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.fgTriggered" should be true
    And each fgRound[N+1].lightningMarksBefore.count should equal fgRound[N].lightningMarksAfter.count
    And the last FG round with coinTossResult "TAILS" should have "lightningMarksAfter.count" equal to 0

  # ─────────────────────────────────────────────
  # Error Scenarios
  # ─────────────────────────────────────────────

  @TC-INT-API-004-ERROR
  Scenario: Insufficient balance returns 400 INSUFFICIENT_FUNDS
    Given the player balance is 0.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "INSUFFICIENT_FUNDS"
    And the response body field "message" should be a non-empty string
    And the response body field "requestId" should be a UUID string
    And the player balance should remain 0.00 USD
    And no new record should be inserted into the "spins" table

  @TC-INT-API-005-ERROR
  Scenario: Invalid betLevel outside USD range returns 400 INVALID_BET_LEVEL
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 999        |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "INVALID_BET_LEVEL"

  @TC-INT-API-002-ERROR @TC-SEC-AUTH-001
  Scenario: Missing JWT returns 401 UNAUTHORIZED
    Given no Authorization header is included
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 401
    And the response body field "success" should be false
    And the response body field "code" should equal "UNAUTHORIZED"

  @TC-INT-API-003-ERROR @TC-SEC-AUTH-003
  Scenario: Expired JWT returns 401 UNAUTHORIZED
    Given the player has a JWT token with exp claim set 1 second in the past
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 401
    And the response body field "success" should be false
    And the response body field "code" should equal "UNAUTHORIZED"

  @TC-INT-API-006-ERROR
  Scenario: Invalid currency returns 400 INVALID_CURRENCY
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | EUR        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 400
    And the response body field "success" should be false
    And the response body field "code" should equal "INVALID_CURRENCY"

  @TC-INT-API-008-ERROR @performance
  Scenario: Rate limit exceeded returns 429 RATE_LIMITED
    Given the player has a valid JWT token
    When I send 6 POST /v1/spin requests within 1 second from player "player_001"
    Then the 6th response status should be 429
    And the response body field "success" should be false
    And the response body field "code" should equal "RATE_LIMITED"
    And the response header "Retry-After" should be present

  # ─────────────────────────────────────────────
  # Max Win Cap
  # ─────────────────────────────────────────────

  @TC-UNIT-MAXWIN-001-BOUNDARY
  Scenario: Main Game totalWin is capped at 30,000× baseBet
    Given the player balance is 50000.00 USD
    And the RNG seed is set to "seed-010"
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the response body field "data.totalWin" should be less than or equal to 15000.00
    And the "spins" table record for this spin should have total_win at most 15000.00

  # ─────────────────────────────────────────────
  # Concurrency and Infrastructure Error Scenarios
  # ─────────────────────────────────────────────

  @contract @security @TC-INT-API-011
  Scenario: Concurrent spin attempt returns 409 SPIN_IN_PROGRESS
    Given player "player_001" has an active spin in progress (spin lock held)
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 409
    And the response error code should be "SPIN_IN_PROGRESS"
    And the player balance should be unchanged

  @contract @TC-INT-API-012
  Scenario: Engine timeout results in 504 and compensating credit
    Given the spin engine is configured to time out after 2000ms
    And player "player_001" has balance 1000.00 USD
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 504
    And the response error code should be "ENGINE_TIMEOUT"
    And the "wallet_transactions" table should have a compensating credit of 1.00 for "player_001"

  @contract @TC-INT-API-013
  Scenario: Circuit breaker open returns 503 SERVICE_UNAVAILABLE
    Given the database circuit breaker is OPEN
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 503
    And the response error code should be "SERVICE_UNAVAILABLE"
    And the player balance should be unchanged

  @contract @security @TC-SEC-AUTH-005
  Scenario: Suspended player account is forbidden from spinning
    Given player "player_suspended" has account status "suspended"
    And player "player_suspended" has a valid JWT token
    When I send POST /v1/spin as "player_suspended" with betLevel 1 and extraBet false
    Then the response status should be 403
    And the response error code should be "FORBIDDEN"

  # ─────────────────────────────────────────────
  # Grid State and Cascade Mechanics (US-CASC-001)
  # ─────────────────────────────────────────────

  @contract @TC-INT-API-014
  Scenario: New main game spin starts with clean grid state
    Given player "player_001" completed a cascade sequence producing lightning marks
    When I send a new POST /v1/spin with betLevel 1 and extraBet false
    Then the response data.initialGrid should be an array with 3 rows
    And the response data.cascadeSequence.lightningMarks should be an empty array
    And the response data.cascadeSequence.steps should not be empty

  # ─────────────────────────────────────────────
  # Coin Toss Boundary (US-COIN-001/AC-5)
  # ─────────────────────────────────────────────

  @contract @TC-INT-API-015
  Scenario: Cascade expanding to 5 rows does not trigger Coin Toss
    Given the RNG seed "SEED_5ROWS_ONLY" is configured to produce a 5-row expansion
    And player "player_001" has balance 1000.00 USD
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 200
    And the response data.finalRows should equal 5
    And the response data.coinTossTriggered should be false
    And the response data.fgTriggered should be false

  # ─────────────────────────────────────────────
  # Thunder Blessing Scatter Conditions (US-TBSC-001)
  # ─────────────────────────────────────────────

  @contract @TC-INT-API-016
  Scenario: Scatter lands on grid with no lightning marks - Thunder Blessing not triggered
    Given the RNG seed "SEED_SC_NO_MARKS" produces a Scatter but no cascade wins
    And player "player_001" has balance 1000.00 USD
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 200
    And the response data.thunderBlessingTriggered should be false
    And the response data.lightningMarks should be an empty array

  @contract @TC-INT-API-017
  Scenario: Thunder Blessing second hit on P1 symbol does not cause tier overflow
    Given the RNG seed "SEED_P1_DOUBLE_HIT" forces all marks to P1 with second hit
    And player "player_001" has balance 1000.00 USD
    When I send POST /v1/spin with betLevel 1 and extraBet false
    Then the response status should be 200
    And the response data.thunderBlessingResult.upgradedSymbol should equal "P1"
    And the response data.thunderBlessingResult.secondHitApplied should be true
    And the response data.thunderBlessingResult.convertedSymbol should equal "P1"
