/**********************************************************************
 * PLTT Platform
 * MoneyPots.js
 *
 * Dashboard prize-pot data.
 *
 * Rules:
 * - Pots are based on submitted PredictionSets, not Paid status.
 * - One current PredictionSet per player/Gameweek counts as one entry.
 * - Weekly winner pot = net weekly allocation per submission.
 * - Season pot = net season allocation per submission, accumulated across
 *   the season.
 **********************************************************************/

function getDashboardMoneyData(playerID) {
  try {
    const gameweekID = resolveAuthoritativeGameweekID();
    const predictionSheet = getSheet(SHEETS.PREDICTIONSETS);
    const lastRow = predictionSheet.getLastRow();
    const lastCol = predictionSheet.getLastColumn();
    const headers = lastCol > 0
      ? predictionSheet.getRange(1, 1, 1, lastCol).getValues()[0]
      : [];

    const playerCol = moneyPotColumnIndex(headers, "PlayerID");
    const gameweekCol = moneyPotColumnIndex(headers, "GameweekID");
    const currentCol = moneyPotColumnIndex(headers, "Current");

    const entries = [];

    if (lastRow > 1 && playerCol !== -1 && gameweekCol !== -1) {
      const values = predictionSheet
        .getRange(2, 1, lastRow - 1, lastCol)
        .getValues();

      values.forEach(function(row) {
        const player = String(row[playerCol] || "").trim();
        const gw = String(row[gameweekCol] || "").trim();
        const current = currentCol === -1 ? true : moneyPotBoolean(row[currentCol]);

        if (player && gw && current) {
          entries.push({ playerID: player, gameweekID: gw });
        }
      });
    }

    const uniqueEntries = {};
    entries.forEach(function(entry) {
      uniqueEntries[entry.playerID + "|" + entry.gameweekID] = entry;
    });

    const unique = Object.keys(uniqueEntries).map(function(key) {
      return uniqueEntries[key];
    });

    const submissionCount = gameweekID
      ? unique.filter(function(entry) {
          return entry.gameweekID === gameweekID;
        }).length
      : 0;

    const seasonSubmissionCount = unique.length;

    const weeklyNetPerEntry =
      Number(GAME.ENTRY_FEE) *
      Number(GAME.WEEKLY_POT_PERCENT) / 100 *
      (1 - Number(GAME.ADMIN_FEE_PERCENT) / 100);

    const seasonNetPerEntry =
      Number(GAME.ENTRY_FEE) *
      Number(GAME.SEASON_POT_PERCENT) / 100 *
      (1 - Number(GAME.ADMIN_FEE_PERCENT) / 100);

    let weeksPlayed = 0;

    if (playerID) {
      const playerWeeks = {};
      unique.forEach(function(entry) {
        if (entry.playerID === String(playerID).trim()) {
          playerWeeks[entry.gameweekID] = true;
        }
      });
      weeksPlayed = Object.keys(playerWeeks).length;
    }

    return successResponse("Dashboard money data loaded.", {
      currentGameweek: gameweekID || "",
      submissionCount: submissionCount,
      weeklyWinnerPot: roundMoney(submissionCount * weeklyNetPerEntry),
      seasonPot: roundMoney(seasonSubmissionCount * seasonNetPerEntry),
      seasonSubmissionCount: seasonSubmissionCount,
      weeksPlayed: weeksPlayed
    });

  } catch (err) {
    logAction(
      FEATURES.LEADERBOARD,
      "MONEY_POT_LOAD_ERROR",
      playerID || "",
      err.message
    );
    return errorResponse(err.message);
  }
}

/**
 * Returns only the logged-in player's outstanding payment records.
 * The Payments sheet is the source of truth for Paid status.
 */
function getDashboardPaymentStatus(playerID) {
  try {
    playerID = String(playerID || "").trim();
    if (!playerID) return errorResponse("Player ID is required.");

    const sheet = getSheet(SHEETS.PAYMENTS);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1 || lastCol <= 0) {
      return successResponse("No payment records found.", {
        outstanding: [],
        totalOutstanding: 0,
        outstandingCount: 0
      });
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const playerCol = moneyPotColumnIndex(headers, "PlayerID");
    const gameweekCol = moneyPotColumnIndex(headers, "GameweekID");
    const amountCol = moneyPotColumnIndex(headers, "Amount");
    const paidCol = moneyPotColumnIndex(headers, "Paid");

    if (playerCol === -1 || gameweekCol === -1 || amountCol === -1 || paidCol === -1) {
      throw new Error("Payments sheet is missing a required payment column.");
    }

    const outstanding = [];

    values.forEach(function(row) {
      const rowPlayer = String(row[playerCol] || "").trim();
      if (rowPlayer !== playerID) return;
      if (moneyPotBoolean(row[paidCol])) return;

      outstanding.push({
        gameweekID: String(row[gameweekCol] || "").trim(),
        amount: roundMoney(Number(row[amountCol] || 0))
      });
    });

    outstanding.sort(function(a, b) {
      const aNum = Number(String(a.gameweekID).replace(/\D/g, "")) || 0;
      const bNum = Number(String(b.gameweekID).replace(/\D/g, "")) || 0;
      return aNum - bNum;
    });

    const totalOutstanding = outstanding.reduce(function(total, item) {
      return total + Number(item.amount || 0);
    }, 0);

    return successResponse("Dashboard payment status loaded.", {
      outstanding: outstanding,
      totalOutstanding: roundMoney(totalOutstanding),
      outstandingCount: outstanding.length
    });

  } catch (err) {
    logAction(
      FEATURES.PAYMENT,
      "DASHBOARD_PAYMENT_STATUS_ERROR",
      playerID || "",
      err.message
    );
    return errorResponse(err.message);
  }
}

function moneyPotColumnIndex(headers, name) {
  const target = String(name || "").trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim().toLowerCase() === target) {
      return i;
    }
  }
  return -1;
}

function moneyPotBoolean(value) {
  if (value === true) return true;
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
