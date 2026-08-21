/**********************************************************************
 * PLTT Platform
 * GameweekPredictions.js
 *
 * Public Gameweek prediction board.
 * Predictions become visible only after the Gameweek deadline has passed
 * and the Gameweek has started.
 **********************************************************************/

function getAuthoritativePublicGameweek() {

  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return null;
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

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

    const startValue = row[index.startdate];
    let startDate = null;

    if (
      Object.prototype.toString.call(startValue) === '[object Date]' &&
      !isNaN(startValue.getTime())
    ) {
      startDate = startValue;
    } else if (startValue !== '' && startValue != null) {
      const parsed = new Date(startValue);
      if (!isNaN(parsed.getTime())) startDate = parsed;
    }

    if (!startDate || startDate.getTime() > now.getTime()) return;

    if (!selectedStart || startDate.getTime() > selectedStart.getTime()) {
      selected = {
        gameweekID: gameweekID,
        startDate: startDate,
        status: index.status !== undefined
          ? String(row[index.status] || '').trim()
          : ''
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

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  const displayValues = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getDisplayValues();

  const index = buildHeaderIndex(headers);
  const required = [
    'matchid',
    'seasonid',
    'gameweekid',
    'date',
    'kickoff',
    'hometeamid',
    'awayteamid'
  ];

  required.forEach(function(key) {
    if (index[key] === undefined) {
      throw new Error('Fixtures sheet must contain a ' + key + ' column.');
    }
  });

  const teams = getTeamsLookup();
  const target = String(gameweekID || '').trim();

  return values
    .map(function(row, rowIndex) {
      return { row: row, displayRow: displayValues[rowIndex] };
    })
    .filter(function(item) {
      return String(item.row[index.gameweekid] || '').trim() === target;
    })
    .map(function(item) {
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
        status: index.status !== undefined
          ? String(row[index.status] || '').trim()
          : '',
        homeTeam: teams[homeID] || null,
        awayTeam: teams[awayID] || null
      };
    })
    .sort(function(a, b) {
      return (a.date + ' ' + a.kickoff).localeCompare(
        b.date + ' ' + b.kickoff
      );
    });
}

function getGameweekPredictionBoard() {

  try {

    const gameweek = getAuthoritativePublicGameweek();

    if (!gameweek) {
      return errorResponse('No Gameweek is currently in play.');
    }

    const lockState = getGameweekLockState(gameweek.gameweekID);
    const now = new Date();
    const inPlay = gameweek.startDate.getTime() <= now.getTime();

    if (!lockState.locked || !inPlay) {
      return errorResponse(
        'Player predictions will be visible once this Gameweek is locked and in play.'
      );
    }

    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);

    const playersSheet = getSheet(SHEETS.PLAYERS);
    const playerLastRow = playersSheet.getLastRow();
    const playerLastColumn = playersSheet.getLastColumn();
    const players = [];

    if (playerLastRow > 1 && playerLastColumn > 0) {
      const playerHeaders = playersSheet
        .getRange(1, 1, 1, playerLastColumn)
        .getValues()[0];
      const playerValues = playersSheet
        .getRange(2, 1, playerLastRow - 1, playerLastColumn)
        .getValues();
      const playerIndex = buildHeaderIndex(playerHeaders);

      playerValues.forEach(function(row) {
        const playerID = String(
          playerIndex.playerid !== undefined ? row[playerIndex.playerid] : ''
        ).trim();
        const displayName = String(
          playerIndex.displayname !== undefined ? row[playerIndex.displayname] : ''
        ).trim();
        const active = playerIndex.active === undefined || Boolean(row[playerIndex.active]);

        if (playerID && displayName && active) {
          players.push({
            playerID: playerID,
            displayName: displayName,
            predictions: {}
          });
        }
      });
    }

    const playerLookup = {};
    players.forEach(function(player) {
      playerLookup[player.playerID] = player;
    });

    const setSheet = getSheet(SHEETS.PREDICTIONSETS);
    const setLastRow = setSheet.getLastRow();
    const setLastColumn = setSheet.getLastColumn();

    if (setLastRow > 1 && setLastColumn > 0) {
      const setHeaders = setSheet
        .getRange(1, 1, 1, setLastColumn)
        .getValues()[0];
      const setValues = setSheet
        .getRange(2, 1, setLastRow - 1, setLastColumn)
        .getValues();
      const setIndex = buildHeaderIndex(setHeaders);

      const currentSets = {};

      setValues.forEach(function(row) {
        const setPlayerID = String(
          setIndex.playerid !== undefined ? row[setIndex.playerid] : ''
        ).trim();
        const setGameweekID = String(
          setIndex.gameweekid !== undefined ? row[setIndex.gameweekid] : ''
        ).trim();
        const current = setIndex.current === undefined
          ? true
          : Boolean(row[setIndex.current]);
        const predictionSetID = String(
          setIndex.predictionsetid !== undefined ? row[setIndex.predictionsetid] : ''
        ).trim();

        if (
          setPlayerID &&
          setGameweekID === gameweek.gameweekID &&
          current &&
          predictionSetID &&
          playerLookup[setPlayerID]
        ) {
          currentSets[setPlayerID] = predictionSetID;
        }
      });

      const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
      const itemLastRow = itemSheet.getLastRow();
      const itemLastColumn = itemSheet.getLastColumn();

      if (itemLastRow > 1 && itemLastColumn > 0) {
        const itemHeaders = itemSheet
          .getRange(1, 1, 1, itemLastColumn)
          .getValues()[0];
        const itemValues = itemSheet
          .getRange(2, 1, itemLastRow - 1, itemLastColumn)
          .getValues();
        const itemIndex = buildHeaderIndex(itemHeaders);

        const setToPlayer = {};
        Object.keys(currentSets).forEach(function(playerID) {
          setToPlayer[currentSets[playerID]] = playerID;
        });

        itemValues.forEach(function(row) {
          const predictionSetID = String(
            itemIndex.predictionsetid !== undefined ? row[itemIndex.predictionsetid] : ''
          ).trim();
          const matchID = String(
            itemIndex.matchid !== undefined ? row[itemIndex.matchid] : ''
          ).trim();

          const playerID = setToPlayer[predictionSetID];
          if (!playerID || !matchID) return;

          playerLookup[playerID].predictions[matchID] = {
            homePrediction: row[itemIndex.homeprediction] === ''
              ? ''
              : Number(row[itemIndex.homeprediction]),
            awayPrediction: row[itemIndex.awayprediction] === ''
              ? ''
              : Number(row[itemIndex.awayprediction])
          };
        });
      }
    }

    const playerList = players.map(function(player) {
      return {
        playerID: player.playerID,
        displayName: player.displayName,
        predictions: fixtures.map(function(fixture) {
          return {
            matchID: fixture.matchID,
            homePrediction: player.predictions[fixture.matchID]
              ? player.predictions[fixture.matchID].homePrediction
              : '',
            awayPrediction: player.predictions[fixture.matchID]
              ? player.predictions[fixture.matchID].awayPrediction
              : ''
          };
        })
      };
    });

    return successResponse(
      'Gameweek Predictions Loaded',
      {
        gameweekID: gameweek.gameweekID,
        status: gameweek.status,
        locked: true,
        inPlay: true,
        fixtures: fixtures,
        players: playerList,
        submissionCount: playerList.filter(function(player) {
          return player.predictions.some(function(prediction) {
            return prediction.homePrediction !== '' || prediction.awayPrediction !== '';
          });
        }).length
      }
    );

  } catch (err) {
    logAction(
      FEATURES.PREDICTION,
      'GAMEWEEK_BOARD_ERROR',
      '',
      err.message
    );
    return errorResponse(err.message);
  }
}

function testGameweekPredictionBoard() {
  return getGameweekPredictionBoard();
}
