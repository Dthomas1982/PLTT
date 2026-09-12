/**********************************************************************
 * PLTT Platform
 * SelectionHistoryFast.js
 *
 * Fast default loader for Selection History.
 * Loads the logged-in player and current Gameweek only.
 **********************************************************************/

function getSelectionHistoryCurrent(playerID) {
  playerID = String(playerID || '').trim();
  if (!playerID) return errorResponse('Player ID is required.');

  const currentGameweekID = String(resolveAuthoritativeGameweekID() || '').trim();
  return getSelectionHistoryFiltered(playerID, currentGameweekID);
}
