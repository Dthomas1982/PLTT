/**********************************************************************
 * PLTT Platform
 * Api.js
 * Version: 0.4.3.0
 *
 * Release:
 * - Stable Authentication Baseline
 * - Production player registration and recognition
 * - Removed temporary authentication diagnostics
 *
 * Status:
 * Authentication Complete
 **********************************************************************/

function registerPlayerServer(payload) {

  if (!payload) {
    return errorResponse("No registration data received.");
  }

  return registerPlayer(
    payload.displayName,
    payload.playerCode,
    payload.mobile
  );

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
