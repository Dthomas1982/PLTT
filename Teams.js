/**********************************************************************
 * PLTT Platform
 * Teams.js
 * Version: 0.4.3
 *
 * Central Premier League team registry used by Predictions, Fixtures,
 * Results and future application views.
 **********************************************************************/

const TEAMS = Object.freeze([
  createTeam('ARS', 'Arsenal', '#EF0107', '#FFFFFF'),
  createTeam('AVL', 'Aston Villa', '#670E36', '#95BFE5'),
  createTeam('BOU', 'Bournemouth', '#DA291C', '#000000'),
  createTeam('BRE', 'Brentford', '#E30613', '#FBBE00'),
  createTeam('BHA', 'Brighton & Hove Albion', '#0057B8', '#FFFFFF'),
  createTeam('BUR', 'Burnley', '#6C1D45', '#87CEEB'),
  createTeam('CHE', 'Chelsea', '#034694', '#DBA111'),
  createTeam('CRY', 'Crystal Palace', '#1B458F', '#C4122E'),
  createTeam('EVE', 'Everton', '#003399', '#FFFFFF'),
  createTeam('FUL', 'Fulham', '#000000', '#FFFFFF'),
  createTeam('LEE', 'Leeds United', '#FFCD00', '#1D428A'),
  createTeam('LIV', 'Liverpool', '#C8102E', '#FFFFFF'),
  createTeam('MCI', 'Manchester City', '#6CABDD', '#FFFFFF'),
  createTeam('MUN', 'Manchester United', '#DA291C', '#FBE122'),
  createTeam('NEW', 'Newcastle United', '#241F20', '#FFFFFF'),
  createTeam('NFO', 'Nottingham Forest', '#E53233', '#FFFFFF'),
  createTeam('SUN', 'Sunderland', '#EB172B', '#000000'),
  createTeam('TOT', 'Tottenham Hotspur', '#132257', '#FFFFFF'),
  createTeam('WHU', 'West Ham United', '#7A263A', '#1BB1E7'),
  createTeam('WOL', 'Wolverhampton Wanderers', '#FDB913', '#231F20')
]);

function createTeam(code, name, primary, secondary) {
  return {
    code: code,
    name: name,
    shortName: getShortTeamName(name),
    primary: primary,
    secondary: secondary,
    crestUrl: getTeamCrestUrl(code)
  };
}

function getShortTeamName(name) {
  const shortNames = {
    'Arsenal': 'Arsenal',
    'Aston Villa': 'Aston Villa',
    'Bournemouth': 'Bournemouth',
    'Brentford': 'Brentford',
    'Brighton & Hove Albion': 'Brighton',
    'Burnley': 'Burnley',
    'Chelsea': 'Chelsea',
    'Crystal Palace': 'Palace',
    'Everton': 'Everton',
    'Fulham': 'Fulham',
    'Leeds United': 'Leeds',
    'Liverpool': 'Liverpool',
    'Manchester City': 'Man City',
    'Manchester United': 'Man Utd',
    'Newcastle United': 'Newcastle',
    'Nottingham Forest': 'Nottm Forest',
    'Sunderland': 'Sunderland',
    'Tottenham Hotspur': 'Spurs',
    'West Ham United': 'West Ham',
    'Wolverhampton Wanderers': 'Wolves'
  };

  return shortNames[name] || name;
}

function getTeamCrestUrl(code) {
  // Kept as a single registry point so the frontend can be switched to
  // locally hosted or approved crest assets later without changing data.
  return 'https://resources.premierleague.com/premierleague/badges/50/t' + code.toLowerCase() + '.png';
}

function getAllTeams() {
  return TEAMS.map(function(team) {
    return Object.assign({}, team);
  });
}

function getTeamByCode(code) {
  const key = String(code || '').trim().toUpperCase();

  const team = TEAMS.find(function(item) {
    return item.code === key;
  });

  return team ? Object.assign({}, team) : null;
}

function getTeamByName(name) {
  const key = String(name || '').trim().toLowerCase();

  const team = TEAMS.find(function(item) {
    return item.name.toLowerCase() === key ||
           item.shortName.toLowerCase() === key;
  });

  return team ? Object.assign({}, team) : null;
}

function getTeamPresentation(homeCode, awayCode) {
  return {
    home: getTeamByCode(homeCode),
    away: getTeamByCode(awayCode)
  };
}

function testTeamsRegistry() {
  Logger.log(JSON.stringify(getAllTeams(), null, 2));
  Logger.log(JSON.stringify(getTeamByCode('LIV'), null, 2));
}
