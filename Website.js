/**********************************************************************
 * PLTT Platform
 * Website.js
 * Version: 0.5.1
 *
 * Release:
 * - Prediction Centre Foundation
 * - Website configuration data layer
 * - Current Season / Gameweek / Competition settings
 *
 * Status:
 * Stable
 **********************************************************************/

function getWebsiteSettings() {
  const sheet = getSheet(SHEETS.WEBSITE);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return {};
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const settings = {};

  values.forEach(function(row) {
    const key = String(row[0] || '').trim();
    if (!key) return;
    settings[key] = String(row[1] == null ? '' : row[1]).trim();
  });

  return settings;
}

function getWebsiteSetting(key, fallback) {
  const settings = getWebsiteSettings();
  const value = settings[String(key || '').trim()];
  return value !== undefined && value !== '' ? value : (fallback || '');
}

function getCurrentSeason() {
  return getWebsiteSetting('CurrentSeason', APP.SEASON);
}

function getCurrentGameweek() {
  return getWebsiteSetting('CurrentGameweek', '');
}

function getCompetitionName() {
  return getWebsiteSetting('CompetitionName', APP.NAME);
}

function testWebsiteSettings() {
  return getWebsiteSettings();
}
