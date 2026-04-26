@security
Feature: Security Constraints — Authentication, Authorization, and Injection Prevention
  As a security engineer
  I want to verify that all API endpoints enforce JWT authentication, reject manipulated bets, and prevent injection attacks
  So that the game backend is protected against unauthorized access and financial manipulation

  Background:
    Given a player "player_001" exists with balance 1000.00 USD
    And the player has a valid RS256 JWT token with sub "player_001"
    And the slot game is configured with standard bet levels

  # ─────────────────────────────────────────────
  # JWT Authentication Required on All Endpoints
  # ─────────────────────────────────────────────

  @TC-SEC-AUTH-001
  Scenario: POST /v1/spin requires JWT — missing Authorization header returns 401
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

  @TC-SEC-AUTH-001
  Scenario: GET /v1/session/:sessionId requires JWT — missing Authorization header returns 401
    Given no Authorization header is included
    When I send GET /v1/session/sess-abc123 without any Authorization header
    Then the response status should be 401
    And the response body field "code" should equal "UNAUTHORIZED"

  @TC-SEC-AUTH-001
  Scenario: GET /v1/config requires JWT — missing Authorization header returns 401
    Given no Authorization header is included
    When I send GET /v1/config without any Authorization header
    Then the response status should be 401
    And the response body field "code" should equal "UNAUTHORIZED"

  # ─────────────────────────────────────────────
  # Expired JWT
  # ─────────────────────────────────────────────

  @TC-SEC-AUTH-003
  Scenario: Expired JWT is rejected with 401 UNAUTHORIZED on spin endpoint
    Given the player has a JWT token with exp claim set 60 seconds in the past
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 401
    And the response body field "success" should be false
    And the response body field "code" should equal "UNAUTHORIZED"
    And the player balance should remain unchanged

  # ─────────────────────────────────────────────
  # Invalid JWT Signature
  # ─────────────────────────────────────────────

  @TC-SEC-AUTH-004
  Scenario: JWT with tampered sub claim is rejected with 401 UNAUTHORIZED
    Given the player holds a JWT where the sub claim has been modified after signing
    When I send POST /v1/spin with the tampered JWT
    Then the response status should be 401
    And the response body field "code" should equal "UNAUTHORIZED"

  @TC-SEC-AUTH-002
  Scenario: JWT signed with HS256 algorithm instead of RS256 is rejected with 401
    Given the player holds a JWT signed using HS256 algorithm
    When I send POST /v1/spin with the HS256-signed JWT
    Then the response status should be 401
    And the response body field "code" should equal "UNAUTHORIZED"

  # ─────────────────────────────────────────────
  # Server totalWin is Authoritative
  # ─────────────────────────────────────────────

  @TC-SEC-BET-003
  Scenario: Server totalWin is the sole accounting authority — client cannot inject a higher value
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 5          |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 200
    And the player balance update should equal exactly "previous balance minus totalBet plus data.totalWin"
    And the "spins" table record "total_win" should equal "data.totalWin" from the response
    And no client-provided win value should affect the wallet credit amount

  # ─────────────────────────────────────────────
  # Bet Manipulation Prevention
  # ─────────────────────────────────────────────

  @TC-SEC-BET-001
  Scenario: Bet amount not in allowed bet levels is rejected with 400 INVALID_BET_LEVEL
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with body:
      | playerId   | player_001 |
      | betLevel   | 9999       |
      | currency   | USD        |
      | extraBet   | false      |
      | buyFeature | false      |
    Then the response status should be 400
    And the response body field "code" should equal "INVALID_BET_LEVEL"
    And the player balance should remain unchanged

  Scenario: betLevel as a non-integer string fails JSON schema validation with 400 VALIDATION_ERROR
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with betLevel set to "abc" as a string value
    Then the response status should be 400
    And the response body field "code" should equal "VALIDATION_ERROR"
    And the player balance should remain unchanged

  # ─────────────────────────────────────────────
  # Rate Limiting
  # ─────────────────────────────────────────────

  @TC-INT-API-008-ERROR @performance
  Scenario: More than 5 spin requests per second from one player returns 429 RATE_LIMITED
    Given the player has a valid JWT token
    When I send 6 POST /v1/spin requests within a 1-second window for "player_001"
    Then the 6th response status should be 429
    And the response body field "success" should be false
    And the response body field "code" should equal "RATE_LIMITED"
    And the response header "Retry-After" should be present and contain a positive integer

  # ─────────────────────────────────────────────
  # Injection Prevention
  # ─────────────────────────────────────────────

  Scenario: SQL injection attempt in betLevel is rejected with 400 VALIDATION_ERROR
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with betLevel set to "1; DROP TABLE players;--"
    Then the response status should be 400
    And the response body field "code" should equal "VALIDATION_ERROR"
    And the "players" table should still exist and be queryable
    And the player balance should remain unchanged

  Scenario: NoSQL injection attempt in sessionId is rejected with 400 VALIDATION_ERROR
    Given the player balance is 1000.00 USD
    When I send POST /v1/spin with sessionId set to the object {"$gt": ""}
    Then the response status should be 400
    And the response body field "code" should equal "VALIDATION_ERROR"

  # ─────────────────────────────────────────────
  # CORS Policy
  # ─────────────────────────────────────────────

  @TC-SEC-CORS-001
  Scenario: Access-Control-Allow-Origin does not return wildcard in production responses
    When I send a POST /v1/spin request from an untrusted cross-origin
    Then the response header "Access-Control-Allow-Origin" should not equal "*"
    And the response header "Access-Control-Allow-Origin" should be restricted to a configured allowlist

  @TC-SEC-CORS-001
  Scenario: GET /v1/config does not return CORS wildcard in production
    When I send a GET /v1/config request from an untrusted cross-origin
    Then the response header "Access-Control-Allow-Origin" should not equal "*"

  # ─────────────────────────────────────────────
  # Cross-Player Authorization
  # ─────────────────────────────────────────────

  Scenario: Player A cannot access an FG session belonging to Player B
    Given a player "player_002" has a valid JWT token
    And an active FG session "sess-belongs-to-player001" exists belonging to "player_001"
    When player "player_002" sends GET /v1/session/sess-belongs-to-player001 with their JWT
    Then the response status should be 403
    And the response body field "code" should equal "FORBIDDEN"
