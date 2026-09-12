/**********************************************************************
 * PLTT Platform
 * Payments.js
 * Version: 0.6.2
 *
 * Release:
 * - Automatic payment record creation on prediction submission
 * - Duplicate-safe Gameweek payment records
 * - DisplayName support
 * - £10 entry allocation and fee calculation
 * - Repair missing payment records for genuine submissions
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

/**
 * Repairs missing payment records for a Gameweek without changing the
 * player's prediction submission. Payment records are bookkeeping only.
 *
 * Run once for the affected Gameweek, for example:
 *   repairMissingPaymentRecordsForGameweek("GW04");
 */
function repairMissingPaymentRecordsForGameweek(gameweekID) {

  gameweekID = String(gameweekID || "").trim();
  if (!gameweekID) throw new Error("GameweekID is required.");

  const predictionSheet = getSheet(SHEETS.PREDICTIONSETS);
  const predictionLastRow = predictionSheet.getLastRow();
  const predictionLastColumn = predictionSheet.getLastColumn();

  if (predictionLastRow <= 1 || predictionLastColumn <= 0) {
    return { gameweekID: gameweekID, repaired: 0, skipped: 0 };
  }

  const headers = predictionSheet.getRange(1, 1, 1, predictionLastColumn).getValues()[0];
  const values = predictionSheet.getRange(2, 1, predictionLastRow - 1, predictionLastColumn).getValues();
  const index = buildHeaderIndex(headers);

  ['predictionsetid', 'playerid', 'gameweekid'].forEach(function(key) {
    if (index[key] === undefined) {
      throw new Error('PredictionSets sheet must contain a ' + key + ' column.');
    }
  });

  const submittedIndex = index.submitted;
  const currentIndex = index.current;
  const candidates = {};

  values.forEach(function(row) {
    const setID = String(row[index.predictionsetid] || '').trim();
    const playerID = String(row[index.playerid] || '').trim();
    const gwID = String(row[index.gameweekid] || '').trim();
    if (!setID || !playerID || gwID !== gameweekID) return;

    const submitted = submittedIndex !== undefined && gwBoardBool(row[submittedIndex]);
    const current = currentIndex === undefined || gwBoardBool(row[currentIndex]);
    if (!candidates[playerID]) candidates[playerID] = [];
    candidates[playerID].push({setID: setID, submitted: submitted, current: current});
  });

  const repaired = [];
  const skipped = [];

  Object.keys(candidates).forEach(function(playerID) {
    const sets = candidates[playerID];
    const valid = sets.filter(function(set) {
      if (set.submitted) return true;
      const items = getPredictionItems(set.setID);
      return items.length > 0;
    });

    if (!valid.length) {
      skipped.push(playerID);
      return;
    }

    valid.sort(function(a, b) {
      if (a.current !== b.current) return a.current ? -1 : 1;
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      return 0;
    });

    const selected = valid[0];

    try {
      const payment = createPaymentRecordForSubmission(
        playerID,
        gameweekID,
        selected.setID
      );
      if (payment.created) repaired.push({
        playerID: playerID,
        predictionSetID: selected.setID,
        paymentID: payment.paymentID
      });
    } catch (err) {
      skipped.push(playerID + ': ' + err.message);
    }
  });

  return {
    gameweekID: gameweekID,
    repaired: repaired.length,
    skipped: skipped.length,
    records: repaired,
    skippedPlayers: skipped
  };
}

function testPaymentRecordCreation() {

  const result = createPaymentRecordForSubmission(
    "P0001",
    "GW02",
    "PS0011"
  );

  Logger.log(JSON.stringify(result, null, 2));
}
