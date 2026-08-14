/**********************************************************************
 * PLTT Platform
 * Api.js
 * Version: 0.4.2.1
 *
 * F001 - Player Registration
 * F002 - Player Recognition
 *
 * Player Code is the player's permanent login identity.
 * Browser localStorage is used only for convenience; the Players sheet
 * remains the source of truth.
 **********************************************************************/

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

function authenticatePlayerServer(playerCode) {

  if (!playerCode) {
    return errorResponse("No Player Code supplied.");
  }

  const cleanedCode = cleanPlayerCode(playerCode);

  if (!isValidPlayerCode(cleanedCode)) {
    return errorResponse("Invalid Player Code.");
  }

  return authenticatePlayer(cleanedCode);

}

function continuePlayerServer(playerCode) {

  return authenticatePlayerServer(playerCode);

}

function logoutPlayerServer() {

  return successResponse("Logged out.");

}

function pingServer() {

  return successResponse("PLTT API Online", {
    version: APP.VERSION,
    season: APP.SEASON
  });

}
