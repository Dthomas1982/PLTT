/**********************************************************************
 * PLTT Platform
 * Api.js
 * Version: 0.3.2
 *
 * Feature:
 * F001 - Player Registration
 * F002 - Player Recognition
 *
 * Bridge between HTML (google.script.run)
 * and the business logic.
 **********************************************************************/

/**
 * Register a new player.
 * Called from JS.html.
 */
function registerPlayerServer(payload) {

  if (!payload) {
    return errorResponse("No registration data received.");
  }

  const result = registerPlayer(
    payload.displayName,
    payload.playerCode,
    payload.mobile
  );

  return result;

}

/**
 * Authenticate a player from their Player Code.
 * Used by automatic recognition.
 */
function authenticatePlayerServer(playerCode) {

  if (!playerCode) {
    return errorResponse("No Player Code supplied.");
  }

  return authenticatePlayer(playerCode);

}

/**
 * Continue with the currently recognised player.
 */
function continuePlayerServer(playerCode) {

  return authenticatePlayerServer(playerCode);

}

/**
 * Health check.
 */
function pingServer() {

  return successResponse("PLTT API Online", {
    version: APP.VERSION,
    season: APP.SEASON
  });

}