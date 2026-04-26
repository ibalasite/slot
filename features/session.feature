@session
Feature: GET /v1/session/:sessionId — FG Session State
  As a player
  I want to retrieve my in-progress Free Game session state
  So that I can resume an interrupted FG sequence from the correct round, multiplier, and Lightning Mark positions

  Background:
    Given a player "player_001" exists with balance 1000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"
    And the slot game is configured with standard bet levels

  # ─────────────────────────────────────────────
  # Happy Path
  # ─────────────────────────────────────────────

  @smoke @contract @TC-INT-API-012-HAPPY
  Scenario: Active FG session returns correct session state
    Given an active FG session exists for "player_001" with session ID "sess-abc123"
    And the session has fg_multiplier 7
    And the session has fg_round 2
    And the session has 5 accumulated lightning marks
    And the session has bonus_multiplier 5
    When I send GET /v1/session/sess-abc123 with valid JWT for "player_001"
    Then the response status should be 200
    And the response body field "success" should be true
    And the response body field "data.sessionId" should equal "sess-abc123"
    And the response body field "data.playerId" should equal the player UUID for "player_001"
    And the response body field "data.status" should equal "FG_ACTIVE"
    And the response body field "data.fgMultiplier" should equal 7
    And the response body field "data.fgRound" should equal 2
    And the response body field "data.fgBonusMultiplier" should equal 5
    And the response body field "data.lightningMarks.count" should equal 5
    And the response body field "data.lightningMarks.positions" should be an array of 5 position objects
    And each position object should have integer fields "row" and "col"

  @TC-INT-API-012-HAPPY
  Scenario: Session returns correct FG round number and accumulated marks
    Given an active FG session exists for "player_001" with session ID "sess-def456"
    And the session has fg_multiplier 17
    And the session has fg_round 3
    And the session has 8 accumulated lightning marks
    When I send GET /v1/session/sess-def456 with valid JWT for "player_001"
    Then the response status should be 200
    And the response body field "data.status" should equal "FG_ACTIVE"
    And the response body field "data.fgMultiplier" should equal 17
    And the response body field "data.fgRound" should equal 3
    And the response body field "data.lightningMarks.count" should equal 8
    And the response body field "data.totalFGWin" should be a number greater than or equal to 0

  @TC-SEC-SESSION-001
  Scenario: Session expires after 300 seconds of inactivity and returns 404
    Given a FG session "sess-expired-001" was last updated more than 300 seconds ago for "player_001"
    And the Redis TTL for "sess-expired-001" has elapsed
    When I send GET /v1/session/sess-expired-001 with valid JWT for "player_001"
    Then the response status should be 404
    And the response body field "success" should be false
    And the response body field "code" should equal "SESSION_NOT_FOUND"

  # ─────────────────────────────────────────────
  # Error Scenarios
  # ─────────────────────────────────────────────

  @TC-INT-API-013-ERROR
  Scenario: Non-existent session ID returns 404 SESSION_NOT_FOUND
    Given no session exists with ID "sess-does-not-exist"
    When I send GET /v1/session/sess-does-not-exist with valid JWT for "player_001"
    Then the response status should be 404
    And the response body field "success" should be false
    And the response body field "code" should equal "SESSION_NOT_FOUND"
    And the response body field "message" should be a non-empty string
    And the response body field "requestId" should be a UUID string
    And the response body field "timestamp" should be a valid ISO 8601 datetime string

  @TC-INT-API-015-ERROR @TC-SEC-AUTH-001
  Scenario: Missing JWT on session endpoint returns 401 UNAUTHORIZED
    Given no Authorization header is included
    When I send GET /v1/session/sess-abc123 without any Authorization header
    Then the response status should be 401
    And the response body field "success" should be false
    And the response body field "code" should equal "UNAUTHORIZED"

  @contract @TC-SEC-AUTH-003
  Scenario: Player "player_002" cannot access session belonging to "player_001"
    Given a player "player_002" has a valid JWT token
    And an active FG session "sess-player001-session" exists belonging to "player_001"
    When player "player_002" sends GET /v1/session/sess-player001-session with their own JWT
    Then the response status should be 403
    And the response body field "success" should be false
    And the response body field "code" should equal "FORBIDDEN"
