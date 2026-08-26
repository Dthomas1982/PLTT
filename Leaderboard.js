/**********************************************************************
 * PLTT Platform
 * Leaderboard.js
 * Version: 0.7.1
 *
 * Weekly scoring engine + public weekly/season leaderboard data.
 * Scoring: Exact 10 | Margin 5 | Result 2.
 * Display counts are mutually exclusive: an exact is only Exact,
 * a correct margin is only Margin, and a result-only prediction is Result.
 **********************************************************************/

const LEADERBOARD_POINTS = {
  EXACT: 10,
  MARGIN: 5,
  RESULT: 2
};

function recalculateLeaderboard() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const scorableGameweeks = getScorableGameweeks_();
    const players = getActivePlayersForLeaderboard_();
    const previousRanks = getPreviousLeaderboardRanks_();
    const totals = {};

    players.forEach(function(player) {
      totals[player.playerID] = {
        playerID: player.playerID,
        player: player.displayName,
        played: 0,
        points: 0,
        exact: 0,
        margins: 0,
        results: 0,
        lastWeek: 0
      };
    });

    let latestScoredGameweek = '';

    scorableGameweeks.forEach(function(gameweek) {
      latestScoredGameweek = gameweek.gameweekID;
      const fixtureMap = {};
      gameweek.fixtures.forEach(function(fixture) {
        fixtureMap[fixture.matchID] = fixture;
      });

      players.forEach(function(player) {
        const predictionSet = getPlayerPredictionSet(player.playerID, gameweek.gameweekID);
        if (!predictionSet) return;

        const items = getPredictionItems(predictionSet.predictionSetID);
        if (!isCompletePredictionSet_(items, gameweek.allFixtures)) return;

        setPredictionSetSubmitted_(predictionSet.predictionSetID, true);
        const week = scorePredictionSet_(items, fixtureMap);
        const total = totals[player.playerID];

        total.played += 1;
        total.points += week.points;
        total.exact += week.exact;
        total.margins += week.margins;
        total.results += week.results;
        total.lastWeek = week.points;
      });
    });

    const rows = Object.keys(totals).map(function(playerID) {
      return totals[playerID];
    }).sort(function(a, b) {
      if (b.points !== a.points) return b.points - a.points;
      return a.player.localeCompare(b.player);
    });

    let lastPoints = null;
    let currentPosition = 0;
    rows.forEach(function(row, index) {
      if (lastPoints === null || row.points !== lastPoints) currentPosition = index + 1;
      row.position = currentPosition;
      row.movement = formatMovement_(previousRanks[row.player], currentPosition);
      lastPoints = row.points;
    });

    writeLeaderboardSheet_(rows);
    syncPlayerSeasonSummary_(rows);

    return {
      success: true,
      gameweeksProcessed: scorableGameweeks.length,
      latestScoredGameweek: latestScoredGameweek,
      players: rows.length,
      leaderboard: rows
    };
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function getLeaderboardData() {
  const sheet = getSheet(SHEETS.LEADERBOARD);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  return sheet.getRange(2, 1, lastRow - 1, 9).getValues()
    .filter(function(row) { return String(row[1] || '').trim() !== ''; })
    .map(function(row) {
      return {
        position: Number(row[0] || 0),
        player: String(row[1] || ''),
        played: Number(row[2] || 0),
        points: Number(row[3] || 0),
        exact: Number(row[4] || 0),
        margins: Number(row[5] || 0),
        results: Number(row[6] || 0),
        lastWeek: Number(row[7] || 0),
        movement: String(row[8] || '')
      };
    });
}

function getSeasonLeaderboardPageData() {
  recalculateLeaderboard();
  const rows = getLeaderboardData().filter(function(row) { return row.played > 0; });
  return {
    season: getCurrentSeason(),
    competitionName: getCompetitionName(),
    rows: rows
  };
}

