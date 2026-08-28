/**********************************************************************
 * PLTT Platform
 * GameweekBoard.js
 *
 * Public Gameweek prediction board and shared Gameweek fixture helpers.
 * Before deadline: show submitted players only; never expose scores.
 * After deadline: show submitted players and their predictions.
 **********************************************************************/

function getAuthoritativePublicGameweek() {
  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const index = buildHeaderIndex(headers);
  if (index.gameweekid === undefined || index.startdate === undefined) {
    throw new Error('Gameweeks sheet must contain GameweekID and StartDate columns.');
  }

  const now = new Date();
  let selected = null;
  let selectedStart = null;

  values.forEach(function(row) {
    const gameweekID = String(row[index.gameweekid] || '').trim();
    if (!gameweekID) return;
    const value = row[index.startdate];
    let startDate = null;
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      startDate = value;
    } else if (value !== '' && value != null) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) startDate = parsed;
    }
    if (!startDate || startDate.getTime() > now.getTime()) return;
    if (!selectedStart || startDate.getTime() > selectedStart.getTime()) {
      selected = {
        gameweekID: gameweekID,
        startDate: startDate,
        status: index.status !== undefined ? String(row[index.status] || '').trim() : ''
      };
      selectedStart = startDate;
    }
  });
  return selected;
}

function getGameweekFixturesByID(gameweekID) {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  ['matchid','seasonid','gameweekid','date','kickoff','hometeamid','awayteamid'].forEach(function(key) {
    if (index[key] === undefined) throw new Error('Fixtures sheet must contain a ' + key + ' column.');
  });

  const teams = getTeamsLookup();
  const target = String(gameweekID || '').trim();
  return values.map(function(row, rowIndex) {
    return {row: row, displayRow: displayValues[rowIndex]};
  }).filter(function(item) {
    return String(item.row[index.gameweekid] || '').trim() === target;
  }).map(function(item) {
    const row = item.row;
    const displayRow = item.displayRow;
    const homeID = String(row[index.hometeamid] || '').trim().toUpperCase();
    const awayID = String(row[index.awayteamid] || '').trim().toUpperCase();
    return {
      matchID: String(row[index.matchid] || ''),
      seasonID: String(row[index.seasonid] || ''),
      gameweekID: target,
      date: String(displayRow[index.date] || '').trim(),
      kickoff: String(displayRow[index.kickoff] || '').trim(),
      status: index.status !== undefined ? String(row[index.status] || '').trim() : '',
      homeTeam: teams[homeID] || null,
      awayTeam: teams[awayID] || null
    };
  }).sort(function(a, b) {
    return (a.date + ' ' + a.kickoff).localeCompare(b.date + ' ' + b.kickoff);
  });
}

function gameweekBoardTruthy(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return ['true','yes','1','y'].indexOf(value.trim().toLowerCase()) !== -1;
  return false;
}

/**
 * Build the authoritative list of submitted Prediction Sets for a Gameweek.
 * Submission is recognised from Submitted OR from saved PredictionItems.
 * This deliberately does not depend on fixed column positions or on the
 * Players sheet Active flag.
 */
function getSubmittedPredictionSetsForGameweek(gameweekID) {
  const result = {};
  const target = String(gameweekID || '').trim();
  if (!target) return result;

  const setSheet = getSheet(SHEETS.PREDICTIONSETS);
  const setLastRow = setSheet.getLastRow();
  const setLastColumn = setSheet.getLastColumn();
  if (setLastRow <= 1 || setLastColumn <= 0) return result;

  const setHeaders = setSheet.getRange(1, 1, 1, setLastColumn).getValues()[0];
  const setIndex = buildHeaderIndex(setHeaders);
  if (setIndex.predictionsetid === undefined || setIndex.playerid === undefined || setIndex.gameweekid === undefined) {
    throw new Error('PredictionSets sheet must contain PredictionSetID, PlayerID and GameweekID columns.');
  }

  const setValues = setSheet.getRange(2, 1, setLastRow - 1, setLastColumn).getValues();
  const candidateSets = {};

  setValues.forEach(function(row) {
    const setID = String(row[setIndex.predictionsetid] || '').trim();
    const playerID = String(row[setIndex.playerid] || '').trim();
    const gwID = String(row[setIndex.gameweekid] || '').trim();
    if (!setID || !playerID || gwID !== target) return;

    const current = setIndex.current === undefined ? true : gameweekBoardTruthy(row[setIndex.current]);
    const submitted = setIndex.submitted !== undefined && gameweekBoardTruthy(row[setIndex.submitted]);
    if (current || submitted) {
      candidateSets[setID] = {playerID: playerID, submitted: submitted};
    }
  });

  // Any saved item is definitive evidence that a prediction set contains a
  // submission, even if an older record has Submitted/Current stored oddly.
  const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
  const itemLastRow = itemSheet.getLastRow();
  const itemLastColumn = itemSheet.getLastColumn();
  if (itemLastRow > 1 && itemLastColumn > 0) {
    const itemHeaders = itemSheet.getRange(1, 1, 1, itemLastColumn).getValues()[0];
    const itemIndex = buildHeaderIndex(itemHeaders);
    if (itemIndex.predictionsetid !== undefined) {
      const itemValues = itemSheet.getRange(2, 1, itemLastRow - 1, itemLastColumn).getValues();
      itemValues.forEach(function(row) {
        const setID = String(row[itemIndex.predictionsetid] || '').trim();
        if (setID && candidateSets[setID]) result[setID] = candidateSets[setID].playerID;
      });
    }
  }

  Object.keys(candidateSets).forEach(function(setID) {
    if (candidateSets[setID].submitted) result[setID] = candidateSets[setID].playerID;
  });

  return result;
}

