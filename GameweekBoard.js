/**********************************************************************
 * PLTT Platform
 * GameweekBoard.js
 *
 * Public Gameweek prediction board.
 * StartDate selects the current Gameweek.
 * Deadline controls when predictions become visible.
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
    const id = String(row[index.gameweekid] || '').trim();
    if (!id) return;
    const value = row[index.startdate];
    let start = null;
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      start = new Date(value.getTime());
    } else if (value !== '' && value != null) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) start = parsed;
    }
    if (!start || start.getTime() > now.getTime()) return;
    if (!selectedStart || start.getTime() > selectedStart.getTime()) {
      selectedStart = start;
      selected = {
        gameweekID: id,
        startDate: start,
        status: index.status !== undefined ? String(row[index.status] || '').trim() : ''
      };
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
  return values.map(function(row, i) { return {row: row, displayRow: displayValues[i]}; })
    .filter(function(item) { return String(item.row[index.gameweekid] || '').trim() === target; })
    .map(function(item) {
      const row = item.row, displayRow = item.displayRow;
      const homeID = String(row[index.hometeamid] || '').trim().toUpperCase();
      const awayID = String(row[index.awayteamid] || '').trim().toUpperCase();
      return {
        matchID: String(row[index.matchid] || ''), seasonID: String(row[index.seasonid] || ''),
        gameweekID: target, date: String(displayRow[index.date] || '').trim(),
        kickoff: String(displayRow[index.kickoff] || '').trim(),
        status: index.status !== undefined ? String(row[index.status] || '').trim() : '',
        homeTeam: teams[homeID] || null, awayTeam: teams[awayID] || null
      };
    }).sort(function(a,b) { return (a.date + ' ' + a.kickoff).localeCompare(b.date + ' ' + b.kickoff); });
}

function gwBoardBool(value) {
  if (value === true || value === 1) return true;
  return typeof value === 'string' && ['true','yes','1','y'].indexOf(value.trim().toLowerCase()) !== -1;
}

function getGWBoardSubmissionMap(gameweekID) {
  const result = {};
  const sheet = getSheet(SHEETS.PREDICTIONSETS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return result;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const index = buildHeaderIndex(headers);
  if (index.predictionsetid === undefined || index.playerid === undefined || index.gameweekid === undefined) {
    throw new Error('PredictionSets sheet must contain PredictionSetID, PlayerID and GameweekID columns.');
  }

  values.forEach(function(row) {
    const setID = String(row[index.predictionsetid] || '').trim();
    const playerID = String(row[index.playerid] || '').trim();
    const gwID = String(row[index.gameweekid] || '').trim();
    if (!setID || !playerID || gwID !== String(gameweekID).trim()) return;

    const submitted = index.submitted !== undefined && gwBoardBool(row[index.submitted]);
    const current = index.current === undefined || gwBoardBool(row[index.current]);
    if (!current) return;
    if (submitted) result[playerID] = setID;
  });
  return result;
}

function getGameweekPredictionBoard() {
  try {
    const gameweek = getAuthoritativePublicGameweek();
    if (!gameweek) return errorResponse('No Gameweek is currently in play.');

    const lockState = getGameweekLockState(gameweek.gameweekID);
    if (!lockState.deadline) return errorResponse('No valid deadline is configured for ' + gameweek.gameweekID + '.');

    const now = new Date();
    const deadlinePassed = now.getTime() >= lockState.deadline.getTime();
    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);
    const submitted = getGWBoardSubmissionMap(gameweek.gameweekID);

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
        const name = String(index.displayname !== undefined ? row[index.displayname] : '').trim();
        if (playerID) playerLookup[playerID] = name || playerID;
      });
    }

    const playerIDs = Object.keys(submitted);
    const players = playerIDs.map(function(playerID) {
      return { playerID: playerID, displayName: playerLookup[playerID] || playerID };
    }).sort(function(a,b) { return a.displayName.localeCompare(b.displayName); });

    if (!deadlinePassed) {
      return successResponse('Gameweek Submission Status Loaded', {
        gameweekID: gameweek.gameweekID,
        locked: false,
        inPlay: true,
        deadlinePassed: false,
        submissionOnly: true,
        fixtures: [],
        players: players,
        submissionCount: players.length
      });
    }

    const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
    const itemLastRow = itemSheet.getLastRow();
    const itemLastColumn = itemSheet.getLastColumn();
    const lookup = {};
    if (itemLastRow > 1 && itemLastColumn > 0) {
      const headers = itemSheet.getRange(1, 1, 1, itemLastColumn).getValues()[0];
      const values = itemSheet.getRange(2, 1, itemLastRow - 1, itemLastColumn).getValues();
      const index = buildHeaderIndex(headers);
      values.forEach(function(row) {
        const setID = String(index.predictionsetid !== undefined ? row[index.predictionsetid] : '').trim();
        if (!setID) return;
        const playerID = playerIDs.find(function(id) { return submitted[id] === setID; });
        if (!playerID) return;
        const matchID = String(index.matchid !== undefined ? row[index.matchid] : '').trim();
        if (!matchID) return;
        if (!lookup[playerID]) lookup[playerID] = {};
        lookup[playerID][matchID] = {
          homePrediction: index.homeprediction !== undefined && row[index.homeprediction] !== '' ? Number(row[index.homeprediction]) : '',
          awayPrediction: index.awayprediction !== undefined && row[index.awayprediction] !== '' ? Number(row[index.awayprediction]) : ''
        };
      });
    }

    const playerList = players.map(function(player) {
      return {
        playerID: player.playerID,
        displayName: player.displayName,
        predictions: fixtures.map(function(fixture) {
          const p = lookup[player.playerID] && lookup[player.playerID][fixture.matchID];
          return {matchID: fixture.matchID, homePrediction: p ? p.homePrediction : '', awayPrediction: p ? p.awayPrediction : ''};
        })
      };
    });

    return successResponse('Gameweek Predictions Loaded', {
      gameweekID: gameweek.gameweekID,
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