function getWeeklyLeaderboardPageData(gameweekID) {
  const requested = String(gameweekID || '').trim();
  const resolved = requested || resolveAuthoritativeGameweekID();
  const group = getLeaderboardGameweek_(resolved);
  const players = getActivePlayersForLeaderboard_();
  const rows = [];

  if (!group) {
    return {
      gameweekID: resolved,
      season: getCurrentSeason(),
      competitionName: getCompetitionName(),
      fixturesCompleted: 0,
      fixturesTotal: 0,
      rows: []
    };
  }

  const fixtureMap = {};
  group.fixtures.forEach(function(fixture) { fixtureMap[fixture.matchID] = fixture; });

  players.forEach(function(player) {
    const predictionSet = getPlayerPredictionSet(player.playerID, resolved);
    if (!predictionSet) return;
    const items = getPredictionItems(predictionSet.predictionSetID);
    if (!isCompletePredictionSet_(items, group.allFixtures)) return;

    const week = scorePredictionSet_(items, fixtureMap);
    rows.push({
      position: 0,
      player: player.displayName,
      played: 1,
      points: week.points,
      exact: week.exact,
      margins: week.margins,
      results: week.results,
      lastWeek: week.points,
      movement: '—'
    });
  });

  rows.sort(function(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exact !== a.exact) return b.exact - a.exact;
    if (b.margins !== a.margins) return b.margins - a.margins;
    return a.player.localeCompare(b.player);
  });

  let lastPoints = null;
  let position = 0;
  rows.forEach(function(row, index) {
    if (lastPoints === null || row.points !== lastPoints) position = index + 1;
    row.position = position;
    lastPoints = row.points;
  });

  return {
    gameweekID: resolved,
    season: getCurrentSeason(),
    competitionName: getCompetitionName(),
    fixturesCompleted: group.fixtures.length,
    fixturesTotal: group.allFixtures.length,
    rows: rows
  };
}

function getScorableGameweeks_() {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = buildHeaderIndex(headers);
  ['matchid', 'seasonid', 'gameweekid', 'date', 'status', 'homegoals', 'awaygoals'].forEach(function(key) {
    if (index[key] === undefined) throw new Error('Fixtures sheet must contain a ' + key + ' column.');
  });

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const groups = {};

  values.forEach(function(row) {
    const gameweekID = String(row[index.gameweekid] || '').trim();
    if (!gameweekID) return;
    if (!groups[gameweekID]) groups[gameweekID] = { gameweekID: gameweekID, allFixtures: [], fixtures: [] };

    const fixture = {
      matchID: String(row[index.matchid] || '').trim(),
      date: row[index.date],
      status: String(row[index.status] || '').trim(),
      homeGoals: toScore_(row[index.homegoals]),
      awayGoals: toScore_(row[index.awaygoals])
    };
    groups[gameweekID].allFixtures.push(fixture);
    if (fixture.status.toLowerCase() === 'completed' && fixture.homeGoals !== null && fixture.awayGoals !== null) {
      groups[gameweekID].fixtures.push(fixture);
    }
  });

  return Object.keys(groups).map(function(id) { return groups[id]; })
    .filter(function(gameweek) { return gameweek.fixtures.length > 0; })
    .sort(function(a, b) { return getEarliestFixtureDate_(a.allFixtures) - getEarliestFixtureDate_(b.allFixtures); });
}

function getLeaderboardGameweek_(gameweekID) {
  gameweekID = String(gameweekID || '').trim();
  if (!gameweekID) return null;

  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = buildHeaderIndex(headers);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const group = { gameweekID: gameweekID, allFixtures: [], fixtures: [] };

  values.forEach(function(row) {
    if (String(row[index.gameweekid] || '').trim() !== gameweekID) return;
    const fixture = {
      matchID: String(row[index.matchid] || '').trim(),
      date: row[index.date],
      status: String(row[index.status] || '').trim(),
      homeGoals: toScore_(row[index.homegoals]),
      awayGoals: toScore_(row[index.awaygoals])
    };
    group.allFixtures.push(fixture);
    if (fixture.status.toLowerCase() === 'completed' && fixture.homeGoals !== null && fixture.awayGoals !== null) {
      group.fixtures.push(fixture);
    }
  });

  return group.allFixtures.length ? group : null;
}

