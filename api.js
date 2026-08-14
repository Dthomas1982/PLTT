/**********************************************************************
 * PLTT Platform
 * Api.gs
 * Version: 0.3.0
 *
 * Bridge between HTML (google.script.run)
 * and the business logic in Players.gs
 **********************************************************************/

/**
 * Called from JS.html
 */
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

/**
 * Called when the user clicks
 * "Returning Player"
 */
function continuePlayerServer() {

  const cache = CacheService.getUserCache();

  const playerCode = cache.get("PLAYER_CODE");

  if (!playerCode) {
    return "";
  }

  const result = authenticatePlayer(playerCode);

  if (!result.success) {
    cache.remove("PLAYER_CODE");
    return "";
  }

  // Dashboard will come in F002
  return "dashboard";

}

/**
 * Save player's code after successful registration.
 * This prepares us for automatic recognition.
 */
function savePlayerSession(playerCode) {

  CacheService
    .getUserCache()
    .put("PLAYER_CODE", cleanPlayerCode(playerCode), 21600); // 6 hours

  return true;

}

/**
 * Clear current session.
 */
function logoutPlayer() {

  CacheService
    .getUserCache()
    .remove("PLAYER_CODE");

  return true;

}