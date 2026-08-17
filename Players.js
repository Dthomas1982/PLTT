/**********************************************************************
 * PLTT Platform
 * Players.js
 * Version: 0.5.3
 *
 * Release:
 * - Stable Authentication Foundation
 * - Plain serializable player data
 * - Prediction Centre compatibility
 *
 * Status:
 * Production
 **********************************************************************/

function registerPlayer(displayName, playerCode, mobile) {

  try {

    displayName = displayName.toString().trim();
    playerCode = cleanPlayerCode(playerCode);
    mobile = cleanMobile(mobile);

    if (displayName.length < 2)
      return errorResponse("Display Name is too short.");

    if (!isValidPlayerCode(playerCode))
      return errorResponse("Invalid Player Code.");

    if (!isValidMobile(mobile))
      return errorResponse("Invalid Mobile Number.");

    if (playerCodeExists(playerCode))
      return errorResponse("Player Code already exists.");

    if (mobileExists(mobile))
      return errorResponse("Mobile Number already registered.");

    const sheet = getSheet(SHEETS.PLAYERS);

    const playerID = generateNextId(
      SHEETS.PLAYERS,
      PLAYER.ID_PREFIX
    );

    sheet.appendRow([
      playerID,
      playerCode,
      displayName,
      mobile,
      getCurrentTimestamp(),
      true,
      "",
      0,
      0,
      0
    ]);

    logAction(
      FEATURES.PLAYER,
      "REGISTER",
      playerID,
      playerCode
    );

    return successResponse(
      "Player Registered",
      {
        playerID: playerID,
        playerCode: playerCode,
        displayName: displayName
      }
    );

  } catch (err) {

    logAction(
      FEATURES.PLAYER,
      "ERROR",
      "",
      err.message
    );

    return errorResponse(err.message);
  }
}

function authenticatePlayer(playerCode) {

  playerCode = cleanPlayerCode(playerCode);

  const player = getPlayerByCode(playerCode);

  if (!player)
    return errorResponse("Player not found.");

  return successResponse(
    "Player authenticated.",
    player
  );
}

function playerCodeExists(playerCode) {
  return valueExists(
    SHEETS.PLAYERS,
    2,
    cleanPlayerCode(playerCode)
  );
}

function mobileExists(mobile) {
  return valueExists(
    SHEETS.PLAYERS,
    4,
    cleanMobile(mobile)
  );
}

function getPlayerByCode(playerCode) {

  const row = findRow(
    SHEETS.PLAYERS,
    2,
    cleanPlayerCode(playerCode)
  );

  if (row === -1) return null;

  const v = getSheet(
    SHEETS.PLAYERS
  ).getRange(
    row,
    1,
    1,
    10
  ).getValues()[0];

  let registered = "";

  if (
    v[4] !== "" &&
    v[4] !== null &&
    v[4] !== undefined
  ) {

    registered = Utilities.formatDate(
      new Date(v[4]),
      APP.TIMEZONE,
      "yyyy-MM-dd HH:mm:ss"
    );
  }

  return {
    playerID: String(v[0] || ""),
    playerCode: String(v[1] || ""),
    displayName: String(v[2] || ""),
    mobile: String(v[3] || ""),
    registered: registered,
    active: Boolean(v[5]),
    notes: String(v[6] || ""),
    seasonPoints: Number(v[7] || 0),
    seasonRank: Number(v[8] || 0),
    gameweeksPlayed: Number(v[9] || 0)
  };
}
