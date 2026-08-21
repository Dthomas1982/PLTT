/**********************************************************************
 * PLTT Platform
 * Code.gs
 * Version: 2.2.0
 **********************************************************************/

function showWebsite() {
  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle(APP.NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function showLeaderboardPage_(page) {
  const file = page === 'weekly' ? 'WeeklyLeaderboard' : 'SeasonLeaderboard';
  return HtmlService
    .createTemplateFromFile(file)
    .evaluate()
    .setTitle(APP.NAME + ' — ' + (page === 'weekly' ? 'Weekly Leaderboard' : 'Season Leaderboard'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  if (!e || !e.parameter || !e.parameter.action) {
    const page = e && e.parameter ? String(e.parameter.page || '').trim().toLowerCase() : '';
    if (page === 'weekly' || page === 'season') {
      return showLeaderboardPage_(page);
    }
    return showWebsite();
  }

  try {
    switch (e.parameter.action) {
      case "ping":
        return jsonResponse(successResponse("PLTT API Online", {
          version: APP.VERSION,
          season: APP.SEASON
        }));
      case "authenticatePlayer":
        return jsonResponse(authenticatePlayer(e.parameter.playerCode));
      default:
        return jsonResponse(errorResponse("Unknown GET action."));
    }
  } catch (err) {
    return jsonResponse(errorResponse(err.message));
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    switch (request.action) {
      case "registerPlayer":
        return jsonResponse(registerPlayer(request.displayName, request.playerCode, request.mobile));
      default:
        return jsonResponse(errorResponse("Unknown POST action."));
    }
  } catch (err) {
    return jsonResponse(errorResponse(err.message));
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/**********************************************************************
 * Test Functions
 **********************************************************************/

function testUtilities() {
  Logger.log(successResponse("Utilities OK"));
  Logger.log(errorResponse("Utilities Error"));
}

function testFindRow() {
  const sheet = getSheet(SHEETS.PLAYERS);
  Logger.log("Last Row = " + sheet.getLastRow());
  Logger.log("Find Row = " + findRow(SHEETS.PLAYERS,2,"TEST01"));
}

function testRegisterPlayer() {
  Logger.log(JSON.stringify(
    registerPlayer(
      "Test User",
      "TEST01",
      "07123456789"
    ),
    null,
    2
  ));
}

function testAuthenticatePlayer() {
  Logger.log(JSON.stringify(
    authenticatePlayer("TEST01"),
    null,
    2
  ));
}

function testPing() {
  return successResponse("Ping OK");
}

function browserTest() {
  return {
    success: true,
    message: "Browser test OK",
    data: {
      displayName: "Daniel"
    }
  };
}
