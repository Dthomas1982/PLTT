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
 * Return the current GameweekID from the Gameweeks sheet when the Website
 * settings sheet does not explicitly provide one. GameweekID is preserved
 * exactly as stored (for example GW01, not GW1).
 */
function resolveAuthoritativeGameweekID() {

  const configured = String(
    getWebsiteSettings().currentGameweek || ""
  ).trim();

  if (configured) {
    return configured;
  }

  const sheet = getSheet(SHEETS.GAMEWEEKS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return "";
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const index = buildHeaderIndex(headers);

  if (index.gameweekid === undefined) {
    return "";
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  const now = new Date();
  let bestGameweek = null;
  let bestStart = null;

  values.forEach(function(row) {

    const rawStart =
      index.startdate !== undefined
        ? row[index.startdate]
        : "";

    let start = null;

    if (
      Object.prototype.toString.call(rawStart) === '[object Date]' &&
      !isNaN(rawStart.getTime())
    ) {
      start = rawStart;
    } else if (rawStart !== '' && rawStart != null) {
      const parsed = new Date(rawStart);
      if (!isNaN(parsed.getTime())) {
        start = parsed;
      }
    }

    if (!start || start.getTime() > now.getTime()) {
      return;
    }

    if (!bestStart || start.getTime() > bestStart.getTime()) {
      bestStart = start;
      bestGameweek = String(row[index.gameweekid] || '').trim();
    }
  });

  return bestGameweek || "";
}

/**
 * Combine the Gameweeks sheet StartDate and Deadline values into one
 * authoritative local Date. Deadline is commonly stored as a time-only cell,
 * e.g. 8:00:00 PM, so its clock values are combined with StartDate.
 */
function resolveGameweekDeadline(startDateValue, deadlineValue) {

  let startDate = null;

  if (
    Object.prototype.toString.call(startDateValue) === '[object Date]' &&
    !isNaN(startDateValue.getTime())
  ) {
    startDate = new Date(startDateValue.getTime());
  } else if (startDateValue !== '' && startDateValue != null) {
    const parsedStart = new Date(startDateValue);
    if (!isNaN(parsedStart.getTime())) {
      startDate = parsedStart;
    }
  }

  if (!startDate) {
    return null;
  }

  let deadline = null;

  if (
    Object.prototype.toString.call(deadlineValue) === '[object Date]' &&
    !isNaN(deadlineValue.getTime())
  ) {
    deadline = new Date(deadlineValue.getTime());
  } else if (deadlineValue !== '' && deadlineValue != null) {
    const parsedDeadline = new Date(deadlineValue);
    if (!isNaN(parsedDeadline.getTime())) {
      deadline = parsedDeadline;
    }
  }

  if (!deadline) {
    return null;
  }

  // If the deadline cell is time-only, use its clock values with StartDate.
  // Google Sheets commonly returns time-only cells as a Date anchored to a
  // base date, so comparing its date portion is not reliable.
  const result = new Date(startDate.getTime());
  result.setHours(
    deadline.getHours(),
    deadline.getMinutes(),
    deadline.getSeconds(),
    0
  );

  return result;
}

/**
 * Returns the authoritative deadline/lock state for a Gameweek from the
 * Gameweeks sheet. The Gameweek ID and deadline are taken from the sheet
 * exactly as stored. No frontend clock or hard-coded date is used for
 * enforcement.
 */
function getGameweekLockState(gameweekID) {

  gameweekID = String(gameweekID || '').trim();

  if (!gameweekID) {
    gameweekID = resolveAuthoritativeGameweekID();
  }

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

  const startDateValue =
    index.startdate !== undefined
      ? gameweek[index.startdate]
      : '';

  const deadlineValue = gameweek[index.deadline];
  const deadline = resolveGameweekDeadline(
    startDateValue,
    deadlineValue
  );

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
  const statusClosed = [
    'closed',
    'locked',
    'complete',
    'completed',
    'finished'
  ].indexOf(status) !== -1;

  const statusNotOpen = [
    'not open',
    'not_open',
    'pending'
  ].indexOf(status) !== -1;

  return {
    locked: deadlinePassed || statusClosed || statusNotOpen,
    gameweekID: gameweekID,
    deadline: deadline,
    status: status,
    reason: deadlinePassed
      ? 'The Gameweek deadline has passed.'
      : statusClosed
        ? 'The Gameweek is closed.'
        : statusNotOpen
          ? 'The Gameweek is not open.'
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
      getGameweekLockState(''),
      null,
      2
    )
  );
}
