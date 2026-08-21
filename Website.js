/**********************************************************************
 * PLTT Platform
 * Website.js
 * Version: 0.5.3
 *
 * Release:
 * - Prediction Centre Integration
 * - Stable Website Settings Layer
 * - Legacy + camelCase compatibility
 * - Gameweek deadline enforcement support
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

/**
 * Returns the authoritative deadline for a Gameweek from the Gameweeks sheet.
 * The Gameweeks sheet is the source of truth for whether predictions can be
 * submitted. No frontend clock or hard-coded date is used for enforcement.
 */
function getGameweekLockState(gameweekID) {

  gameweekID = String(gameweekID || '').trim();

  if (!gameweekID) {
    return {
      locked: true,
      reason: 'Gameweek is not specified.'
    };
  }

  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return {
      locked: true,
      reason: 'Gameweek data is unavailable.'
    };
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const index = buildHeaderIndex(headers);

  if (
    index.gameweekid === undefined ||
    index.deadline === undefined
  ) {
    throw new Error(
      'Gameweeks sheet must contain GameweekID and Deadline columns.'
    );
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  let gameweek = null;

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][index.gameweekid] || '').trim() ===
      gameweekID
    ) {
      gameweek = values[i];
      break;
    }
  }

  if (!gameweek) {
    return {
      locked: true,
      reason: 'Gameweek ' + gameweekID + ' was not found.'
    };
  }

  const deadlineValue = gameweek[index.deadline];
  let deadline = null;

  if (
    Object.prototype.toString.call(deadlineValue) === '[object Date]' &&
    !isNaN(deadlineValue.getTime())
  ) {
    deadline = deadlineValue;
  } else if (deadlineValue !== '' && deadlineValue != null) {
    const parsed = new Date(deadlineValue);
    if (!isNaN(parsed.getTime())) {
      deadline = parsed;
    }
  }

  if (!deadline) {
    return {
      locked: true,
      reason: 'No valid deadline is configured for Gameweek ' + gameweekID + '.'
    };
  }

  const status =
    index.status !== undefined
      ? String(gameweek[index.status] || '').trim().toLowerCase()
      : '';

  const now = new Date();
  const deadlinePassed = now.getTime() >= deadline.getTime();
  const statusClosed = ['closed', 'locked', 'complete', 'completed', 'finished']
    .indexOf(status) !== -1;

  return {
    locked: deadlinePassed || statusClosed,
    deadline: deadline,
    status: status,
    reason: deadlinePassed
      ? 'The Gameweek deadline has passed.'
      : statusClosed
        ? 'The Gameweek is closed.'
        : ''
  };
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

function testGameweekLockState() {
  Logger.log(
    JSON.stringify(
      getGameweekLockState(getCurrentGameweek()),
      null,
      2
    )
  );
}
