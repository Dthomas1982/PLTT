/**********************************************************************
 * PLTT Platform
 * Website.js
 * Version: 0.5.2
 *
 * Release:
 * - Prediction Centre Integration
 * - Stable Website Settings Layer
 * - Legacy + camelCase compatibility
 *
 * Status:
 * Production
 **********************************************************************/

function getWebsiteSettings() {

  const sheet = getSheet(SHEETS.WEBSITE);

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {

    return {

      CurrentSeason: APP.SEASON,
      CurrentGameweek: "",
      CompetitionName: APP.NAME,

      currentSeason: APP.SEASON,
      currentGameweek: "",
      competitionName: APP.NAME

    };

  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    )
    .getValues();

  const settings = {};

  values.forEach(function(row) {

    const key =
      String(row[0] || "")
        .trim();

    if (!key) {
      return;
    }

    settings[key] =
      String(
        row[1] == null
          ? ""
          : row[1]
      ).trim();

  });

  settings.currentSeason =
    settings.CurrentSeason ||
    APP.SEASON;

  settings.currentGameweek =
    settings.CurrentGameweek ||
    "";

  settings.competitionName =
    settings.CompetitionName ||
    APP.NAME;

  return settings;

}

function getWebsiteSetting(
  key,
  fallback
) {

  const settings =
    getWebsiteSettings();

  const value =
    settings[
      String(key || "").trim()
    ];

  return (

    value !== undefined &&

    value !== ""

  )

    ? value

    : (fallback || "");

}

function getCurrentSeason() {

  return getWebsiteSettings()
    .currentSeason;

}

function getCurrentGameweek() {

  return getWebsiteSettings()
    .currentGameweek;

}

function getCompetitionName() {

  return getWebsiteSettings()
    .competitionName;

}

function testWebsiteSettings() {

  Logger.log(

    JSON.stringify(

      getWebsiteSettings(),

      null,

      2

    )

  );

}