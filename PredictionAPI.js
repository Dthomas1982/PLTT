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

    const fixtures = getCurrentGameweekFixtures();

    let predictions = [];

    if (playerID) {

      const predictionResult = loadPlayerPredictions(
        playerID,
        settings.currentGameweek
      );

      if (
        predictionResult &&
        predictionResult.success
      ) {
        predictions = predictionResult.data || [];
      }
    }

    return successResponse(
      "Prediction Centre Loaded",
      {
        settings: settings,
        fixtures: fixtures,
        predictions: predictions
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

    return loadPlayerPredictions(
      playerID,
      settings.currentGameweek
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

    const result = savePredictionSet(
      playerID,
      settings.currentGameweek,
      predictions
    );

    if (result.success) {
      logAction(
        FEATURES.PREDICTION,
        "SAVE",
        playerID,
        settings.currentGameweek
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

    return clearPredictionSet(
      playerID,
      settings.currentGameweek
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