function getEarliestFixtureDate_(fixtures) {
  let earliest = null;
  fixtures.forEach(function(fixture) {
    const date = fixture.date instanceof Date ? fixture.date.getTime() : new Date(fixture.date).getTime();
    if (!isNaN(date) && (earliest === null || date < earliest)) earliest = date;
  });
  return earliest === null ? Number.MAX_SAFE_INTEGER : earliest;
}

function getActivePlayersForLeaderboard_() {
  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, 10).getValues()
    .filter(function(row) {
      return String(row[0] || '').trim() !== '' && String(row[2] || '').trim() !== '' && Boolean(row[5]) === true;
    })
    .map(function(row) { return { playerID: String(row[0]).trim(), displayName: String(row[2]).trim() }; });
}

function getPreviousLeaderboardRanks_() {
  const sheet = getSheet(SHEETS.LEADERBOARD);
  const lastRow = sheet.getLastRow();
  const ranks = {};
  if (lastRow <= 1) return ranks;
  sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function(row) {
    const position = Number(row[0] || 0);
    const player = String(row[1] || '').trim();
    if (position > 0 && player) ranks[player] = position;
  });
  return ranks;
}

function scorePredictionSet_(items, fixtureMap) {
  const score = { points: 0, exact: 0, margins: 0, results: 0 };
  items.forEach(function(item) {
    const fixture = fixtureMap[item.matchID];
    if (!fixture || item.homePrediction === '' || item.awayPrediction === '' || fixture.homeGoals === null || fixture.awayGoals === null) return;

    const predictedHome = Number(item.homePrediction);
    const predictedAway = Number(item.awayPrediction);
    const actualHome = Number(fixture.homeGoals);
    const actualAway = Number(fixture.awayGoals);

    if (predictedHome === actualHome && predictedAway === actualAway) {
      score.points += LEADERBOARD_POINTS.EXACT;
      score.exact += 1;
      return;
    }

    if (getResultSign_(predictedHome, predictedAway) === getResultSign_(actualHome, actualAway)) {
      const predictedMargin = Math.abs(predictedHome - predictedAway);
      const actualMargin = Math.abs(actualHome - actualAway);

      if (predictedMargin === actualMargin) {
        score.points += LEADERBOARD_POINTS.MARGIN;
        score.margins += 1;
      } else {
        score.points += LEADERBOARD_POINTS.RESULT;
        score.results += 1;
      }
    }
  });
  return score;
}

function getResultSign_(home, away) {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

function isCompletePredictionSet_(items, fixtures) {
  if (!items || !fixtures || items.length !== fixtures.length) return false;
  const matches = {};
  items.forEach(function(item) { matches[String(item.matchID)] = item; });
  return fixtures.every(function(fixture) {
    const item = matches[String(fixture.matchID)];
    return item && item.homePrediction !== '' && item.awayPrediction !== '' && Number.isInteger(Number(item.homePrediction)) && Number.isInteger(Number(item.awayPrediction));
  });
}

function setPredictionSetSubmitted_(predictionSetID, submitted) {
  const sheet = getSheet(SHEETS.PREDICTIONSETS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(predictionSetID)) {
      sheet.getRange(i + 2, 5).setValue(Boolean(submitted));
      return;
    }
  }
}

function writeLeaderboardSheet_(rows) {
  const sheet = getSheet(SHEETS.LEADERBOARD);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, 9).setValues(rows.map(function(row) {
    return [row.position, row.player, row.played, row.points, row.exact, row.margins, row.results, row.lastWeek, row.movement];
  }));
}

function syncPlayerSeasonSummary_(rows) {
  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const byName = {};
  rows.forEach(function(row) { byName[row.player] = row; });
  values.forEach(function(row, index) {
    const displayName = String(row[2] || '').trim();
    const calculated = byName[displayName];
    if (!calculated) return;
    sheet.getRange(index + 2, 8, 1, 3).setValues([[calculated.points, calculated.position, calculated.played]]);
  });
}

function formatMovement_(previousPosition, currentPosition) {
  if (!previousPosition || previousPosition === currentPosition) return '—';
  const movement = previousPosition - currentPosition;
  return movement > 0 ? '↑ ' + movement : '↓ ' + Math.abs(movement);
}

function toScore_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

function testLeaderboardScoring() {
  return recalculateLeaderboard();
}
