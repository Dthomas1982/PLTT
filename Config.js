/**********************************************************************
 * PLTT Platform
 * Config.js
 * Version: 0.5.3
 *
 * Release:
 * - Prediction Centre integrated into client architecture
 * - Dynamic fixture pipeline
 * - Prediction persistence layer
 * - Stable Authentication Foundation
 *
 * Status:
 * Production
 **********************************************************************/

const APP = {
  NAME: "Premier League Top Tipster",
  VERSION: "0.5.3",
  SEASON: "2026/27",
  TIMEZONE: Session.getScriptTimeZone()
};

const SHEETS = {
  PLAYERS: "Players",
  TEAMS: "Teams",
  GAMEWEEKS: "Gameweeks",
  FIXTURES: "Fixtures",
  PREDICTIONSETS: "PredictionSets",
  PREDICTIONITEMS: "PredictionItems",
  PAYMENTS: "Payments",
  LEADERBOARD: "Leaderboard",
  WEBSITE: "Website",
  VALIDATION: "Validation",
  LOOKUPS: "Lookups",
  LOGS: "Logs",
  IMPORT: "Import"
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
