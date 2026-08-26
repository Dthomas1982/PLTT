/**********************************************************************
 * PLTT Dashboard fixture feed
 * Isolated from the Prediction Centre fixture pipeline.
 **********************************************************************/
function getFullSeasonFixtures() {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) return successResponse('No fixtures available.', { fixtures: [] });

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const index = buildHeaderIndex(headers);
  ['matchid','seasonid','gameweekid','date','kickoff','hometeamid','awayteamid'].forEach(function(key) {
    if (index[key] === undefined) throw new Error('Fixtures sheet must contain a ' + key + ' column.');
  });

  const teams = getTeamsLookup();
  const fixtures = values.map(function(row, rowIndex) {
    const displayRow = displayValues[rowIndex];
    const homeID = String(row[index.hometeamid] || '').trim().toUpperCase();
    const awayID = String(row[index.awayteamid] || '').trim().toUpperCase();
    return {
      matchID: String(row[index.matchid] || ''),
      seasonID: String(row[index.seasonid] || ''),
      gameweekID: String(row[index.gameweekid] || '').trim(),
      date: String(displayRow[index.date] || '').trim(),
      kickoff: String(displayRow[index.kickoff] || '').trim(),
      status: index.status !== undefined ? String(row[index.status] || '').trim() : '',
      homeGoals: index.homegoals !== undefined && row[index.homegoals] !== '' ? Number(row[index.homegoals]) : null,
      awayGoals: index.awaygoals !== undefined && row[index.awaygoals] !== '' ? Number(row[index.awaygoals]) : null,
      homeTeam: teams[homeID] || null,
      awayTeam: teams[awayID] || null
    };
  }).filter(function(fixture) {
    return fixture.gameweekID;
  }).sort(function(a, b) {
    const gw = a.gameweekID.localeCompare(b.gameweekID, undefined, { numeric: true });
    return gw !== 0 ? gw : (a.date + ' ' + a.kickoff).localeCompare(b.date + ' ' + b.kickoff);
  });

  return successResponse('Full Season Fixtures Loaded', { fixtures: fixtures });
}
