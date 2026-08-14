/**********************************************************************
 * PLTT Platform
 * Fixtures.js
 * Version: 0.5.0
 *
 * Release:
 * - Prediction Centre Phase 1
 * - Fixture Display
 * - Stable Authentication Foundation
 **********************************************************************/

function getCurrentGameweekFixtures() {
  const sheet = getSheet(SHEETS.FIXTURES);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return [];

  const lastColumn = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const index = {};
  headers.forEach(function(header, i) {
    index[String(header).trim().toLowerCase()] = i;
  });

  const gameweekKey = index.gameweek !== undefined ? index.gameweek : index.gw;
  const dateKey = index.date !== undefined ? index.date : index.kickoffdate;
  const timeKey = index.time !== undefined ? index.time : index.kickofftime;
  const homeKey = index.hometeam !== undefined ? index.hometeam : index.home;
  const awayKey = index.awayteam !== undefined ? index.awayteam : index.away;
  const homeBadgeKey = index.homebadge !== undefined ? index.homebadge : index.home_logo;
  const awayBadgeKey = index.awaybadge !== undefined ? index.awaybadge : index.away_logo;

  if (gameweekKey === undefined || homeKey === undefined || awayKey === undefined) {
    throw new Error("Fixtures sheet must contain Gameweek, HomeTeam and AwayTeam columns.");
  }

  const gameweeks = values
    .map(function(row) { return String(row[gameweekKey] || "").trim(); })
    .filter(Boolean);

  if (!gameweeks.length) return [];

  const currentGameweek = gameweeks[0];

  return values
    .filter(function(row) {
      return String(row[gameweekKey] || "").trim() === currentGameweek;
    })
    .map(function(row) {
      return {
        gameweek: String(row[gameweekKey] || ""),
        date: dateKey !== undefined ? formatFixtureDate(row[dateKey]) : "",
        time: timeKey !== undefined ? formatFixtureTime(row[timeKey]) : "",
        homeTeam: String(row[homeKey] || ""),
        awayTeam: String(row[awayKey] || ""),
        homeBadge: homeBadgeKey !== undefined ? String(row[homeBadgeKey] || "") : "",
        awayBadge: awayBadgeKey !== undefined ? String(row[awayBadgeKey] || "") : ""
      };
    })
    .sort(function(a, b) {
      return (a.date + " " + a.time + " " + a.homeTeam)
        .localeCompare(b.date + " " + b.time + " " + b.homeTeam);
    });
}

function getPredictionCentreFixtures() {
  return getCurrentGameweekFixtures();
}

function formatFixtureDate(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, APP.TIMEZONE, "EEE d MMM yyyy");
  }

  return String(value);
}

function formatFixtureTime(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, APP.TIMEZONE, "HH:mm");
  }

  return String(value);
}
