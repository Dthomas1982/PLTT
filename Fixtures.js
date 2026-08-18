/**********************************************************************
 * PLTT Platform
 * Fixtures.js
 * Version: 0.5.3
 *
 * Release:
 * - Prediction Centre fixture pipeline
 * - Teams sheet remains source of truth
 * - Plain serializable fixture objects
 * - Date and kick-off ordering
 *
 * Status:
 * Production
 **********************************************************************/

function getCurrentGameweekFixtures() {

  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return [];
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  // Use the sheet's displayed values for presentation fields such as
  // Date and KickOff. This preserves exactly what the Fixtures sheet shows
  // and avoids Apps Script timezone conversion changing the displayed time.
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
      throw new Error(
        'Fixtures sheet must contain a ' +
        key +
        ' column.'
      );
    }
  });

  const gameweeks = values
    .map(function(row) {
      return String(
        row[index.gameweekid] || ''
      ).trim();
    })
    .filter(Boolean);

  if (!gameweeks.length) {
    return [];
  }

  const currentGameweek = getCurrentGameweek();

  const targetGameweek =
    currentGameweek || gameweeks[0];

  const teams = getTeamsLookup();

  return values
    .map(function(row, rowIndex) {
      return {
        row: row,
        displayRow: displayValues[rowIndex]
      };
    })
    .filter(function(item) {
      return String(
        item.row[index.gameweekid] || ''
      ).trim() === targetGameweek;
    })
    .map(function(item) {

      const row = item.row;
      const displayRow = item.displayRow;

      const homeTeamID = String(
        row[index.hometeamid] || ''
      ).trim().toUpperCase();

      const awayTeamID = String(
        row[index.awayteamid] || ''
      ).trim().toUpperCase();

      const homeTeam =
        teams[homeTeamID] || null;

      const awayTeam =
        teams[awayTeamID] || null;

      return {
        matchID: String(
          row[index.matchid] || ''
        ),
        seasonID: String(
          row[index.seasonid] || ''
        ),
        gameweekID: targetGameweek,
        date: String(
          displayRow[index.date] || ''
        ).trim(),
        kickoff: String(
          displayRow[index.kickoff] || ''
        ).trim(),
        status:
          index.status !== undefined
            ? String(row[index.status] || '')
            : '',
        homeTeam: homeTeam,
        awayTeam: awayTeam
      };
    })
    .sort(function(a, b) {

      const left =
        a.date + ' ' +
        a.kickoff + ' ' +
        (a.homeTeam
          ? a.homeTeam.clubName
          : '');

      const right =
        b.date + ' ' +
        b.kickoff + ' ' +
        (b.homeTeam
          ? b.homeTeam.clubName
          : '');

      return left.localeCompare(right);
    });
}

function getPredictionCentreFixtures() {
  return getCurrentGameweekFixtures();
}

function formatFixtureDate(value) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value)
  ) {

    return Utilities.formatDate(
      value,
      APP.TIMEZONE,
      'EEE d MMM yyyy'
    );
  }

  return String(value);
}

function formatFixtureTime(value) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value)
  ) {

    return Utilities.formatDate(
      value,
      APP.TIMEZONE,
      'HH:mm'
    );
  }

  return String(value);
}

function testCurrentGameweekFixtures() {
  return getCurrentGameweekFixtures();
}
