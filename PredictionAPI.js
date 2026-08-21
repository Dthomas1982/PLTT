/**********************************************************************
 * PLTT Platform
 * PredictionAPI.js
 * Version: 0.5.3
 *
 * Release:
 * - Prediction API
 * - Browser / Server Bridge
 * - Prediction Centre Services
 *
 * Status:
 * Production
 **********************************************************************/

function getPredictionCentreData(playerID) {

  try {

    const settings = getWebsiteSettings();

    if (!settings) {
      return errorResponse("Website settings not found.");
    }

    // Keep the Prediction Centre on the authoritative Gameweek from the
    // Gameweeks sheet. This prevents the player's saved predictions from
    // disappearing simply because the Gameweek deadline has passed.
    const gameweekID =
      resolveAuthoritativeGameweekID() ||
      settings.currentGameweek;

    if (!gameweekID) {
      return errorResponse("No current Gameweek is available.");
    }

    const fixtures = getGameweekFixturesByID(gameweekID);

    let predictions = [];

    if (playerID) {

      const predictionResult = loadPlayerPredictions(
        playerID,
        gameweekID
      );

      if (
        predictionResult &&
        predictionResult.success
      ) {
        predictions = predictionResult.data || [];
      }
    }

    const lockState = getGameweekLockState(gameweekID);

    const stableSettings = Object.assign({}, settings, {
      currentGameweek: gameweekID,
      CurrentGameweek: gameweekID
    });

    return successResponse(
      "Prediction Centre Loaded",
      {
        settings: stableSettings,
        fixtures: fixtures,
        predictions: predictions,
        gameweekID: gameweekID,
        locked: Boolean(lockState.locked),
        lockReason: lockState.reason || ""
      }
    );

  } catch (err) {

    logAction(
      FEATURES.PREDICTION,
      "LOAD_ERROR",
      playerID || "",
      err.message
    );

    return errorResponse(err.message);
  }
}

function loadPredictionsServer(playerID) {

  try {

    if (!playerID) {
      return errorResponse("Player ID is required.");
    }

    const settings = getWebsiteSettings();

    if (!settings) {
      return errorResponse("Website settings not found.");
    }

    const gameweekID =
      resolveAuthoritativeGameweekID() ||
      settings.currentGameweek;

    return loadPlayerPredictions(
      playerID,
      gameweekID
    );

  } catch (err) {

    logAction(
      FEATURES.PREDICTION,
      "LOAD_ERROR",
      playerID || "",
      err.message
    );

    return errorResponse(err.message);
  }
}

function savePredictionsServer(playerID, predictions) {

  try {

    if (!playerID) {
      return errorResponse("Player ID is required.");
    }

    if (!validatePredictionSet(predictions)) {
      return errorResponse("One or more predictions are invalid.");
    }

    const settings = getWebsiteSettings();

    if (!settings) {
      return errorResponse("Website settings not found.");
    }

    const gameweekID =
      resolveAuthoritativeGameweekID() ||
      settings.currentGameweek;

    const result = savePredictionSet(
      playerID,
      gameweekID,
      predictions
    );

    if (result.success) {
      logAction(
        FEATURES.PREDICTION,
        "SAVE",
        playerID,
        gameweekID
      );
    }

    return result;

  } catch (err) {

    logAction(
      FEATURES.PREDICTION,
      "SAVE_ERROR",
      playerID || "",
      err.message
    );

    return errorResponse(err.message);
  }
}

function clearPredictionsServer(playerID) {

  try {

    if (!playerID) {
      return errorResponse("Player ID is required.");
    }

    const settings = getWebsiteSettings();

    if (!settings) {
      return errorResponse("Website settings not found.");
    }

    const gameweekID =
      resolveAuthoritativeGameweekID() ||
      settings.currentGameweek;

    return clearPredictionSet(
      playerID,
      gameweekID
    );

  } catch (err) {

    logAction(
      FEATURES.PREDICTION,
      "CLEAR_ERROR",
      playerID || "",
      err.message
    );

    return errorResponse(err.message);
  }
}

function testPredictionAPI() {

  const TEST_PLAYER = "P0001";

  const predictions = [
    {
      matchID: "M001",
      homePrediction: 2,
      awayPrediction: 1
    },
    {
      matchID: "M002",
      homePrediction: 1,
      awayPrediction: 1
    }
  ];

  Logger.log(
    JSON.stringify(
      getPredictionCentreData(TEST_PLAYER),
      null,
      2
    )
  );

  Logger.log(
    JSON.stringify(
      savePredictionsServer(TEST_PLAYER, predictions),
      null,
      2
    )
  );

  Logger.log(
    JSON.stringify(
      loadPredictionsServer(TEST_PLAYER),
      null,
      2
    )
  );
}
