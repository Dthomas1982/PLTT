/**********************************************************************
 * PLTT Platform
 * PredictionAPI.js
 * Version: 0.6.1
 *
 * Release:
 * - Prediction API
 * - Browser / Server Bridge
 * - Prediction Centre Services
 * - Automatic payment record creation on successful submission
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

      const predictionSetID =
        result.data && result.data.predictionSetID
          ? result.data.predictionSetID
          : "";

      if (!predictionSetID) {
        return errorResponse(
          "Predictions were saved, but the Prediction Set ID could not be confirmed."
        );
      }

      // Create the £10 payment record once for this Player/Gameweek.
      // The payment function is duplicate-safe, so saving/editing the
      // predictions again before the deadline will not create another charge.
      try {

        createPaymentRecordForSubmission(
          playerID,
          gameweekID,
          predictionSetID
        );

      } catch (paymentError) {

        logAction(
          FEATURES.PAYMENT,
          "CREATE_ERROR",
          playerID,
          paymentError.message
        );

        return errorResponse(
          "Predictions were saved, but the payment record could not be created: " +
          paymentError.message
        );
      }

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
