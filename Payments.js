/**********************************************************************
 * PLTT Platform
 * Payments.js
 * Version: 0.6.0
 *
 * Financial source of truth for weekly entries and prize pots.
 * A payment record is created once when a player first creates a
 * prediction set for a Gameweek. Re-saving predictions never creates
 * another payment record for the same player/Gameweek.
 **********************************************************************/

function createPaymentForPredictionSet(playerID, gameweekID, predictionSetID) {
  playerID = String(playerID || "").trim();
  gameweekID = String(gameweekID || "").trim();
  predictionSetID = String(predictionSetID || "").trim();
  if (!playerID || !gameweekID || !predictionSetID) throw new Error("Payment record requires PlayerID, GameweekID and PredictionSetID.");

  const sheet = getSheet(SHEETS.PAYMENTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(h => String(h || "").trim()) : [];
  const index = {};
  headers.forEach((header, i) => { index[header.toLowerCase()] = i; });
  ["paymentid","playerid","displayname","gameweekid","predictionsetid","amount","paid","paymentdate","weeklyallocation","seasonallocation","weeklyfee","seasonfee"].forEach(function(key) {
    if (index[key] === undefined) throw new Error("Payments sheet is missing the " + key + " column.");
  });

  // One entry/payment per player per Gameweek. Re-saving predictions never duplicates it.
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][index.playerid] || "") === playerID && String(values[r][index.gameweekid] || "") === gameweekID) {
      return { created: false, paymentID: String(values[r][index.paymentid] || ""), gameweekID: gameweekID, predictionSetID: String(values[r][index.predictionsetid] || predictionSetID) };
    }
  }

  const player = getPlayerByIdForPayment(playerID);
  if (!player) throw new Error("Player not found for payment record: " + playerID);

  const amount = Number(GAME.ENTRY_FEE.toFixed(2));
  const weeklyAllocation = Number((amount * GAME.WEEKLY_POT_PERCENT / 100).toFixed(2));
  const seasonAllocation = Number((amount * GAME.SEASON_POT_PERCENT / 100).toFixed(2));
  const weeklyFee = Number((weeklyAllocation * GAME.ADMIN_FEE_PERCENT / 100).toFixed(2));
  const seasonFee = Number((seasonAllocation * GAME.ADMIN_FEE_PERCENT / 100).toFixed(2));
  const paymentID = generateNextId(SHEETS.PAYMENTS, "PAY");

  const row = new Array(headers.length).fill("");
  row[index.paymentid] = paymentID;
  row[index.playerid] = playerID;
  row[index.displayname] = player.displayName;
  row[index.gameweekid] = gameweekID;
  row[index.predictionsetid] = predictionSetID;
  row[index.amount] = amount;
  row[index.paid] = false;
  row[index.paymentdate] = "";
  row[index.weeklyallocation] = weeklyAllocation;
  row[index.seasonallocation] = seasonAllocation;
  row[index.weeklyfee] = weeklyFee;
  row[index.seasonfee] = seasonFee;
  sheet.appendRow(row);

  logAction(FEATURES.PAYMENT, "CREATE", playerID, paymentID);
  return { created: true, paymentID: paymentID, gameweekID: gameweekID, predictionSetID: predictionSetID, amount: amount };
}

function getPlayerByIdForPayment(playerID) {
  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(3, sheet.getLastColumn())).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || "") === playerID) return { playerID: playerID, displayName: String(values[i][2] || "") };
  }
  return null;
}

function getCompetitionFinancials() {
  const settings = getWebsiteSettings();
  const currentGameweek = String(settings.currentGameweek || "").trim();
  const sheet = getSheet(SHEETS.PAYMENTS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return successResponse("Competition financials loaded.", { gameweekID: currentGameweek, weeklyPrizePot: 0, seasonPrizePot: 0, gameweekEntries: 0, seasonEntries: 0 });

  const headers = values[0].map(h => String(h || "").trim().toLowerCase());
  const idx = {};
  headers.forEach((header, i) => { idx[header] = i; });
  ["gameweekid","weeklyallocation","seasonallocation","weeklyfee","seasonfee"].forEach(function(key) {
    if (idx[key] === undefined) throw new Error("Payments sheet is missing the " + key + " column.");
  });

  let weeklyGross = 0, weeklyFees = 0, seasonGross = 0, seasonFees = 0, gameweekEntries = 0, seasonEntries = 0;
  for (let r = 1; r < values.length; r++) {
    const gameweek = String(values[r][idx.gameweekid] || "").trim();
    if (!gameweek) continue;
    const weekly = Number(values[r][idx.weeklyallocation] || 0);
    const season = Number(values[r][idx.seasonallocation] || 0);
    const weeklyFee = Number(values[r][idx.weeklyfee] || 0);
    const seasonFee = Number(values[r][idx.seasonfee] || 0);
    seasonGross += season; seasonFees += seasonFee; seasonEntries++;
    if (gameweek === currentGameweek) { weeklyGross += weekly; weeklyFees += weeklyFee; gameweekEntries++; }
  }

  return successResponse("Competition financials loaded.", {
    gameweekID: currentGameweek,
    weeklyPrizePot: Number((weeklyGross - weeklyFees).toFixed(2)),
    seasonPrizePot: Number((seasonGross - seasonFees).toFixed(2)),
    gameweekEntries: gameweekEntries,
    seasonEntries: seasonEntries
  });
}

function getPlayerPaymentForCurrentGameweek(playerID) {
  const settings = getWebsiteSettings();
  const gameweekID = String(settings.currentGameweek || "").trim();
  const sheet = getSheet(SHEETS.PAYMENTS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return successResponse("No payment record.", null);
  const headers = values[0].map(h => String(h || "").trim().toLowerCase());
  const idx = {}; headers.forEach((header, i) => { idx[header] = i; });
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idx.playerid] || "") === String(playerID || "") && String(values[r][idx.gameweekid] || "") === gameweekID) {
      return successResponse("Payment record loaded.", { paymentID: String(values[r][idx.paymentid] || ""), amount: Number(values[r][idx.amount] || 0), gameweekID: gameweekID, paid: Boolean(values[r][idx.paid]) });
    }
  }
  return successResponse("No payment record.", null);
}
