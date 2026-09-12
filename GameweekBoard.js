/**********************************************************************
 * PLTT Platform
 * GameweekBoard.js
 *
 * Public Gameweek prediction board.
 * StartDate selects the current Gameweek.
 * Deadline in the Gameweeks sheet is the authoritative lock time.
 *
 * Release fix:
 * - Show fixtures for the active Gameweek.
 * - Reveal predictions once the deadline has passed OR a fixture is live.
 * - Count genuine submitted prediction sets independently of Payments.
 * - Recover submitted sets whose Current flag is stale.
 **********************************************************************/

function getAuthoritativePublicGameweek() {
  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  if (index.gameweekid === undefined || index.startdate === undefined) {
    throw new Error('Gameweeks sheet must contain GameweekID and StartDate columns.');
  }

  const now = new Date();
  let selected = null;
  let selectedStart = null;

  values.forEach(function(row, rowIndex) {
    const id = String(row[index.gameweekid] || '').trim();
    if (!id) return;

    let start = parseGameweekBoardDate_(row[index.startdate]);
    if (!start) start = parseGameweekBoardDate_(displayValues[rowIndex][index.startdate]);
    if (!start || start.getTime() > now.getTime()) return;

    if (!selectedStart || start.getTime() > selectedStart.getTime()) {
      selectedStart = start;
      const rawDeadline = index.deadline !== undefined ? row[index.deadline] : '';
      const displayDeadline = index.deadline !== undefined ? displayValues[rowIndex][index.deadline] : '';
      const deadline = rawDeadline instanceof Date && !isNaN(rawDeadline.getTime())
        ? new Date(rawDeadline.getTime())
        : (parseGameweekBoardDate_(rawDeadline) || parseGameweekBoardDate_(displayDeadline));

      selected = {
        gameweekID: id,
        startDate: start,
        status: index.status !== undefined ? String(row[index.status] || '').trim() : '',
        deadline: deadline,
        deadlineDisplay: String(displayDeadline || '').trim()
      };
    }
  });

  return selected;
}

function parseGameweekBoardDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  if (value === '' || value == null) return null;

  const text = String(value).trim();
  if (!text) return null;

  const uk = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]) - 1;
    const year = Number(uk[3]);
    const hour = Number(uk[4] || 0);
    const minute = Number(uk[5] || 0);
    const second = Number(uk[6] || 0);
    const parsed = new Date(year, month, day, hour, minute, second);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed;
    }
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isGameweekDeadlinePassed_(deadline, now) {
  if (!deadline || isNaN(deadline.getTime())) return false;
  const timezone = APP.TIMEZONE || Session.getScriptTimeZone() || 'Europe/London';
  const deadlineKey = Utilities.formatDate(deadline, timezone, 'yyyyMMddHHmmss');
  const nowKey = Utilities.formatDate(now, timezone, 'yyyyMMddHHmmss');
  return nowKey >= deadlineKey;
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

  // First identify candidate sets. A submitted set is authoritative even if
  // Current was not maintained correctly. If Submitted is also stale, a set
  // with saved prediction items is still a genuine submission and should not
  // disappear simply because its payment record is missing.
  const candidates = {};
  values.forEach(function(row) {
    const setID = String(row[index.predictionsetid] || '').trim();
    const playerID = String(row[index.playerid] || '').trim();
    const gwID = String(row[index.gameweekid] || '').trim();
    if (!setID || !playerID || gwID !== String(gameweekID).trim()) return;

    const submitted = index.submitted !== undefined && gwBoardBool(row[index.submitted]);
    const current = index.current === undefined || gwBoardBool(row[index.current]);
    if (!candidates[playerID]) candidates[playerID] = [];
    candidates[playerID].push({setID: setID, submitted: submitted, current: current});
  });

  // Use PredictionItems to confirm a saved prediction set where Submitted is
  // stale. This deliberately does not consult Payments: payment bookkeeping
  // must never decide whether a player's football prediction was submitted.
  const itemCounts = {};
  const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
  const itemLastRow = itemSheet.getLastRow();
  const itemLastColumn = itemSheet.getLastColumn();
  if (itemLastRow > 1 && itemLastColumn > 0) {
    const itemHeaders = itemSheet.getRange(1, 1, 1, itemLastColumn).getValues()[0];
    const itemValues = itemSheet.getRange(2, 1, itemLastRow - 1, itemLastColumn).getValues();
    const itemIndex = buildHeaderIndex(itemHeaders);
    if (itemIndex.predictionsetid !== undefined) {
      itemValues.forEach(function(row) {
        const setID = String(row[itemIndex.predictionsetid] || '').trim();
        if (setID) itemCounts[setID] = (itemCounts[setID] || 0) + 1;
      });
    }
  }

  Object.keys(candidates).forEach(function(playerID) {
    const sets = candidates[playerID];
    const valid = sets.filter(function(set) {
      return set.submitted || itemCounts[set.setID] > 0;
    });
    if (!valid.length) return;

    // Prefer current, then submitted, then the latest set in sheet order.
    valid.sort(function(a, b) {
      if (a.current !== b.current) return a.current ? -1 : 1;
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      return 0;
    });
    result[playerID] = valid[0].setID;
  });

  return result;
}

function isFixtureInPlay_(fixture) {
  const status = String(fixture && fixture.status || '').trim().toLowerCase();
  return ['live', 'in play', 'in progress', 'playing', 'half time', 'ht', 'completed', 'complete', 'finished', 'full time', 'ft'].indexOf(status) !== -1;
}

function getGameweekPredictionBoard() {
  try {
    const gameweek = getAuthoritativePublicGameweek();
    if (!gameweek) return errorResponse('No Gameweek is currently in play.');
    if (!gameweek.deadline) return errorResponse('No valid deadline is configured for ' + gameweek.gameweekID + '.');

    const now = new Date();
    const fixtures = getGameweekFixturesByID(gameweek.gameweekID);
    const submitted = getGWBoardSubmissionMap(gameweek.gameweekID);

    // The deadline remains authoritative, but once a fixture is actually live
    // or completed the prediction board must be locked regardless of a stale
    // spreadsheet deadline. This prevents predictions remaining hidden while
    // matches are already being played.
    const fixtureInPlay = fixtures.some(isFixtureInPlay_);
    const deadlinePassed = isGameweekDeadlinePassed_(gameweek.deadline, now) || fixtureInPlay;

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

    const itemSheet = getSheet(SHEETS.PREDICTIONITEMS);
    const itemLastRow = itemSheet.getLastRow();
    const itemLastColumn = itemSheet.getLastColumn();
    const lookup = {};
    if (deadlinePassed && itemLastRow > 1 && itemLastColumn > 0) {
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

    return successResponse(deadlinePassed ? 'Gameweek Predictions Loaded' : 'Gameweek Submission Status Loaded', {
      gameweekID: gameweek.gameweekID,
      locked: deadlinePassed,
      inPlay: true,
      deadlinePassed: deadlinePassed,
      submissionOnly: !deadlinePassed,
      deadline: gameweek.deadline.toISOString(),
      deadlineDisplay: gameweek.deadlineDisplay,
      serverNow: now.toISOString(),
      fixtures: fixtures,
      players: playerList,
      submissionCount: players.length
    });
  } catch (err) {
    logAction(FEATURES.PREDICTION, 'GAMEWEEK_BOARD_ERROR', '', err.message);
    return errorResponse(err.message);
  }
}

function testGameweekPredictionBoard() {
  return getGameweekPredictionBoard();
}
