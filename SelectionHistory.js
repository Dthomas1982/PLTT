/**********************************************************************
 * PLTT Platform
 * SelectionHistory.js
 *
 * Player selection history.
 * - Any Gameweek can be selected.
 * - Shows all fixtures in the selected Gameweek.
 * - Shows the player's prediction, actual result and points.
 * - Uses the same authoritative PLTT scoring as Leaderboard.js.
 **********************************************************************/

function getPlayerSelectionHistory(playerID, requestedGameweekID) {
  playerID = String(playerID || '').trim();
  requestedGameweekID = String(requestedGameweekID || '').trim();

  if (!playerID) return errorResponse('Player ID is required.');

  const gameweeks = getSelectionHistoryGameweeks_();
  if (!gameweeks.length) {
    return successResponse('No Gameweeks available.', {
      gameweeks: [], selectedGameweekID: '', fixtures: [], totalPoints: 0,
      completedFixtures: 0, fixturesTotal: 0
    });
  }

  let selectedID = requestedGameweekID;
  if (!selectedID || !gameweeks.some(function(gw) { return gw.gameweekID === selectedID; })) {
    selectedID = getLatestPlayerHistoryGameweek_(playerID, gameweeks) || gameweeks[gameweeks.length - 1].gameweekID;
  }

  const selectedGameweek = gameweeks.find(function(gw) { return gw.gameweekID === selectedID; }) || gameweeks[gameweeks.length - 1];
  const fixtureData = getSelectionHistoryFixtures_(selectedID);
  const predictionSet = getPlayerPredictionSet(playerID, selectedID);
  const items = predictionSet ? getPredictionItems(predictionSet.predictionSetID) : [];
  const fixtures = buildSelectionHistoryFixtures_(fixtureData, items);

  return successResponse('Selection History Loaded', {
    gameweeks: gameweeks,
    selectedGameweekID: selectedGameweek.gameweekID,
    selectedGameweek: selectedGameweek,
    predictionSubmitted: Boolean(predictionSet && predictionSet.submitted),
    fixtures: fixtures,
    totalPoints: getSelectionHistoryTotalPoints_(fixtures),
    completedFixtures: getSelectionHistoryCompletedFixtures_(fixtures),
    fixturesTotal: fixtures.length
  });
}

function getSelectionHistoryFiltered(playerID, requestedGameweekID) {
  playerID = String(playerID || '').trim();
  requestedGameweekID = String(requestedGameweekID || '').trim();

  const gameweeks = getSelectionHistoryGameweeks_();
  if (!gameweeks.length) {
    return successResponse('No Gameweeks available.', {
      players: [], gameweeks: [], selectedPlayerID: playerID,
      selectedGameweekID: requestedGameweekID, groups: [], totalPoints: 0,
      completedFixtures: 0, fixturesTotal: 0
    });
  }

  const activePlayers = getActivePlayersForLeaderboard_();
  const validGameweekIDs = gameweeks.map(function(gw) { return gw.gameweekID; });
  const validPlayerIDs = activePlayers.map(function(player) { return String(player.playerID || '').trim(); });

  if (playerID && validPlayerIDs.indexOf(playerID) === -1) playerID = '';
  if (requestedGameweekID && validGameweekIDs.indexOf(requestedGameweekID) === -1) requestedGameweekID = '';

  const targetPlayers = playerID
    ? activePlayers.filter(function(player) { return String(player.playerID || '').trim() === playerID; })
    : activePlayers;
  const targetGameweeks = requestedGameweekID
    ? gameweeks.filter(function(gw) { return gw.gameweekID === requestedGameweekID; })
    : gameweeks;

  const groups = [];

  targetGameweeks.forEach(function(gw) {
    const fixtureData = getSelectionHistoryFixtures_(gw.gameweekID);

    targetPlayers.forEach(function(player) {
      const thisPlayerID = String(player.playerID || '').trim();
      const predictionSet = getPlayerPredictionSet(thisPlayerID, gw.gameweekID);

      if (!predictionSet || !predictionSet.submitted) return;

      const items = getPredictionItems(predictionSet.predictionSetID);
      const fixtures = buildSelectionHistoryFixtures_(fixtureData, items);

      groups.push({
        playerID: thisPlayerID,
        playerName: String(player.displayName || player.name || thisPlayerID).trim(),
        gameweekID: gw.gameweekID,
        gameweek: gw,
        predictionSubmitted: true,
        fixtures: fixtures,
        totalPoints: getSelectionHistoryTotalPoints_(fixtures),
        completedFixtures: getSelectionHistoryCompletedFixtures_(fixtures),
        fixturesTotal: fixtures.length
      });
    });
  });

  groups.sort(function(a, b) {
    const aGW = parseGameweekNumber_(a.gameweekID);
    const bGW = parseGameweekNumber_(b.gameweekID);
    if (aGW !== null && bGW !== null && aGW !== bGW) return aGW - bGW;
    if (a.gameweekID !== b.gameweekID) return a.gameweekID.localeCompare(b.gameweekID);
    return a.playerName.localeCompare(b.playerName);
  });

  let totalPoints = 0;
  let completedFixtures = 0;
  let fixturesTotal = 0;
  groups.forEach(function(group) {
    totalPoints += Number(group.totalPoints || 0);
    completedFixtures += Number(group.completedFixtures || 0);
    fixturesTotal += Number(group.fixturesTotal || 0);
  });

  return successResponse('Selection History Loaded', {
    players: activePlayers.map(function(player) {
      return {
        playerID: String(player.playerID || '').trim(),
        playerName: String(player.displayName || player.name || player.playerID || '').trim()
      };
    }),
    gameweeks: gameweeks,
    selectedPlayerID: playerID,
    selectedGameweekID: requestedGameweekID,
    groups: groups,
    totalPoints: totalPoints,
    completedFixtures: completedFixtures,
    fixturesTotal: fixturesTotal
  });
}

