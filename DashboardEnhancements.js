/**********************************************************************
 * PLTT Platform
 * DashboardEnhancements.js
 *
 * Dashboard-only data layer.
 * Reads existing data for the dashboard without replacing existing
 * prediction, Player Selection, History, leaderboard or payment logic.
 **********************************************************************/

function getDashboardEnhancedData(playerID) {
  playerID = String(playerID || '').trim();
  if (!playerID) return errorResponse('Player ID is required.');

  try {
    const money = getDashboardMoneyData(playerID);
    const moneyData = money && money.success && money.data ? money.data : {};
    const currentGameweekID = String(moneyData.currentGameweek || resolveAuthoritativeGameweekID() || '').trim();
    const outstandingPayments = getDashboardOutstandingPayments_(playerID);
    const historyResponse = getSelectionHistoryFiltered(playerID, '');
    const historyData = historyResponse && historyResponse.success && historyResponse.data ? historyResponse.data : { groups: [] };
    const seasonResponse = getSeasonLeaderboardPageData();
    const seasonRows = seasonResponse && Array.isArray(seasonResponse.rows) ? seasonResponse.rows : [];
    const currentPlayer = getPaymentPlayer(playerID) || {};
    const displayName = String(currentPlayer.displayName || '').trim();
    const seasonRow = seasonRows.find(function(row) {
      return String(row.player || '').trim() === displayName;
    }) || null;

    const currentPredictionSet = currentGameweekID ? getPlayerPredictionSet(playerID, currentGameweekID) : null;
    const currentPredictionItems = currentPredictionSet ? getPredictionItems(currentPredictionSet.predictionSetID) : [];
    const deadline = getDashboardGameweekDeadline_(currentGameweekID);
    const currentGroup = (historyData.groups || []).find(function(group) {
      return String(group.gameweekID || '').trim() === currentGameweekID;
    }) || null;

    const recentGroups = (historyData.groups || []).slice().sort(function(a, b) {
      return dashboardGameweekNumber_(b.gameweekID) - dashboardGameweekNumber_(a.gameweekID);
    }).slice(0, 5).reverse();

    const recentPoints = recentGroups.map(function(group) {
      return {
        gameweekID: String(group.gameweekID || ''),
        points: Number(group.totalPoints || 0),
        completedFixtures: Number(group.completedFixtures || 0),
        fixturesTotal: Number(group.fixturesTotal || 0)
      };
    });

    const rankedRows = seasonRows.slice().sort(function(a, b) {
      return Number(a.position || 999999) - Number(b.position || 999999);
    });
    const seasonIndex = seasonRow ? rankedRows.findIndex(function(row) {
      return String(row.player || '').trim() === displayName;
    }) : -1;
    const seasonPoints = seasonRow ? Number(seasonRow.points || 0) : Number(currentPlayer.seasonPoints || 0);
    const seasonRank = seasonRow ? Number(seasonRow.position || 0) : Number(currentPlayer.seasonRank || 0);
    const pointsBehind = seasonIndex > 0 ? Math.max(0, seasonPoints - Number(rankedRows[seasonIndex - 1].points || 0)) : null;
    const pointsToLeaderAbove = seasonIndex > 0 ? Math.max(0, Number(rankedRows[seasonIndex - 1].points || 0) - seasonPoints) : null;
    const pointsAhead = seasonIndex >= 0 && seasonIndex < rankedRows.length - 1
      ? Math.max(0, seasonPoints - Number(rankedRows[seasonIndex + 1].points || 0))
      : null;

    return successResponse('Dashboard data loaded.', {
      currentGameweek: currentGameweekID,
      deadline: deadline,
      predictionSubmitted: Boolean(currentPredictionSet && currentPredictionSet.submitted),
      predictionsCompleted: currentPredictionItems.length,
      predictionsTotal: Number((currentGroup && currentGroup.fixturesTotal) || 0),
      currentGameweekPoints: currentGroup ? Number(currentGroup.totalPoints || 0) : 0,
      currentGameweekCompleted: currentGroup ? Number(currentGroup.completedFixtures || 0) : 0,
      weeklyWinnerPot: Number(moneyData.weeklyWinnerPot || 0),
      seasonPot: Number(moneyData.seasonPot || 0),
      submissionCount: Number(moneyData.submissionCount || 0),
      seasonSubmissionCount: Number(moneyData.seasonSubmissionCount || 0),
      seasonRank: seasonRank,
      seasonPoints: seasonPoints,
      weeksPlayed: Number(moneyData.weeksPlayed || currentPlayer.gameweeksPlayed || 0),
      pointsToLeaderAbove: pointsToLeaderAbove,
      pointsAhead: pointsAhead,
      recentPoints: recentPoints,
      outstandingPayments: outstandingPayments,
      outstandingTotal: roundMoney(outstandingPayments.reduce(function(total, item) {
        return total + Number(item.amount || 0);
      }, 0))
    });
  } catch (err) {
    return errorResponse(err.message);
  }
}

function getDashboardOutstandingPayments_(playerID) {
  const sheet = getSheet(SHEETS.PAYMENTS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const playerCol = paymentColumnIndex(headers, 'PlayerID');
  const nameCol = paymentColumnIndex(headers, 'DisplayName');
  const gameweekCol = paymentColumnIndex(headers, 'GameweekID');
  const amountCol = paymentColumnIndex(headers, 'Amount');
  const paidCol = paymentColumnIndex(headers, 'Paid');

  if (playerCol === -1 || gameweekCol === -1 || amountCol === -1 || paidCol === -1) {
    throw new Error('Payments sheet is missing required payment status columns.');
  }

  return values.map(function(row) {
    return {
      playerID: String(row[playerCol] || '').trim(),
      displayName: nameCol === -1 ? '' : String(row[nameCol] || '').trim(),
      gameweekID: String(row[gameweekCol] || '').trim(),
      amount: Number(row[amountCol] || 0),
      paid: paymentStatusBoolean_(row[paidCol])
    };
  }).filter(function(item) {
    return item.playerID === playerID && !item.paid;
  }).sort(function(a, b) {
    return dashboardGameweekNumber_(a.gameweekID) - dashboardGameweekNumber_(b.gameweekID);
  });
}

function paymentStatusBoolean_(value) {
  if (value === true) return true;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === '1';
}

function getDashboardGameweekDeadline_(gameweekID) {
  if (!gameweekID) return '';
  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return '';

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  if (index.gameweekid === undefined || index.deadline === undefined) return '';

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][index.gameweekid] || '').trim() === gameweekID) {
      return String(values[i][index.deadline] || '').trim();
    }
  }
  return '';
}

function dashboardGameweekNumber_(gameweekID) {
  const match = String(gameweekID || '').match(/(\d+)$/);
  return match ? Number(match[1]) : -1;
}
