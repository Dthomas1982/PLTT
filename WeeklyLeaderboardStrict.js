/**********************************************************************
 * PLTT Platform
 * WeeklyLeaderboardStrict.js
 *
 * Public weekly leaderboard wrapper.
 * Only prediction sets explicitly marked as submitted are displayed.
 **********************************************************************/

function getWeeklyLeaderboardPageDataStrict(gameweekID) {
  const data = getWeeklyLeaderboardPageData(gameweekID);
  if (!data || !Array.isArray(data.rows) || !data.rows.length) return data;

  const players = getActivePlayersForLeaderboard_();
  const submittedByName = {};

  players.forEach(function(player) {
    const predictionSet = getPlayerPredictionSet(player.playerID, data.gameweekID);
    submittedByName[player.displayName] = Boolean(predictionSet && predictionSet.submitted);
  });

  data.rows = data.rows.filter(function(row) {
    return submittedByName[row.player] === true;
  });

  assignPositions_(data.rows);
  writeWeeklyLeaderboardSheet_(data.rows);
  return data;
}