function getGameweekPredictionBoard() {
  try {
    const gameweek = getAuthoritativePublicGameweek();
    if (!gameweek) return errorResponse('No Gameweek is currently in play.');

    const lockState = getGameweekLockState(gameweek.gameweekID);
    const started = gameweek.startDate && gameweek.startDate.getTime() <= new Date().getTime();
    const deadlinePassed = lockState.deadline && lockState.deadline.getTime() <= new Date().getTime();
    if (!started) return errorResponse('This Gameweek has not started yet.');

    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);
    const playersSheet = getSheet(SHEETS.PLAYERS);
    const playerLastRow = playersSheet.getLastRow();
    const playerLastColumn = playersSheet.getLastColumn();
    const playerLookup = {};

    if (playerLastRow > 1 && playerLastColumn > 0) {
      const headers = playersSheet.getRange(1, 1, 1, playerLastColumn).getValues()[0];
      const values = playersSheet.getRange(2, 1, playerLastRow - 1, playerLastColumn).getValues();
      const index = buildHeaderIndex(headers);
      values.forEach(function(row) {
        const playerID = String(index.playerid !== undefined ? row[index.playerid] : '').trim();
        const displayName = String(index.displayname !== undefined ? row[index.displayname] : '').trim();
        if (playerID) playerLookup[playerID] = displayName || playerID;
      });
    }

    const submittedSets = getSubmittedPredictionSetsForGameweek(gameweek.gameweekID);
    const submittedPlayerIDs = {};
    Object.keys(submittedSets).forEach(function(setID) {
      submittedPlayerIDs[submittedSets[setID]] = setID;
    });

    const submittedList = Object.keys(submittedPlayerIDs).map(function(playerID) {
      return {
        playerID: playerID,
        displayName: playerLookup[playerID] || playerID
      };
    }).sort(function(a, b) {
      return a.displayName.localeCompare(b.displayName);
    });

    if (!deadlinePassed || !lockState.locked) {
      return successResponse('Gameweek Submission Status Loaded', {
        gameweekID: gameweek.gameweekID,
        status: gameweek.status,
        locked: false,
        inPlay: true,
        deadlinePassed: false,
        submissionOnly: true,
        fixtures: [],
        players: submittedList,
        submissionCount: submittedList.length
      });
    }

    const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
    const itemLastRow = itemSheet.getLastRow();
    const itemLastColumn = itemSheet.getLastColumn();
    const predictionLookup = {};

    if (itemLastRow > 1 && itemLastColumn > 0) {
      const headers = itemSheet.getRange(1, 1, 1, itemLastColumn).getValues()[0];
      const values = itemSheet.getRange(2, 1, itemLastRow - 1, itemLastColumn).getValues();
      const index = buildHeaderIndex(headers);
      const setToPlayer = {};
      Object.keys(submittedSets).forEach(function(setID) {
        setToPlayer[setID] = submittedSets[setID];
      });

      values.forEach(function(row) {
        const predictionSetID = String(index.predictionsetid !== undefined ? row[index.predictionsetid] : '').trim();
        const matchID = String(index.matchid !== undefined ? row[index.matchid] : '').trim();
        const playerID = setToPlayer[predictionSetID];
        if (!playerID || !matchID) return;
        if (!predictionLookup[playerID]) predictionLookup[playerID] = {};
        predictionLookup[playerID][matchID] = {
          homePrediction: row[index.homeprediction] === '' ? '' : Number(row[index.homeprediction]),
          awayPrediction: row[index.awayprediction] === '' ? '' : Number(row[index.awayprediction])
        };
      });
    }

    const playerList = submittedList.map(function(player) {
      return {
        playerID: player.playerID,
        displayName: player.displayName,
        predictions: fixtures.map(function(fixture) {
          const prediction = predictionLookup[player.playerID] && predictionLookup[player.playerID][fixture.matchID];
          return {
            matchID: fixture.matchID,
            homePrediction: prediction ? prediction.homePrediction : '',
            awayPrediction: prediction ? prediction.awayPrediction : ''
          };
        })
      };
    });

    return successResponse('Gameweek Predictions Loaded', {
      gameweekID: gameweek.gameweekID,
      status: gameweek.status,
      locked: true,
      inPlay: true,
      deadlinePassed: true,
      submissionOnly: false,
      fixtures: fixtures,
      players: playerList,
      submissionCount: playerList.length
    });
  } catch (err) {
    logAction(FEATURES.PREDICTION, 'GAMEWEEK_BOARD_ERROR', '', err.message);
    return errorResponse(err.message);
  }
}

function testGameweekPredictionBoard() {
  return getGameweekPredictionBoard();
}
