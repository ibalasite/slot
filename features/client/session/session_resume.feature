@client @session @reconnect
Feature: Session Resume — FG Reconnection UI Behavior
  As a player who was disconnected during Free Game
  I want the game to restore my FG session when I reconnect
  So that I do not lose my FG progress and can continue from where I left off

  Background:
    Given the game client is fully loaded in a browser
    And the player had previously been in an active Free Game session with multiplier ×7
    And the player's browser was closed or the connection dropped during Free Game

  # ---------------------------------------------------------------------------
  # Happy Path — successful session restore
  # ---------------------------------------------------------------------------

  @TC-E2E-SESS-001
  Scenario: Reconnecting mid-FG shows "Restoring Session..." loading indicator
    Given the player reopens the game while a Free Game session is stored on the server
    When the game client initialises and detects an active FG session
    Then the Free Game background (night sky temple) is displayed immediately
    And a rotating loading spinner appears in the center of the screen
    And the text "Restoring Session..." is visible in white (Open Sans, 18px) below the spinner
    And the SPIN button and all HUD controls are inaccessible during restore

  @TC-E2E-SESS-002
  Scenario: Successful restore — FG state is visually rebuilt from server data
    Given the "Restoring Session..." indicator is shown
    And a valid Free Game session is detected with multiplier ×7 and 2 accumulated Lightning Marks
    When the session restore completes successfully
    Then the loading spinner disappears
    And the FG multiplier display animates to ×7 using an Ease Out Cubic update (0.5 s)
    And the two Lightning Marks are redrawn on the grid at their correct positions
    And the Lightning Mark counter shows "⚡ × 2"
    And the SPIN COUNT label shows the most recently completed round number
    And the FG round resumes normally with auto-spin triggering the next FG spin

  @TC-E2E-SESS-003
  Scenario: Restored FG session continues with correct multiplier in HUD
    Given the FG session has been successfully restored with multiplier ×17
    When the player continues the Free Game
    Then the multiplier HUD label shows "×17" in gold-orange text with arc glow
    And the multiplier progress bar shows nodes ×3, ×7, and ×17 all filled in gold
    And the remaining nodes (×27, ×77) remain dimmed

  # ---------------------------------------------------------------------------
  # Error / Expired Session Flow
  # ---------------------------------------------------------------------------

  @TC-E2E-SESS-004
  Scenario: Expired session — game displays Session Expired dialog and returns to main game
    Given the player reopens the game after their JWT token has expired
    When the restore attempt fails and the session cannot be recovered
    Then the "Restoring Session..." indicator disappears
    And a "Session Expired" dialog appears with a stone-carved frame and gold border
    And the dialog text explains that the session could not be recovered
    And an "OK" or confirm button is visible in the dialog
    When the player clicks the confirm button
    Then the dialog closes
    And the scene transitions to the main game (dusk temple background)
    And the game is in IDLE state with the SPIN button enabled
    And no Lightning Marks appear on the grid (clean state)

  @TC-E2E-SESS-005
  Scenario: Reconnect loading screen does not block audio on first user interaction
    Given the player reopens the game and the "Restoring Session..." screen is shown
    When the player taps anywhere on the screen (first user gesture)
    Then the browser audio context is unlocked and audio playback becomes active
    And background music begins playing (BGM_FREE_GAME for active FG session)
    And the loading/restore sequence continues without interruption

  # ---------------------------------------------------------------------------
  # Auth Guard
  # ---------------------------------------------------------------------------

  @TC-E2E-SESS-006
  Scenario: No active session found — player is routed to main game without FG state
    Given the player opens the game with a valid JWT but no active FG session in the backend
    When the game client initialises and finds no active Free Game session
    Then no FG restore flow activates
    And the main game scene (dusk temple) loads directly
    And the game is in IDLE state
    And the SPIN button is enabled
    And the Lightning Mark counter is not visible (no marks present)
