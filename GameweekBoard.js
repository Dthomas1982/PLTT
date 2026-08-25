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

function getGameweekPredictionBoard() {
  try {
    const gameweek = getAuthoritativePublicGameweek();
    if (!gameweek) return errorResponse('No Gameweek is currently in play.');

    const lockState = getGameweekLockState(gameweek.gameweekID);
    const now = new Date();
    const started = gameweek.startDate && gameweek.startDate.getTime() <= now.getTime();
    const deadlinePassed = lockState.deadline && lockState.deadline.getTime() <= now.getTime();

    if (!started) return errorResponse('This Gameweek has not started yet.');

    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);
    const playersSheet = getSheet(SHEETS.PLAYERS);
    const playerLastRow = playersSheet.getLastRow();
    const playerLastColumn = playersSheet.getLastColumn();
    const players = [];

    if (playerLastRow > 1 && playerLastColumn > 0) {
      const headers = playersSheet.getRange(1, 1, 1, playerLastColumn).getValues()[0];
      const values = playersSheet.getRange(2, 1, playerLastRow - 1, playerLastColumn).getValues();
      const index = buildHeaderIndex(headers);
      values.forEach(function(row) {
        const playerID = String(index.playerid !== undefined ? row[index.playerid] : '').trim();
        const displayName = String(index.displayname !== undefined ? row[index.displayname] : '').trim();
        const active = index.active === undefined || Boolean(row[index.active]);
        if (playerID && displayName && active) players.push({playerID: playerID, displayName: displayName});
      });
    }

    const playerLookup = {};
    players.forEach(function(player) { playerLookup[player.playerID] = player; });

    const setSheet = getSheet(SHEETS.PREDICTIONSETS);
    const setLastRow = setSheet.getLastRow();
    const setLastColumn = setSheet.getLastColumn();
    const submittedPlayers = {};

    if (setLastRow > 1 && setLastColumn > 0) {
      const headers = setSheet.getRange(1, 1, 1, setLastColumn).getValues()[0];
      const values = setSheet.getRange(2, 1, setLastRow - 1, setLastColumn).getValues();
      const index = buildHeaderIndex(headers);

      values.forEach(function(row) {
        const playerID = String(index.playerid !== undefined ? row[index.playerid] : '').trim();
        const gwID = String(index.gameweekid !== undefined ? row[index.gameweekid] : '').trim();
        const current = index.current === undefined ? true : Boolean(row[index.current]);
        const submitted = index.submitted === undefined ? true : Boolean(row[index.submitted]);
        const predictionSetID = String(index.predictionsetid !== undefined ? row[index.predictionsetid] : '').trim();

        if (playerID && gwID === gameweek.gameweekID && current && submitted && predictionSetID && playerLookup[playerID]) {
          submittedPlayers[playerID] = predictionSetID;
        }
      });
    }

    const submittedList = players.filter(function(player) {
      return Boolean(submittedPlayers[player.playerID]);
    }).map(function(player) {
      return {playerID: player.playerID, displayName: player.displayName};
    });

    // Before the deadline, expose submission status only. PredictionItems are
    // deliberately not read until the authoritative deadline has passed.
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

      Object.keys(submittedPlayers).forEach(function(playerID) {
        setToPlayer[submittedPlayers[playerID]] = playerID;
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
