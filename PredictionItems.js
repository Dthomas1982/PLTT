/**********************************************************************
 * PLTT Platform
 * PredictionItems.js
 * Version: 0.6.0
 *
 * Release:
 * - Prediction Save Engine
 * - Prediction Item Data Layer
 * - Google Sheets Persistence
 * - Automatic Payment Ledger creation
 *
 * Status:
 * Production
 **********************************************************************/

function getPlayerPredictionSet(playerID, gameweekID) {
  playerID = String(playerID || "").trim();
  gameweekID = String(gameweekID || "").trim();
  const sheet = getSheet(SHEETS.PREDICTIONSETS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[1]) === playerID && String(row[2]) === gameweekID && Boolean(row[5]) === true) {
      return { predictionSetID: String(row[0]), playerID: String(row[1]), gameweekID: String(row[2]), version: Number(row[3]), submitted: Boolean(row[4]), current: Boolean(row[5]) };
    }
  }
  return null;
}

function predictionSetExists(playerID, gameweekID) {
  return getPlayerPredictionSet(playerID, gameweekID) !== null;
}

function createPredictionSet(playerID, gameweekID) {
  const sheet = getSheet(SHEETS.PREDICTIONSETS);
  const predictionSetID = generateNextId(SHEETS.PREDICTIONSETS, "PS");
  sheet.appendRow([predictionSetID, playerID, gameweekID, 1, false, true]);

  // The first prediction set for a Gameweek creates exactly one financial ledger entry.
  createPaymentForPredictionSet(playerID, gameweekID, predictionSetID);

  logAction(FEATURES.PREDICTION, "CREATE_SET", playerID, predictionSetID);
  return { predictionSetID: predictionSetID, playerID: playerID, gameweekID: gameweekID, version: 1, submitted: false, current: true };
}

function getOrCreatePredictionSet(playerID, gameweekID) {
  let predictionSet = getPlayerPredictionSet(playerID, gameweekID);
  if (!predictionSet) predictionSet = createPredictionSet(playerID, gameweekID);
  return predictionSet;
}

function getPredictionItems(predictionSetID) {
  const sheet = getSheet(SHEETS.PREDICTIONITEMS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const items = [];
  values.forEach(function(row) {
    if (String(row[0]) !== String(predictionSetID)) return;
    items.push({ predictionSetID: String(row[0]), matchID: String(row[1]), homePrediction: row[2] === "" ? "" : Number(row[2]), awayPrediction: row[3] === "" ? "" : Number(row[3]) });
  });
  return items;
}

function deletePredictionItems(predictionSetID) {
  const sheet = getSheet(SHEETS.PREDICTIONITEMS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) if (String(values[i][0]) === String(predictionSetID)) sheet.deleteRow(i + 2);
}

function validatePrediction(prediction) {
  if (!prediction) return false;
  const home = prediction.homePrediction, away = prediction.awayPrediction;
  if (home === "" || away === "") return true;
  if (!Number.isInteger(Number(home)) || !Number.isInteger(Number(away))) return false;
  if (Number(home) < 0 || Number(home) > 20 || Number(away) < 0 || Number(away) > 20) return false;
  return true;
}

function validatePredictionSet(predictions) {
  if (!Array.isArray(predictions)) return false;
  for (let i = 0; i < predictions.length; i++) if (!validatePrediction(predictions[i])) return false;
  return true;
}

function savePredictionItems(predictionSetID, predictions) {
  const sheet = getSheet(SHEETS.PREDICTIONITEMS);
  if (!Array.isArray(predictions)) throw new Error("Predictions must be an array.");
  for (let i = 0; i < predictions.length; i++) if (!validatePrediction(predictions[i])) throw new Error("Invalid prediction for Match " + predictions[i].matchID);
  deletePredictionItems(predictionSetID);
  if (predictions.length === 0) return;
  const rows = predictions.map(function(prediction) {
    return [predictionSetID, String(prediction.matchID), prediction.homePrediction === "" ? "" : Number(prediction.homePrediction), prediction.awayPrediction === "" ? "" : Number(prediction.awayPrediction)];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}

function savePredictionSet(playerID, gameweekID, predictions) {
  if (!validatePredictionSet(predictions)) return errorResponse("One or more predictions are invalid.");
  const predictionSet = getOrCreatePredictionSet(playerID, gameweekID);
  savePredictionItems(predictionSet.predictionSetID, predictions);
  logAction(FEATURES.PREDICTION, "SAVE_SET", playerID, predictionSet.predictionSetID);
  return successResponse("Predictions Saved", { predictionSetID: predictionSet.predictionSetID });
}

function loadPlayerPredictions(playerID, gameweekID) {
  const predictionSet = getPlayerPredictionSet(playerID, gameweekID);
  if (!predictionSet) return successResponse("No predictions found.", []);
  return successResponse("Predictions Loaded", getPredictionItems(predictionSet.predictionSetID));
}

function clearPredictionSet(playerID, gameweekID) {
  const predictionSet = getPlayerPredictionSet(playerID, gameweekID);
  if (!predictionSet) return successResponse("Nothing to clear.");
  deletePredictionItems(predictionSet.predictionSetID);
  logAction(FEATURES.PREDICTION, "CLEAR_SET", playerID, predictionSet.predictionSetID);
  return successResponse("Predictions Cleared");
}

function testPredictionItems() {
  const TEST_PLAYER = "P0001";
  const TEST_GAMEWEEK = "GW1";
  const predictions = [{ matchID: "M001", homePrediction: 2, awayPrediction: 1 }, { matchID: "M002", homePrediction: 0, awayPrediction: 0 }];
  Logger.log("===== SAVE =====");
  Logger.log(JSON.stringify(savePredictionSet(TEST_PLAYER, TEST_GAMEWEEK, predictions), null, 2));
  Logger.log("===== LOAD =====");
  Logger.log(JSON.stringify(loadPlayerPredictions(TEST_PLAYER, TEST_GAMEWEEK), null, 2));
  Logger.log("===== CLEAR =====");
  Logger.log(JSON.stringify(clearPredictionSet(TEST_PLAYER, TEST_GAMEWEEK), null, 2));
}
