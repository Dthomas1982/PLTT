/**********************************************************************
 * PLTT Platform
 * Teams.js
 * Version: 0.5.5
 *
 * Release:
 * - Teams Sheet remains source of truth
 * - TeamID is the canonical badge key
 * - Club badges are served from the PLTT repository assets
 * - Bournemouth/Brentford use verified external fallbacks because the
 *   current PLTT asset endpoints are not both reliable
 * - No browser-relative badge filenames
 *
 * Status:
 * Production
 **********************************************************************/

const PLTT_BADGE_BASE_URL = 'https://raw.githubusercontent.com/Dthomas1982/PLTT/main/assets/badges/';
const PLTT_BADGE_FALLBACK_URLS = {
  BOU: 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/AFC%20Bournemouth.png',
  BRE: 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brentford%20FC.png'
};

function getTeamBadgeUrl(teamID) {
  const key = String(teamID || '').trim().toUpperCase();
  if (!key) return '';

  if (PLTT_BADGE_FALLBACK_URLS[key]) {
    return PLTT_BADGE_FALLBACK_URLS[key];
  }

  return PLTT_BADGE_BASE_URL + encodeURIComponent(key) + '.png';
}

function getAllTeams() {

  const sheet = getSheet(SHEETS.TEAMS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn <= 0) {
    return [];
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  const index = buildHeaderIndex(headers);

  return values
    .map(function(row) {
      return buildTeamFromRow(row, index);
    })
    .filter(function(team) {
      return team && team.teamID;
    });
}

function getTeamByCode(teamID) {

  const key = String(teamID || '')
    .trim()
    .toUpperCase();

  if (!key) return null;

  const teams = getAllTeams();

  for (let i = 0; i < teams.length; i++) {
    if (teams[i].teamID === key) {
      return teams[i];
    }
  }

  return null;
}

function getTeamsLookup() {

  const teams = getAllTeams();
  const lookup = {};

  teams.forEach(function(team) {
    lookup[team.teamID] = team;
  });

  return lookup;
}

function getTeamPresentation(homeTeamID, awayTeamID) {

  const lookup = getTeamsLookup();

  const homeKey = String(homeTeamID || '')
    .trim()
    .toUpperCase();

  const awayKey = String(awayTeamID || '')
    .trim()
    .toUpperCase();

  return {
    home: lookup[homeKey] || null,
    away: lookup[awayKey] || null
  };
}

function buildHeaderIndex(headers) {

  const index = {};

  headers.forEach(function(header, i) {
    index[
      String(header || '')
        .trim()
        .toLowerCase()
    ] = i;
  });

  return index;
}

function buildTeamFromRow(row, index) {

  const teamIDIndex = index.teamid;

  if (teamIDIndex === undefined) {
    throw new Error(
      'Teams sheet must contain a TeamID column.'
    );
  }

  const teamID = String(
    row[teamIDIndex] || ''
  ).trim().toUpperCase();

  return {
    teamID: teamID,

    clubName:
      index.clubname !== undefined
        ? String(row[index.clubname] || '')
        : '',

    shortName:
      index.shortname !== undefined
        ? String(row[index.shortname] || '')
        : '',

    badgeURL: getTeamBadgeUrl(teamID),

    primaryColour:
      index.primarycolour !== undefined
        ? String(row[index.primarycolour] || '')
        : '',

    secondaryColour:
      index.secondarycolour !== undefined
        ? String(row[index.secondarycolour] || '')
        : '',

    stadium:
      index.stadium !== undefined
        ? String(row[index.stadium] || '')
        : '',

    websiteSlug:
      index.websiteslug !== undefined
        ? String(row[index.websiteslug] || '')
        : ''
  };
}

function testTeamsDataLayer() {
  return getAllTeams();
}

function testTeamBadgeUrls() {
  return getAllTeams().map(function(team) {
    return {
      teamID: team.teamID,
      clubName: team.clubName,
      badgeURL: team.badgeURL
    };
  });
}