function buildSelectionHistoryFixtures_(fixtureData, items) {
  const predictionMap = {};
  (items || []).forEach(function(item) {
    predictionMap[String(item.matchID)] = item;
  });

  return (fixtureData || []).map(function(fixture) {
    const prediction = predictionMap[String(fixture.matchID)] || null;
    let points = null;
    let scoringType = '';

    if (prediction && prediction.homePrediction !== '' && prediction.awayPrediction !== '' && fixture.homeGoals !== null && fixture.awayGoals !== null) {
      const predictedHome = Number(prediction.homePrediction);
      const predictedAway = Number(prediction.awayPrediction);
      const actualHome = Number(fixture.homeGoals);
      const actualAway = Number(fixture.awayGoals);

      if (predictedHome === actualHome && predictedAway === actualAway) {
        points = LEADERBOARD_POINTS.EXACT;
        scoringType = 'Exact';
      } else if (getResultSign_(predictedHome, predictedAway) === getResultSign_(actualHome, actualAway)) {
        const predictedMargin = Math.abs(predictedHome - predictedAway);
        const actualMargin = Math.abs(actualHome - actualAway);
        if (predictedMargin === actualMargin) {
          points = LEADERBOARD_POINTS.MARGIN;
          scoringType = 'Margin';
        } else {
          points = LEADERBOARD_POINTS.RESULT;
          scoringType = 'Result';
        }
      } else {
        points = 0;
        scoringType = 'Miss';
      }
    }

    return {
      matchID: fixture.matchID,
      date: fixture.date,
      kickoff: fixture.kickoff,
      status: fixture.status,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      prediction: prediction ? { homePrediction: prediction.homePrediction, awayPrediction: prediction.awayPrediction } : null,
      actualHome: fixture.homeGoals,
      actualAway: fixture.awayGoals,
      points: points,
      scoringType: scoringType
    };
  });
}

function getSelectionHistoryTotalPoints_(fixtures) {
  return (fixtures || []).reduce(function(total, fixture) {
    return total + (fixture.points === null ? 0 : Number(fixture.points));
  }, 0);
}

function getSelectionHistoryCompletedFixtures_(fixtures) {
  return (fixtures || []).filter(function(fixture) {
    return fixture.actualHome !== null && fixture.actualAway !== null;
  }).length;
}

function getSelectionHistoryGameweeks_() {
  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  if (index.gameweekid === undefined) throw new Error('Gameweeks sheet must contain a GameweekID column.');

  return values.map(function(row, rowIndex) {
    const gameweekID = String(row[index.gameweekid] || '').trim();
    if (!gameweekID) return null;
    return {
      gameweekID: gameweekID,
      startDate: index.startdate !== undefined ? String(displayValues[rowIndex][index.startdate] || '').trim() : '',
      deadline: index.deadline !== undefined ? String(displayValues[rowIndex][index.deadline] || '').trim() : '',
      seasonID: index.seasonid !== undefined ? String(row[index.seasonid] || '').trim() : ''
    };
  }).filter(Boolean).sort(function(a, b) {
    const aNumber = parseGameweekNumber_(a.gameweekID);
    const bNumber = parseGameweekNumber_(b.gameweekID);
    if (aNumber !== null && bNumber !== null && aNumber !== bNumber) return aNumber - bNumber;
    return a.gameweekID.localeCompare(b.gameweekID);
  });
}

function parseGameweekNumber_(gameweekID) {
  const match = String(gameweekID || '').match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getLatestPlayerHistoryGameweek_(playerID, gameweeks) {
  for (let i = gameweeks.length - 1; i >= 0; i--) {
    const predictionSet = getPlayerPredictionSet(playerID, gameweeks[i].gameweekID);
    if (predictionSet && predictionSet.submitted) return gameweeks[i].gameweekID;
  }
  return '';
}

function getSelectionHistoryFixtures_(gameweekID) {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  ['matchid', 'gameweekid', 'date', 'kickoff', 'hometeamid', 'awayteamid'].forEach(function(key) {
    if (index[key] === undefined) throw new Error('Fixtures sheet must contain a ' + key + ' column.');
  });

  const teams = getTeamsLookup();
  const target = String(gameweekID || '').trim();

  return values.map(function(row, rowIndex) {
    return { row: row, displayRow: displayValues[rowIndex] };
  }).filter(function(item) {
    return String(item.row[index.gameweekid] || '').trim() === target;
  }).map(function(item) {
    const row = item.row;
    const displayRow = item.displayRow;
    const homeID = String(row[index.hometeamid] || '').trim().toUpperCase();
    const awayID = String(row[index.awayteamid] || '').trim().toUpperCase();
    return {
      matchID: String(row[index.matchid] || '').trim(),
      date: String(displayRow[index.date] || '').trim(),
      kickoff: String(displayRow[index.kickoff] || '').trim(),
      status: index.status !== undefined ? String(row[index.status] || '').trim() : '',
      homeGoals: index.homegoals !== undefined ? toScore_(row[index.homegoals]) : null,
      awayGoals: index.awaygoals !== undefined ? toScore_(row[index.awaygoals]) : null,
      homeTeam: teams[homeID] || null,
      awayTeam: teams[awayID] || null
    };
  }).sort(function(a, b) {
    return (a.date + ' ' + a.kickoff).localeCompare(b.date + ' ' + b.kickoff);
  });
}

function testPlayerSelectionHistory() {
  return getPlayerSelectionHistory('P0001', 'GW1');
}
