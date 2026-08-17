/**********************************************************************
 * PLTT Platform
 * Website.js
 * Version: 0.5.3
 *
 * Release:
 * - Prediction Centre integration
 * - Website configuration data layer
 * - Current Season / Gameweek / Competition settings
 * - Stable Authentication Foundation
 *
 * Status:
 * Production
 **********************************************************************/

function getWebsiteSettings() {

  const sheet = getSheet(SHEETS.WEBSITE);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  const defaults = {
    CurrentSeason: APP.SEASON,
    CurrentGameweek: '',
    CompetitionName: APP.NAME
  };

  if (lastRow <= 1 || lastColumn <= 0) {
    return {
      CurrentSeason: defaults.CurrentSeason,
      CurrentGameweek: defaults.CurrentGameweek,
      CompetitionName: defaults.CompetitionName,
      currentSeason: defaults.CurrentSeason,
      currentGameweek: defaults.CurrentGameweek,
      competitionName: defaults.CompetitionName
    };
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  const settings = {};

  values.forEach(function(row) {

    const key = String(row[0] || '').trim();

    if (!key) {
      return;
    }

    settings[key] = String(
      row[1] == null ? '' : row[1]
    ).trim();
  });

  settings.CurrentSeason =
    settings.CurrentSeason ||
    defaults.CurrentSeason;

  settings.CurrentGameweek =
    settings.CurrentGameweek ||
    defaults.CurrentGameweek;

  settings.CompetitionName =
    settings.CompetitionName ||
    defaults.CompetitionName;

  return {
    CurrentSeason: settings.CurrentSeason,
    CurrentGameweek: settings.CurrentGameweek,
    CompetitionName: settings.CompetitionName,
    currentSeason: settings.CurrentSeason,
    currentGameweek: settings.CurrentGameweek,
    competitionName: settings.CompetitionName
  };
}

function getWebsiteSetting(key, fallback) {

  const settings = getWebsiteSettings();
  const value = settings[String(key || '').trim()];

  return value !== undefined && value !== ''
    ? value
    : (fallback || '');
}

function getCurrentSeason() {
  return getWebsiteSettings().currentSeason;
}

function getCurrentGameweek() {
  return getWebsiteSettings().currentGameweek;
}

function getCompetitionName() {
  return getWebsiteSettings().competitionName;
}

function testWebsiteSettings() {
  return getWebsiteSettings();
}
