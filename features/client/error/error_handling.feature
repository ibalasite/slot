@client @error @disconnection
Feature: Error and Disconnection Handling — UI Behavior
  As a player experiencing a network error or server-side problem
  I want clear and recoverable error states in the game UI
  So that I am never left confused or stuck in an unresponsive game

  Background:
    Given the game client is fully loaded in a browser
    And the player is authenticated and the game is in IDLE state

  # ---------------------------------------------------------------------------
  # Network error during spin
  # ---------------------------------------------------------------------------

  @TC-E2E-ERR-001
  Scenario: Spin request times out — loading indicator then friendly error dialog
    Given the player clicks the SPIN button
    When the loading indicator has been visible for 500 ms with no reel result displayed
    Then a loading indicator (spinner) appears over the reel grid
    And the SPIN button remains disabled
    When the configured network timeout is exceeded (no response received)
    Then the loading indicator disappears
    And an error dialog appears with a stone-carved frame and gold border
    And the dialog displays a human-readable message such as "Connection lost. Please try again."
    And a "RETRY" or "OK" button is visible in the dialog
    And the SPIN button re-enables after the dialog is dismissed

  @TC-E2E-ERR-002
  Scenario: Retry after network error does not double-deduct balance
    Given an error dialog appeared after a spin timeout
    When the player dismisses the dialog and attempts another spin
    Then the BALANCE field reflects only one deduction (not two)
    And the second spin animation begins normally with no error dialog shown

  @TC-E2E-ERR-003
  Scenario: Server returns an error during spin — game shows error message and recovers
    Given the player clicks the SPIN button
    When an error state is detected and no spin result is rendered
    Then the reel animation stops or does not start
    And an error dialog appears with the relevant error description
    And the BALANCE field does not change (no deduction is visible to the player)
    And the SPIN button re-enables once the dialog is dismissed

  # ---------------------------------------------------------------------------
  # Disconnection during active animation
  # ---------------------------------------------------------------------------

  @TC-E2E-ERR-004
  Scenario: Connection drops mid-cascade — animation pauses and reconnect prompt shows
    Given a cascade animation sequence is actively playing
    When the network connection drops
    Then the current animation frame freezes (no further reel movement)
    And a "Connection Lost" overlay or banner appears
    And the SPIN button and all controls remain disabled
    When the connection is restored
    Then a reconnection overlay appears and a loading indicator is shown while the game attempts to reload the last round result
    And either the remaining animation plays out or an error dialog is shown if state cannot be recovered

  # ---------------------------------------------------------------------------
  # Concurrent spin rejection
  # ---------------------------------------------------------------------------

  @TC-E2E-ERR-005
  Scenario: Server rejects a duplicate spin attempt (concurrent lock)
    Given a spin is already in progress (SPIN button is disabled)
    When the player triggers a second spin attempt while a spin is already in progress
    Then an error dialog appears informing the player that the action could not be completed
    And an error dialog does not interrupt the currently playing animation
    And the BALANCE field does not show a double-deduction after the duplicate spin attempt

  # ---------------------------------------------------------------------------
  # Generic / unknown errors
  # ---------------------------------------------------------------------------

  @TC-E2E-ERR-006
  Scenario: Unrecognised server error code shows a generic error dialog
    Given the player clicks the SPIN button
    When an unexpected error state appears on screen
    Then a generic error dialog is displayed (stone-carved frame style, consistent with game UI)
    And the dialog shows only a human-readable message without any technical error codes or stack traces
    And the dialog has a dismissal button that returns the player to IDLE state

  @TC-E2E-ERR-007
  Scenario: BGM continues at reduced volume during error state
    Given the BGM_MAIN track is playing
    When an error dialog appears
    Then the BGM_MAIN track continues playing at a slightly reduced volume (−3 dB)
    And the BGM does not stop or cut to silence
    When the error dialog is dismissed
    Then the BGM volume returns to its normal level
