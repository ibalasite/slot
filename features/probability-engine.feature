@probability-engine
Feature: Probability Engine — Server-Side RTP and Config Validation
  As a QA engineer
  I want to verify that the probability engine loads correct configuration and applies accurate probabilities
  So that the game's RTP and mechanical boundaries conform to design specifications

  Background:
    Given the slot engine is initialized with GameConfig.generated.ts
    And the verify.js gate has passed for all 4 scenario configurations

  # ─────────────────────────────────────────────
  # GameConfig Loading
  # ─────────────────────────────────────────────

  @smoke @TC-UNIT-PROB-001-HAPPY
  Scenario: GameConfig loads successfully with valid RTP parameters for all 4 scenarios
    Given the engine_config.json file is present and has passed verify.js
    When the slot engine loads GameConfig.generated.ts at startup
    Then the game configuration should load without errors
    And the mainGame symbol weight table should have total weight equal to 90
    And the extraBet symbol weight table should have total weight equal to 90
    And the freeGame symbol weight table should have total weight equal to 90
    And the buyFG symbol weight table should have total weight equal to 90
    And the coinProbs array should equal [0.80, 0.68, 0.56, 0.48, 0.40]
    And the fgMultipliers array should equal [3, 7, 17, 27, 77]
    And the mgFgTriggerProb should equal 0.009624
    And the tbSecondHit probability should equal 0.40
    And the buyFGMinWin should equal 20

  @TC-UNIT-PROB-002-BOUNDARY
  Scenario: All 4 scenario configs load without validation errors and are isolated
    Given the engine_config.json file contains configurations for Main, ExtraBet, BuyFG, and EBBuyFG
    When the slot engine validates all 4 scenario symbol weight tables
    Then the mainGame symbol weights should not contain any entries from extraBet weights
    And the extraBet symbol weights should not contain any entries from freeGame weights
    And the freeGame symbol weights should not contain any entries from buyFG weights
    And no scenario's symbol weights should reference another scenario's weight table
    And loading all 4 configs should produce 0 validation errors

  @TC-UNIT-PROB-003-ERROR
  Scenario: verify.js gate rejects invalid config before engine generation
    Given an engine_config.json with a missing "fgMults" field
    When verify.js is executed against the invalid config
    Then verify.js should exit with a non-zero exit code
    And verify.js output should contain a descriptive error referencing "fgMults"
    And engine_generator.js should not execute
    And GameConfig.generated.ts should not be updated

  # ─────────────────────────────────────────────
  # FG Multiplier Sequence
  # ─────────────────────────────────────────────

  @TC-UNIT-FG-001-HAPPY @TC-UNIT-FG-004-BOUNDARY
  Scenario: FG multiplier sequence is correct and terminates at 77×
    Given a Buy Feature spin is triggered with RNG seed "seed-006"
    When the FreeGameOrchestrator runs all 5 guaranteed Heads rounds
    Then fgRounds[0].multiplier should equal 3
    And fgRounds[1].multiplier should equal 7
    And fgRounds[2].multiplier should equal 17
    And fgRounds[3].multiplier should equal 27
    And fgRounds[4].multiplier should equal 77
    And no FG round should have a multiplier value other than 3, 7, 17, 27, or 77
    And the maximum multiplier should be 77 regardless of additional Heads results

  @TC-UNIT-FG-003-HAPPY
  Scenario: FG bonus multiplier is drawn once before round 1 and is identical in all rounds
    Given a FG sequence is triggered with at least 2 rounds
    When the FreeGameOrchestrator executes the FG sequence
    Then fgBonusMultiplier in the FullSpinOutcome should be one of 1, 5, 20, or 100
    And every fgRound object's "bonusMultiplier" field should equal the top-level "fgBonusMultiplier" value
    And the bonus multiplier should not change between FG rounds within the same sequence

  # ─────────────────────────────────────────────
  # Coin Toss Probabilities
  # ─────────────────────────────────────────────

  @TC-UNIT-COIN-003-BOUNDARY @TC-UNIT-COIN-006-BOUNDARY
  Scenario: Coin Toss probabilities are correct for each FG stage
    Given the CoinTossEvaluator is loaded with GameConfig coinProbs
    When the evaluator is queried for stage probabilities
    Then stage 0 (FG entry) probability should equal 0.80
    And stage 1 (multiplier ×7) probability should equal 0.68
    And stage 2 (multiplier ×17) probability should equal 0.56
    And stage 3 (multiplier ×27) probability should equal 0.48
    And stage 4 (multiplier ×77) probability should equal 0.40
    And an RNG value strictly less than the stage probability should yield "HEADS"
    And an RNG value equal to or greater than the stage probability should yield "TAILS"

  @TC-UNIT-COIN-004-HAPPY
  Scenario: Buy Feature mode always returns HEADS regardless of RNG value at entry
    Given the CoinTossEvaluator is configured with entryBuy probability 1.00
    When the evaluator is called in buyFG mode with any RNG value between 0 and 1
    Then the result should always be "HEADS"
    And mgFgTriggerProb check should be bypassed entirely

  @TC-UNIT-FG-002-HAPPY
  Scenario: FG bonus multiplier draw respects weight distribution
    Given the FreeGameOrchestrator's drawBonusMultiplier function
    When 10000 bonus multiplier draws are executed with random RNG values
    Then approximately 90.0% of draws should return multiplier 1
    And approximately 8.0% of draws should return multiplier 5
    And approximately 1.5% of draws should return multiplier 20
    And approximately 0.5% of draws should return multiplier 100
    And no draw should return a value outside the set 1, 5, 20, 100
