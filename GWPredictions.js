// Public GW submission-status and prediction board logic.
// Before deadline: show submitted players only; never expose scores.
// After deadline: show submitted players and their predictions.

function getGameweekPredictionBoard() {
  try {
    const gameweek = getAuthoritativePublicGameweek();
    if (!gameweek) return errorResponse('No Gameweek is currently in play.');

    const lockState = getGameweekLockState(gameweek.gameweekID);
    const now = new Date();
    const started = gameweek.startDate && gameweek.startDate.getTime() <= now.getTime();
    const deadlinePassed = lockState.deadline && lockState.deadline.getTime() <= now.getTime();

    if (!started) {
      return errorResponse('This Gameweek has not started yet.');
    }

    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);
    const playersSheet = getSheet(SHEETS.PLAYERS);
    const playerLastRow = playersSheet.getLastRow();
    const playerLastColumn = playersSheet.getLastColumn();
    const players = [];

    if (playerLastRow > 1 && playerLastColumn > 0) {
      const playerHeaders = playersSheet.getRange(1, 1, 1, playerLastColumn).getValues()[0];
      const playerValues = playersSheet.getRange(2, 1, playerLastRow - 1, playerLastColumn).getValues();
      const playerIndex = buildHeaderIndex(playerHeaders);

      playerValues.forEach(function(row) {
        const playerID = String(playerIndex.playerid !== undefined ? row[playerIndex.playerid] : '').trim();
        const displayName = String(playerIndex.displayname !== undefined ? row[playerIndex.displayname] : '').trim();
        const active = playerIndex.active === undefined || Boolean(row[playerIndex.active]);
        if (playerID && displayName && active) {
          players.push({ playerID: playerID, displayName: displayName });
        }
      });
    }

    const playerLookup = {};
    players.forEach(function(player) { playerLookup[player.playerID] = player; });

    const setSheet = getSheet(SHEETS.PREDICTIONSETS);
    const setLastRow = setSheet.getLastRow();
    const setLastColumn = setSheet.getLastColumn();
    const submittedPlayers = {};

    if (setLastRow > 1 && setLastColumn > 0) {
      const setHeaders = setSheet.getRange(1, 1, 1, setLastColumn).getValues()[0];
      const setValues = setSheet.getRange(2, 1, setLastRow - 1, setLastColumn).getValues();
      const setIndex = buildHeaderIndex(setHeaders);

      setValues.forEach(function(row) {
        const playerID = String(setIndex.playerid !== undefined ? row[setIndex.playerid] : '').trim();
        const gwID = String(setIndex.gameweekid !== undefined ? row[setIndex.gameweekid] : '').trim();
        const current = setIndex.current === undefined ? true : Boolean(row[setIndex.current]);
        const submitted = setIndex.submitted === undefined ? true : Boolean(row[setIndex.submitted]);
        const predictionSetID = String(setIndex.predictionsetid !== undefined ? row[setIndex.predictionsetid] : '').trim();

        if (playerID && gwID === gameweek.gameweekID && current && submitted && predictionSetID && playerLookup[playerID]) {
          submittedPlayers[playerID] = predictionSetID;
        }
      });
    }

    const submittedList = players.filter(function(player) {
      return Boolean(submittedPlayers[player.playerID]);
    }).map(function(player) {
      return {
        playerID: player.playerID,
        displayName: player.displayName
      };
    });

    // Before the deadline, deliberately stop here. No PredictionItems are read.
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

    // After the deadline, reveal the actual predictions for submitted/current sets.
    const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
    const itemLastRow = itemSheet.getLastRow();
    const itemLastColumn = itemSheet.getLastColumn();
    const predictionLookup = {};

    if (itemLastRow > 1 && itemLastColumn > 0) {
      const itemHeaders = itemSheet.getRange(1, 1, 1, itemLastColumn).getValues()[0];
      const itemValues = itemSheet.getRange(2, 1, itemLastRow - 1, itemLastColumn).getValues();
      const itemIndex = buildHeaderIndex(itemHeaders);
      const setToPlayer = {};

      Object.keys(submittedPlayers).forEach(function(playerID) {
        setToPlayer[submittedPlayers[playerID]] = playerID;
      });

      itemValues.forEach(function(row) {
        const predictionSetID = String(itemIndex.predictionsetid !== undefined ? row[itemIndex.predictionsetid] : '').trim();
        const matchID = String(itemIndex.matchid !== undefined ? row[itemIndex.matchid] : '').trim();
        const playerID = setToPlayer[predictionSetID];
        if (!playerID || !matchID) return;

        if (!predictionLookup[playerID]) predictionLookup[playerID] = {};
        predictionLookup[playerID][matchID] = {
          homePrediction: row[itemIndex.homeprediction] === '' ? '' : Number(row[itemIndex.homeprediction]),
          awayPrediction: row[itemIndex.awayprediction] === '' ? '' : Number(row[itemIndex.awayprediction])
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
