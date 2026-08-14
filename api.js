/**********************************************************************
 * PLTT Platform
 * Api.js
 * Version: 0.4.2.5
 *
 * F001 - Player Registration
 * F002 - Player Recognition
 *
 * Authentication diagnostics are recorded in Logs so browser login
 * requests can be traced end-to-end without exposing player data.
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

  const receivedCode = String(playerCode || "");
  const cleanedCode = cleanPlayerCode(receivedCode);

  traceAuthentication("AUTH_RECEIVED", cleanedCode || "<empty>", "START");

  try {

    if (!cleanedCode) {
      traceAuthentication("AUTH_RESULT", "<empty>", "NO_CODE");
      return errorResponse("No Player Code supplied.");
    }

    if (!isValidPlayerCode(cleanedCode)) {
      traceAuthentication("AUTH_RESULT", cleanedCode, "INVALID_CODE");
      return errorResponse("Invalid Player Code.");
    }

    const result = authenticatePlayer(cleanedCode);

    if (result && result.success) {
      traceAuthentication("AUTH_RESULT", cleanedCode, "SUCCESS");
    } else {
      traceAuthentication(
        "AUTH_RESULT",
        cleanedCode,
        result && result.message ? result.message : "FAILED"
      );
    }

    return result;

  } catch (err) {

    traceAuthentication("AUTH_ERROR", cleanedCode || "<empty>", err.message);
    return errorResponse("Unable to authenticate player.");

  }

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

function traceAuthentication(action, playerCode, result) {

  try {
    const safeCode = String(playerCode || "").trim().toUpperCase();

    getSheet(SHEETS.LOGS).appendRow([
      getCurrentTimestamp(),
      FEATURES.PLAYER,
      action,
      safeCode,
      String(result || "")
    ]);

  } catch (err) {
    console.error("Authentication trace failed: " + err.message);
  }

}

function testAuthenticatePlayerServer() {

  const result = authenticatePlayerServer("DAVS1");

  Logger.log(JSON.stringify(result, null, 2));

  return result;

}
