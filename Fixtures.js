/**********************************************************************
 * PLTT Platform
 * Fixtures.js
 * Version: 0.5.0.1
 *
 * Release:
 * - Data Layer Foundation
 * - Fixtures joined to Teams sheet data
 * - Plain serializable fixture objects
 * - Stable Authentication Foundation
 *
 * Status:
 * Stable
 **********************************************************************/

function getCurrentGameweekFixtures() {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const index = buildHeaderIndex(headers);

  const required = ['matchid', 'seasonid', 'gameweekid', 'date', 'kickoff', 'hometeamid', 'awayteamid'];
  required.forEach(function(key) {
    if (index[key] === undefined) {
      throw new Error('Fixtures sheet must contain a ' + key + ' column.');
    }
  });

  const gameweeks = values
    .map(function(row) {
      return String(row[index.gameweekid] || '').trim();
    })
    .filter(Boolean);

  if (!gameweeks.length) {
    return [];
  }

  const currentGameweek = gameweeks[0];
  const teams = getTeamsLookup();

  return values
    .filter(function(row) {
      return String(row[index.gameweekid] || '').trim() === currentGameweek;
    })
    .map(function(row) {
      const homeTeamID = String(row[index.hometeamid] || '').trim().toUpperCase();
      const awayTeamID = String(row[index.awayteamid] || '').trim().toUpperCase();

      return {
        matchID: String(row[index.matchid] || ''),
        seasonID: String(row[index.seasonid] || ''),
        gameweekID: currentGameweek,
        date: formatFixtureDate(row[index.date]),
        kickoff: formatFixtureTime(row[index.kickoff]),
        status: index.status !== undefined ? String(row[index.status] || '') : '',
        homeTeam: teams[homeTeamID] || null,
        awayTeam: teams[awayTeamID] || null
      };
    })
    .sort(function(a, b) {
      return (a.date + ' ' + a.kickoff + ' ' + (a.homeTeam ? a.homeTeam.clubName : ''))
        .localeCompare(b.date + ' ' + b.kickoff + ' ' + (b.homeTeam ? b.homeTeam.clubName : ''));
    });
}

function getPredictionCentreFixtures() {
  return getCurrentGameweekFixtures();
}

function formatFixtureDate(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, APP.TIMEZONE, 'EEE d MMM yyyy');
  }

  return String(value);
}

function formatFixtureTime(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, APP.TIMEZONE, 'HH:mm');
  }

  return String(value);
}

function testCurrentGameweekFixtures() {
  return getCurrentGameweekFixtures();
}
