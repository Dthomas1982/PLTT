/**********************************************************************
 * PLTT Platform
 * Config.js
 * Version: 0.4.2.5
 *
 * F001 - Player Registration
 * F002 - Player Recognition
 *
 * Central application configuration.
 **********************************************************************/

const APP = {
  NAME: "Premier League Top Tipster",
  VERSION: "0.4.2.5",
  SEASON: "2026/27",
  TIMEZONE: Session.getScriptTimeZone()
};

const SHEETS = {
  PLAYERS: "Players",
  FIXTURES: "Fixtures",
  PREDICTIONS: "PredictionItems",
  PREDICTIONSETS: "PredictionSets",
  PAYMENTS: "Payments",
  LEADERBOARD: "Leaderboard",
  LOGS: "Logs",
  SETTINGS: "Settings"
};

const PLAYER = {
  ID_PREFIX: "P"
};

const FEATURES = {
  PLAYER: "PLAYER",
  FIXTURE: "FIXTURE",
  PREDICTION: "PREDICTION",
  PAYMENT: "PAYMENT",
  LEADERBOARD: "LEADERBOARD"
};

const GAME = {
  ENTRY_FEE: 10.00,
  WEEKLY_POT_PERCENT: 70,
  SEASON_POT_PERCENT: 30,
  ADMIN_FEE_PERCENT: 5
};

const POINTS = {
  CORRECT_RESULT: 2,
  CORRECT_MARGIN: 1,
  EXACT_SCORE: 3
};
