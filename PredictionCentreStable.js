/**********************************************************************
 * PLTT Platform
 * PredictionCentreStable.js
 *
 * Keeps the Prediction Centre on the Gameweek determined by the
 * Gameweeks sheet. The displayed Gameweek only advances when the next
 * Gameweek actually starts.
 **********************************************************************/

function getStablePredictionCentreData(playerID) {
  try {
    const settings = getWebsiteSettings();
    if (!settings) return errorResponse("Website settings not found.");

    const gameweekID = resolveAuthoritativeGameweekID() || settings.currentGameweek;
    if (!gameweekID) return errorResponse("No current Gameweek is available.");

    const fixtures = getGameweekFixturesByID(gameweekID);
    const predictionResult = playerID
      ? loadPlayerPredictions(playerID, gameweekID)
      : successResponse("No player.", []);

    const lockState = getGameweekLockState(gameweekID);
    const stableSettings = Object.assign({}, settings, {
      currentGameweek: gameweekID,
      CurrentGameweek: gameweekID
    });

    return successResponse("Prediction Centre Loaded", {
      settings: stableSettings,
      fixtures: fixtures,
      predictions: predictionResult && predictionResult.success
        ? (predictionResult.data || [])
        : [],
      gameweekID: gameweekID,
      locked: Boolean(lockState.locked),
      lockReason: lockState.reason || ""
    });
  } catch (err) {
    logAction(FEATURES.PREDICTION, "STABLE_LOAD_ERROR", playerID || "", err.message);
    return errorResponse(err.message);
  }
}

function saveStablePredictionsServer(playerID, predictions) {
  try {
    if (!playerID) return errorResponse("Player ID is required.");
    if (!validatePredictionSet(predictions)) return errorResponse("One or more predictions are invalid.");

    const gameweekID = resolveAuthoritativeGameweekID() || getCurrentGameweek();
    if (!gameweekID) return errorResponse("No current Gameweek is available.");

    return savePredictionSet(playerID, gameweekID, predictions);
  } catch (err) {
    logAction(FEATURES.PREDICTION, "STABLE_SAVE_ERROR", playerID || "", err.message);
    return errorResponse(err.message);
  }
}
