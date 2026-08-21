/**********************************************************************
 * PLTT Platform
 * Leaderboard.js
 * Version: 0.6.0
 *
 * Release:
 * - Weekly scoring engine
 * - Season leaderboard calculation
 * - Exact / margin / result counts
 * - Last completed Gameweek score
 * - Position movement
 * - Player season summary synchronisation
 *
 * Scoring:
 * - Exact score: 10 points
 * - Correct result + margin: 5 points
 * - Correct result: 2 points
 * - Wrong result: 0 points
 *
 * Status:
 * Production
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
    const completedGameweeks = getCompletedGameweeks_();
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

    let latestCompletedGameweek = '';

    completedGameweeks.forEach(function(gameweek) {

      latestCompletedGameweek = gameweek.gameweekID;

      const fixtures = gameweek.fixtures;
      const fixtureMap = {};

      fixtures.forEach(function(fixture) {
        fixtureMap[fixture.matchID] = fixture;
      });

      players.forEach(function(player) {

        const predictionSet = getPlayerPredictionSet(
          player.playerID,
          gameweek.gameweekID
        );

        if (!predictionSet) {
          return;
        }

        const items = getPredictionItems(
          predictionSet.predictionSetID
        );

        if (!isCompletePredictionSet_(items, fixtures)) {
          return;
        }

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

    const rows = Object.keys(totals)
      .map(function(playerID) {
        return totals[playerID];
      })
      .sort(function(a, b) {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.player.localeCompare(b.player);
      });

    let lastPoints = null;
    let currentPosition = 0;

    rows.forEach(function(row, index) {
      if (lastPoints === null || row.points !== lastPoints) {
        currentPosition = index + 1;
      }

      row.position = currentPosition;
      row.movement = formatMovement_(
        previousRanks[row.player],
        currentPosition
      );

      lastPoints = row.points;
    });

    writeLeaderboardSheet_(rows);
    syncPlayerSeasonSummary_(rows);

    return {
      success: true,
      gameweeksProcessed: completedGameweeks.length,
      latestCompletedGameweek: latestCompletedGameweek,
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

  if (lastRow <= 1) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, 9)
    .getValues()
    .filter(function(row) {
      return String(row[1] || '').trim() !== '';
    })
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

function getCompletedGameweeks_() {

  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return [];
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const index = buildHeaderIndex(headers);

  const required = [
    'matchid',
    'seasonid',
    'gameweekid',
    'date',
    'status',
    'homegoals',
    'awaygoals'
  ];

  required.forEach(function(key) {
    if (index[key] === undefined) {
      throw new Error(
        'Fixtures sheet must contain a ' + key + ' column.'
      );
    }
  });

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  const groups = {};

  values.forEach(function(row) {

    const gameweekID = String(
      row[index.gameweekid] || ''
    ).trim();

    if (!gameweekID) {
      return;
    }

    if (!groups[gameweekID]) {
      groups[gameweekID] = {
        gameweekID: gameweekID,
        fixtures: []
      };
    }

    groups[gameweekID].fixtures.push({
      matchID: String(row[index.matchid] || '').trim(),
      date: row[index.date],
      status: String(row[index.status] || '').trim(),
      homeGoals: toScore_(row[index.homegoals]),
      awayGoals: toScore_(row[index.awaygoals])
    });
  });

  return Object.keys(groups)
    .map(function(gameweekID) {
      return groups[gameweekID];
    })
    .filter(function(gameweek) {
      return gameweek.fixtures.length > 0 &&
        gameweek.fixtures.every(function(fixture) {
          return fixture.status.toLowerCase() === 'completed' &&
            fixture.homeGoals !== null &&
            fixture.awayGoals !== null;
        });
    })
    .sort(function(a, b) {
      return getEarliestFixtureDate_(a.fixtures) -
        getEarliestFixtureDate_(b.fixtures);
    });
}

function getEarliestFixtureDate_(fixtures) {

  let earliest = null;

  fixtures.forEach(function(fixture) {
    const date = fixture.date instanceof Date
      ? fixture.date.getTime()
      : new Date(fixture.date).getTime();

    if (!isNaN(date) && (earliest === null || date < earliest)) {
      earliest = date;
    }
  });

  return earliest === null ? Number.MAX_SAFE_INTEGER : earliest;
}

function getActivePlayersForLeaderboard_() {

  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 10)
    .getValues();

  return values
    .filter(function(row) {
      return String(row[0] || '').trim() !== '' &&
        String(row[2] || '').trim() !== '' &&
        Boolean(row[5]) === true;
    })
    .map(function(row) {
      return {
        playerID: String(row[0]).trim(),
        displayName: String(row[2]).trim()
      };
    });
}

function getPreviousLeaderboardRanks_() {

  const sheet = getSheet(SHEETS.LEADERBOARD);
  const lastRow = sheet.getLastRow();
  const ranks = {};

  if (lastRow <= 1) {
    return ranks;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 2)
    .getValues();

  values.forEach(function(row) {
    const position = Number(row[0] || 0);
    const player = String(row[1] || '').trim();

    if (position > 0 && player) {
      ranks[player] = position;
    }
  });

  return ranks;
}

function scorePredictionSet_(items, fixtureMap) {

  const score = {
    points: 0,
    exact: 0,
    margins: 0,
    results: 0
  };

  items.forEach(function(item) {

    const fixture = fixtureMap[item.matchID];

    if (!fixture ||
        item.homePrediction === '' ||
        item.awayPrediction === '' ||
        fixture.homeGoals === null ||
        fixture.awayGoals === null) {
      return;
    }

    const predictedHome = Number(item.homePrediction);
    const predictedAway = Number(item.awayPrediction);
    const actualHome = Number(fixture.homeGoals);
    const actualAway = Number(fixture.awayGoals);

    if (predictedHome === actualHome &&
        predictedAway === actualAway) {
      score.points += LEADERBOARD_POINTS.EXACT;
      score.exact += 1;
      return;
    }

    const predictedResult = getResultSign_(
      predictedHome,
      predictedAway
    );

    const actualResult = getResultSign_(
      actualHome,
      actualAway
    );

    if (predictedResult === actualResult) {
      score.results += 1;

      const predictedMargin =
        Math.abs(predictedHome - predictedAway);
      const actualMargin =
        Math.abs(actualHome - actualAway);

      if (predictedMargin === actualMargin) {
        score.points += LEADERBOARD_POINTS.MARGIN;
        score.margins += 1;
      } else {
        score.points += LEADERBOARD_POINTS.RESULT;
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

  if (!items || !fixtures || items.length !== fixtures.length) {
    return false;
  }

  const matches = {};

  items.forEach(function(item) {
    matches[String(item.matchID)] = item;
  });

  return fixtures.every(function(fixture) {
    const item = matches[String(fixture.matchID)];

    return item &&
      item.homePrediction !== '' &&
      item.awayPrediction !== '' &&
      Number.isInteger(Number(item.homePrediction)) &&
      Number.isInteger(Number(item.awayPrediction));
  });
}

function setPredictionSetSubmitted_(predictionSetID, submitted) {

  const sheet = getSheet(SHEETS.PREDICTIONSETS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

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

  if (lastRow > 1) {
    sheet
      .getRange(2, 1, lastRow - 1, 9)
      .clearContent();
  }

  if (!rows.length) {
    return;
  }

  const output = rows.map(function(row) {
    return [
      row.position,
      row.player,
      row.played,
      row.points,
      row.exact,
      row.margins,
      row.results,
      row.lastWeek,
      row.movement
    ];
  });

  sheet
    .getRange(2, 1, output.length, 9)
    .setValues(output);
}

function syncPlayerSeasonSummary_(rows) {

  const sheet = getSheet(SHEETS.PLAYERS);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 10)
    .getValues();

  const byName = {};

  rows.forEach(function(row) {
    byName[row.player] = row;
  });

  values.forEach(function(row, index) {
    const displayName = String(row[2] || '').trim();
    const calculated = byName[displayName];

    if (!calculated) {
      return;
    }

    const sheetRow = index + 2;
    sheet.getRange(sheetRow, 8, 1, 3).setValues([[
      calculated.points,
      calculated.position,
      calculated.played
    ]]);
  });
}

function formatMovement_(previousPosition, currentPosition) {

  if (!previousPosition || previousPosition === currentPosition) {
    return '—';
  }

  const movement = previousPosition - currentPosition;

  if (movement > 0) {
    return '↑ ' + movement;
  }

  return '↓ ' + Math.abs(movement);
}

function toScore_(value) {

  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    return null;
  }

  return number;
}

function testLeaderboardScoring() {
  return recalculateLeaderboard();
}
