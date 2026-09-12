/**********************************************************************
 * PLTT Platform
 * LeaderboardEmbedded.js
 *
 * Refreshes the leaderboard calculation, writes the authoritative
 * result to the correct Google Sheets leaderboard tab, then reads
 * that sheet back for display inside the main application.
 **********************************************************************/

function getWeeklyLeaderboardDisplayData(gameweekID) {
  const data = getWeeklyLeaderboardPageDataStrict(gameweekID || '');
  const sheet = getSheet(SHEETS.WEEKLYLEADERBOARD);

  // Always make the sheet authoritative for the UI. If there is no
  // scorable Gameweek, clear stale weekly data rather than displaying it.
  if (!data || !Array.isArray(data.rows)) {
    writeWeeklyLeaderboardSheet_([]);
  }

  const rows = readLeaderboardSheet_(sheet);

  return {
    success: true,
    gameweekID: data && data.gameweekID ? data.gameweekID : '',
    season: getCurrentSeason(),
    competitionName: getCompetitionName(),
    fixturesCompleted: data && Number(data.fixturesCompleted || 0) || 0,
    fixturesTotal: data && Number(data.fixturesTotal || 0) || 0,
    availableGameweeks: data && Array.isArray(data.availableGameweeks) ? data.availableGameweeks : [],
    rows: rows
  };
}

function getSeasonLeaderboardDisplayData() {
  // Recalculate first so the SeasonLeaderboard sheet is current.
  recalculateLeaderboard();

  // The display deliberately reads the sheet after the refresh rather
  // than using the in-memory calculation result.
  const sheet = getSheet(SHEETS.SEASONLEADERBOARD);
  const rows = readLeaderboardSheet_(sheet).filter(function(row) {
    return row.played > 0;
  });

  return {
    success: true,
    season: getCurrentSeason(),
    competitionName: getCompetitionName(),
    rows: rows
  };
}
