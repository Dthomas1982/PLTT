/**********************************************************************
 * PLTT Platform
 * GWSubmissionStatus.js
 *
 * Public submission-status board.
 * Before the deadline: show who has submitted, never their predictions.
 **********************************************************************/

function getGameweekSubmissionStatus() {
  try {
    const gameweek = getAuthoritativePublicGameweek();

    if (!gameweek) {
      return errorResponse('No Gameweek is currently in play.');
    }

    const lockState = getGameweekLockState(gameweek.gameweekID);
    const now = new Date();
    const started = gameweek.startDate.getTime() <= now.getTime();
    const deadlinePassed = lockState.deadline && lockState.deadline.getTime() <= now.getTime();

    // Once the deadline has passed, use the established public board so the
    // existing scoring/prediction display remains unchanged.
    if (started && deadlinePassed && lockState.locked) {
      const board = getGameweekPredictionBoard();
      if (!board || !board.success) return board;
      board.data.predictionsVisible = true;
      return board;
    }

    const playersSheet = getSheet(SHEETS.PLAYERS);
    const playerLastRow = playersSheet.getLastRow();
    const playerLastColumn = playersSheet.getLastColumn();
    const playersByID = {};

    if (playerLastRow > 1 && playerLastColumn > 0) {
      const headers = playersSheet.getRange(1, 1, 1, playerLastColumn).getValues()[0];
      const values = playersSheet.getRange(2, 1, playerLastRow - 1, playerLastColumn).getValues();
      const index = buildHeaderIndex(headers);

      values.forEach(function(row) {
        const playerID = String(index.playerid !== undefined ? row[index.playerid] : '').trim();
        const displayName = String(index.displayname !== undefined ? row[index.displayname] : '').trim();
        const active = index.active === undefined || Boolean(row[index.active]);
        if (playerID && displayName && active) {
          playersByID[playerID] = displayName;
        }
      });
    }

    const submittedPlayers = [];
    const setSheet = getSheet(SHEETS.PREDICTIONSETS);
    const setLastRow = setSheet.getLastRow();
    const setLastColumn = setSheet.getLastColumn();

    if (setLastRow > 1 && setLastColumn > 0) {
      const headers = setSheet.getRange(1, 1, 1, setLastColumn).getValues()[0];
      const values = setSheet.getRange(2, 1, setLastRow - 1, setLastColumn).getValues();
      const index = buildHeaderIndex(headers);
      const seen = {};

      values.forEach(function(row) {
        const playerID = String(index.playerid !== undefined ? row[index.playerid] : '').trim();
        const gameweekID = String(index.gameweekid !== undefined ? row[index.gameweekid] : '').trim();
        const current = index.current === undefined ? true : Boolean(row[index.current]);
        const submitted = index.submitted === undefined ? false : Boolean(row[index.submitted]);

        if (playerID && gameweekID === gameweek.gameweekID && current && submitted && playersByID[playerID] && !seen[playerID]) {
          seen[playerID] = true;
          submittedPlayers.push({
            playerID: playerID,
            displayName: playersByID[playerID]
          });
        }
      });
    }

    submittedPlayers.sort(function(a, b) {
      return a.displayName.localeCompare(b.displayName);
    });

    return successResponse('Gameweek Submission Status Loaded', {
      gameweekID: gameweek.gameweekID,
      status: gameweek.status,
      predictionsVisible: false,
      submissionCount: submittedPlayers.length,
      submittedPlayers: submittedPlayers
    });

  } catch (err) {
    logAction(FEATURES.PREDICTION, 'GAMEWEEK_SUBMISSION_STATUS_ERROR', '', err.message);
    return errorResponse(err.message);
  }
}
