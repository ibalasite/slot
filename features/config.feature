@config
Feature: GET /v1/config — Game Configuration
  As a player or operator
  I want to retrieve the current game configuration
  So that I can see valid bet levels, currency ranges, and game parameters before placing a bet

  Background:
    Given a player "player_001" exists with balance 1000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"

  # ─────────────────────────────────────────────
  # Happy Path
  # ─────────────────────────────────────────────

  @smoke @contract @TC-INT-API-014-HAPPY @TC-INT-CURR-001-HAPPY
  Scenario: Config endpoint returns BetRangeConfig with USD and TWD bet ranges
    When I send GET /v1/config with valid JWT for "player_001"
    Then the response status should be 200
    And the response body field "success" should be true
    And the response body field "data" should contain a bet range configuration
    And the response body field "data.currencies" should contain "USD"
    And the response body field "data.currencies" should contain "TWD"
    And the response body field "data.betRanges" should be a non-empty object
    And the response body field "data.engineVersion" should be a non-empty string

  @TC-INT-CURR-001-HAPPY
  Scenario: Config returns correct USD bet level range with min $0.10 and max $10.00
    When I send GET /v1/config with valid JWT for "player_001"
    Then the response status should be 200
    And the USD bet range should have at least 1 bet level
    And the USD bet range minimum baseBet should equal 0.10
    And the USD bet range maximum baseBet should equal 10.00
    And each USD bet level should be a positive number
    And the USD bet levels should be in ascending order

  @TC-INT-CURR-001-HAPPY
  Scenario: Config returns correct TWD bet level range with min 3 and max 600
    When I send GET /v1/config with valid JWT for "player_001"
    Then the response status should be 200
    And the TWD bet range should have at least 1 bet level
    And the TWD bet range minimum baseBet should equal 3
    And the TWD bet range maximum baseBet should equal 600
    And each TWD bet level should be a positive integer
    And the TWD bet levels should be in ascending order

  # ─────────────────────────────────────────────
  # Error Scenarios
  # ─────────────────────────────────────────────

  @TC-INT-API-015-ERROR @TC-SEC-AUTH-001
  Scenario: Config endpoint without JWT returns 401 UNAUTHORIZED
    Given no Authorization header is included
    When I send GET /v1/config without any Authorization header
    Then the response status should be 401
    And the response body field "success" should be false
    And the response body field "code" should equal "UNAUTHORIZED"
    And the response body field "message" should be a non-empty string
    And the response body field "requestId" should be a UUID string
