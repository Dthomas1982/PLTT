/**********************************************************************
 * PLTT Platform
 * Payments.js
 * Version: 0.6.1
 *
 * Release:
 * - Automatic payment record creation on prediction submission
 * - Duplicate-safe Gameweek payment records
 * - DisplayName support
 * - £10 entry allocation and fee calculation
 *
 * Status:
 * Production
 **********************************************************************/

function createPaymentRecordForSubmission(playerID, gameweekID, predictionSetID) {

  playerID = String(playerID || "").trim();
  gameweekID = String(gameweekID || "").trim();
  predictionSetID = String(predictionSetID || "").trim();

  if (!playerID || !gameweekID || !predictionSetID) {
    throw new Error("Payment record requires PlayerID, GameweekID and PredictionSetID.");
  }

  const sheet = getSheet(SHEETS.PAYMENTS);
  const lastRow = sheet.getLastRow();

  // One £10 payment record per player per Gameweek.
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const playerCol = paymentColumnIndex(headers, "PlayerID");
    const gameweekCol = paymentColumnIndex(headers, "GameweekID");

    if (playerCol !== -1 && gameweekCol !== -1) {
      for (let i = 0; i < values.length; i++) {
        if (
          String(values[i][playerCol]) === playerID &&
          String(values[i][gameweekCol]) === gameweekID
        ) {
          return {
            created: false,
            duplicate: true,
            paymentID: String(values[i][paymentColumnIndex(headers, "PaymentID")])
          };
        }
      }
    }
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const requiredHeaders = [
    "PaymentID",
    "PlayerID",
    "DisplayName",
    "GameweekID",
    "PredictionSetID",
    "Amount",
    "Paid",
    "PaymentDate",
    "WeeklyAllocation",
    "SeasonAllocation",
    "WeeklyFee",
    "SeasonFee"
  ];

  requiredHeaders.forEach(function(header) {
    if (paymentColumnIndex(headers, header) === -1) {
      throw new Error("Payments sheet is missing the '" + header + "' column.");
    }
  });

  const player = getPaymentPlayer(playerID);
  if (!player) {
    throw new Error("Player " + playerID + " was not found.");
  }

  const amount = Number(GAME.ENTRY_FEE);
  const weeklyAllocation = amount * Number(GAME.WEEKLY_POT_PERCENT) / 100;
  const seasonAllocation = amount * Number(GAME.SEASON_POT_PERCENT) / 100;
  const weeklyFee = weeklyAllocation * Number(GAME.ADMIN_FEE_PERCENT) / 100;
  const seasonFee = seasonAllocation * Number(GAME.ADMIN_FEE_PERCENT) / 100;

  const paymentID = generateNextId(
    SHEETS.PAYMENTS,
    "PAY"
  );

  const row = new Array(headers.length).fill("");

  setPaymentValue(row, headers, "PaymentID", paymentID);
  setPaymentValue(row, headers, "PlayerID", playerID);
  setPaymentValue(row, headers, "DisplayName", player.displayName);
  setPaymentValue(row, headers, "GameweekID", gameweekID);
  setPaymentValue(row, headers, "PredictionSetID", predictionSetID);
  setPaymentValue(row, headers, "Amount", amount);
  setPaymentValue(row, headers, "Paid", false);
  setPaymentValue(row, headers, "PaymentDate", "");
  setPaymentValue(row, headers, "WeeklyAllocation", weeklyAllocation);
  setPaymentValue(row, headers, "SeasonAllocation", seasonAllocation);
  setPaymentValue(row, headers, "WeeklyFee", weeklyFee);
  setPaymentValue(row, headers, "SeasonFee", seasonFee);

  sheet.appendRow(row);

  logAction(
    FEATURES.PAYMENT,
    "CREATED",
    playerID,
    paymentID + " / " + gameweekID
  );

  return {
    created: true,
    duplicate: false,
    paymentID: paymentID,
    playerID: playerID,
    displayName: player.displayName,
    gameweekID: gameweekID,
    predictionSetID: predictionSetID,
    amount: amount,
    weeklyAllocation: weeklyAllocation,
    seasonAllocation: seasonAllocation,
    weeklyFee: weeklyFee,
    seasonFee: seasonFee
  };
}

function getPaymentPlayer(playerID) {

  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, Math.min(10, sheet.getLastColumn())).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === playerID) {
      return {
        playerID: playerID,
        displayName: String(values[i][2] || "")
      };
    }
  }

  return null;
}

function paymentColumnIndex(headers, name) {

  const target = String(name).trim().toLowerCase();

  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim().toLowerCase() === target) {
      return i;
    }
  }

  return -1;
}

function setPaymentValue(row, headers, name, value) {

  const index = paymentColumnIndex(headers, name);

  if (index !== -1) {
    row[index] = value;
  }
}

function testPaymentRecordCreation() {

  const result = createPaymentRecordForSubmission(
    "P0001",
    "GW02",
    "PS0011"
  );

  Logger.log(JSON.stringify(result, null, 2));
}
