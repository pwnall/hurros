import * as puppeteer from 'puppeteer';

import { extractProfileLinkData, PlayerIdentity } from './player_profile';
import {
  parseFormattedNumber, parseHoursDuration, parsePercentage,
} from './string_parsing';
import { extractTableText } from './table_parsing';
import { throwUnlessHtmlDocument } from './rate_limit_helper';

import { catchTemporaryError } from '../cluster/errors';

// Updated every time the parser changes in a released version.
export const matchParserVersion = "2";

// The URL of a match's summary page.
export function matchSummaryUrl(replayId : string) : string {
  return 'https://www.hotslogs.com/Player/MatchSummaryContainer?' +
      `ReplayID=${replayId}`;
}

// Throws if the browser is not navigated to a match summary page.
export async function ensureOnMatchSummaryPage(
    page : puppeteer.Page, replayId : string) : Promise<void> {

  // Hotslogs redirects to the home page for invalid match IDs.
  const currentUrl = page.url();
  if (!currentUrl.includes(replayId))
    throw new Error(`No match summary page for ${replayId}; invalid ID?`);

  await throwUnlessHtmlDocument(page);
}

// Adds player IDs from playerIdentities to matchData.
function mergePlayerIds(
    matchData : Array<{ playerName? : string, playerId? : string }>,
    playerIdentities : PlayerIdentity[]) {

  const dataByName =
      new Map<string, Array<{ playerName? : string, playerId? : string }>>();

  for (let playerData of matchData) {
    if (dataByName.has(playerData.playerName)) {
      dataByName.get(playerData.playerName).push(playerData);
    } else {
      dataByName.set(playerData.playerName, [playerData]);
    }
  }

  for (let identity of playerIdentities) {
    const playersData = dataByName.get(identity.name);
    if (!playersData)
      continue;

    const playerData = playersData.shift();
    if (!playerData)
      continue;
    playerData.playerId = identity.id;
  }
}

// The result of scraping a hotslogs match summary page.
export interface PlayerMatchSummary {
  // Information common to the two summary tables.
  playerName? : string,
  playerId?: string,
  hero? : string,
  winningTeam : boolean,

  // Information from the first summary table.
  hlScore : {
    overall? : number,
    kills? : number,
    teamwork? : number,
    deaths? : number,
    role? : number,
    siege? : number,
    xp? : number,
  },
  takedowns? : number,
  kills? : number,
  assists? : number,
  deaths? : number,
  secondsDead? : number,
  heroDamage? : number,
  siegeDamage? : number,
  healing? : number,
  selfHealing? : number,
  damageTaken? : number,
  xp? : number,

  // Information from the second summary table.
  award? : string, heroLevel?: number,
  mmr : { starting? : number, delta? : number },
  talentNames : string[],
  talentDescriptions : {
    [level : string]: { name : string, description : string}
  },
}

// Extracts match stats from one of the two tables on the match summary page.
//
// Assumes the browser is navigated to a match summary page.
//
// The data should be merged with the data returned by extractMatchStats2()
// using mergeMatchStats().
export async function extractMatchStats1(page : puppeteer.Page)
    : Promise<PlayerMatchSummary[]> {

  const matchData : PlayerMatchSummary[] = [];

  // This function is generally called after extractMatchStats2, so we can rely
  // on the waitForSelector there.
  const table =
      await page.$('[class*="CharacterScoreResults"] table.rgMasterTable');
  if (!table)
    return matchData;

  // If the table exists, spend some time waiting for its content to load. The
  // timeout should be much more aggressive (like 500ms), but that would cause
  // trouble with remote scrapers.
  await catchTemporaryError(async () => {
    await page.waitForSelector(
        '[class*="CharacterScoreResults"] table.rgMasterTable td',
        { visible: true, timeout: 10000 });
  });

  const tableText = await extractTableText(table, true);
  const playerLinkData = await extractProfileLinkData(table);
  await table.dispose();

  for (let i = 1; i < tableText.length; ++i) {
    if (tableText[i].length === 2) {
      const heading = tableText[i][0].split('(', 2)[0].trim().toLowerCase();
      const value = tableText[i][1].trim();

      const playerStats = matchData[matchData.length - 1];
      if (playerStats === null)
        continue;

      switch (heading) {
        case 'kills':
          playerStats.hlScore.kills = parsePercentage(value);
          break;
        case 'teamwork':
          playerStats.hlScore.teamwork = parsePercentage(value);
          break;
        case 'deaths':
          playerStats.hlScore.deaths = parsePercentage(value);
          break;
        case 'role':
          playerStats.hlScore.role = parsePercentage(value);
          break;
        case 'siege':
          playerStats.hlScore.siege = parsePercentage(value);
          break;
        case 'xp':
          playerStats.hlScore.xp = parsePercentage(value);
          break;
        default:
          console.log(
              `Unknown field in Match History score box: ${tableText[i][0]}`);
      }

      continue;
    }

    const playerStats : PlayerMatchSummary = {
      playerName: null, playerId: null, hero: null, winningTeam: null,
      hlScore: {
        overall: null, kills: null, teamwork: null, deaths: null,
        role: null, siege: null, xp: null,
      },
      takedowns: null, kills: null, assists: null, deaths: null,
      secondsDead: null,
      heroDamage: null, siegeDamage: null, healing: null, selfHealing: null,
      damageTaken: null, xp: null,
      award: null, heroLevel: null, mmr: { starting: null, delta: null },
      talentNames: [], talentDescriptions: {},
    };

    for (let j = 0; j < tableText[i].length; ++j) {
      const heading = tableText[0][j].trim().toLowerCase();
      const value = tableText[i][j].trim();

      switch (heading) {
        case 'player':
          const playerName = value;
          playerStats.playerName = playerName;
          break;
        case 'hero':
          playerStats.hero = value;
          break;
        case 'team':
          playerStats.winningTeam = value.toLowerCase() == 'true';
          break;
        case 'score':
          // This field contains the entire score sub-table.
          playerStats.hlScore.overall = parsePercentage(value);
          break;
        case 'td':
          playerStats.takedowns = parseInt(value);
          break;
        case 'kill':
          playerStats.kills = parseInt(value);
          break;
        case 'assist':
          playerStats.assists = parseInt(value);
          break;
        case 'death':
          playerStats.deaths = parseInt(value);
          break;
        case 'time dead':
          playerStats.secondsDead = parseHoursDuration(value);
          break;
        case 'hero dmg':
          playerStats.heroDamage = parseFormattedNumber(value);
          break;
        case 'siege dmg':
          playerStats.siegeDamage = parseFormattedNumber(value);
          break;
        case 'healing':
          playerStats.healing = parseFormattedNumber(value);
          break;
        case 'self heal':
          playerStats.selfHealing = parseFormattedNumber(value);
          break;
        case 'dmg taken':
          playerStats.damageTaken = parseFormattedNumber(value);
          break;
        case 'xp':
          playerStats.xp = parseFormattedNumber(value);
          break;
        case '': break;  // A few fields have no heading.
        default:
          console.log(
              `Unknown field in Match History main table: ${tableText[0][j]}`);
      }
    }

    if (playerStats.playerName)
      matchData.push(playerStats);
  }

  mergePlayerIds(matchData, playerLinkData);

  return matchData;
}

interface PlayerMatchSummaryExtra {
  playerName? : string,
  playerId?: string,
  hero? : string,
  winningTeam : boolean,

  award? : string, heroLevel? : number,
  mmr : { starting? : number, delta? : number },
  talentNames : string[],
  talentDescriptions : {
    [level : string]: { name : string, description : string}
  },
};

// Extracts match stats from one of the two tables on the match summary page.
//
// Assumes the browser is navigated to a match summary page.
//
// The data should be merged with the data returned by extractMatchStats1()
// using mergeMatchStats().
export async function extractMatchStats2(page : puppeteer.Page) {
  await catchTemporaryError(async () => {
    await page.waitForSelector(
        '[id*="MatchDetails"] table.rgMasterTable td',
        { visible: true, timeout: 10000 });
  });

  const matchData : PlayerMatchSummaryExtra[] = [];

  const table =
      await page.$('[id*="MatchDetails"] table.rgMasterTable');
  if (!table)
    return matchData;

  const tableText = await extractTableText(table, true);
  const playerLinkData = await extractProfileLinkData(table);
  await table.dispose();

  const parseTalent = (value : string)
      : { name : string, description : string} => {
    const match = /^([^:]+):(.*)$/.exec(value);
    if (!match)
      return null;
    return  { name: match[1], description: match[2] };
  };

  for (let i = 1; i < tableText.length; ++i) {
    const playerStats : PlayerMatchSummaryExtra = {
      playerName: null, playerId: null, hero: null, winningTeam: null,
      award: null, heroLevel: null, mmr: { starting: null, delta: null },
      talentNames: [], talentDescriptions: {},
    };

    for (let j = 0; j < tableText[i].length; ++j) {
      const heading = tableText[0][j].trim().toLowerCase();
      const value = tableText[i][j].trim();

      switch (heading) {
        case 'player':
          const playerName = value;
          playerStats.playerName = playerName;
          break;
        case 'hero':
          playerStats.hero = value;
          break;
        case 'lvl':
          playerStats.heroLevel = parseInt(value);
          break;
        case '1': case '4': case '7': case '10':
        case '13': case '16': case '20':
          playerStats.talentDescriptions[heading] = parseTalent(value);
          break;
        case 'talentname':
          playerStats.talentNames.push(value);
          break;
        case 'team':
          playerStats.winningTeam = value.toLowerCase() == 'true';
          break;
        case 'mmr':
          playerStats.mmr.starting = parseFloat(value);
          break;
        case 'mmr Δ':
        case 'mmr δ':
          playerStats.mmr.delta = parseFloat(value);
          break;
        case 'match history': break;  // Nothing useful here.
        case '':  // A few fields have no heading. We want the award values.
          const match = /award:\s*(\S+)/.exec(value);
          if (match)
            playerStats.award = match[1];
          break;
        default:
          console.log(
              `Unknown field in Match History main table: ${tableText[0][j]}`);
      }
    }

    if (playerStats.playerName)
      matchData.push(playerStats);
  }

  mergePlayerIds(matchData, playerLinkData);

  return matchData;
}

// Merges match stats from the two tables on the match summary page.
//
// The data is merged into the PlayerMatchSummary[] array, which is mutated.
export function mergeMatchStats(
    data : PlayerMatchSummary[], extra : PlayerMatchSummaryExtra[]) {
  // Some match entries miss player IDs, and there's a tiny possibility of
  // having two players with the same profile name in a match.
  //
  // To avoid dealing with all this madness, we use the (hero name, team) to
  // match up player data across the two tables. This works for "normal" games,
  // but wouldn't work with things like brawls where all players land on the
  // same hero.
  //
  // TODO(pwnall): If we ever want to do brawls, consider adding profile names
  //               either as an alternative mechanism, or as a supplemental hash
  //               key component. So, we'd be hashing on (hero, team, name).
  const hashKey =
      (data : (PlayerMatchSummary | PlayerMatchSummaryExtra)) : string => {
    return `${data.hero}-${data.winningTeam}`;
  };
  const indexedData : { [key : string] : PlayerMatchSummary } = {};
  for (let item of data)
    indexedData[hashKey(item)] = item;

  for (let extraItem of extra) {
    let item = indexedData[hashKey(extraItem)];
    if (!item) {
      item = {
        playerName: null, playerId: null,
        hero: extraItem.hero, winningTeam: extraItem.winningTeam,
        hlScore: {
          overall: null, kills: null, teamwork: null, deaths: null,
          role: null, siege: null, xp: null,
        },
        takedowns: null, kills: null, assists: null, deaths: null,
        secondsDead: null,
        heroDamage: null, siegeDamage: null, healing: null, selfHealing: null,
        damageTaken: null, xp: null,
        award: null, heroLevel: null, mmr: { starting: null, delta: null },
        talentNames: [], talentDescriptions: {},
      };
      data.push(item);
      indexedData[hashKey(item)] = item;
    }

    if (!item.playerName)
      item.playerName = extraItem.playerName;
    if (!item.playerId)
      item.playerId = extraItem.playerId;
    if (!item.award)
      item.award = extraItem.award;
    item.heroLevel = item.heroLevel || extraItem.heroLevel;

    item.mmr.starting = item.mmr.starting || extraItem.mmr.starting;
    item.mmr.delta = item.mmr.delta || extraItem.mmr.delta;
    if (item.talentNames.length === 0)
      item.talentNames = extraItem.talentNames;
    if (Object.getOwnPropertyNames(item.talentDescriptions).length === 0)
      item.talentDescriptions = extraItem.talentDescriptions;
  }
}

export async function extractMatchStats(page : puppeteer.Page) :
    Promise<PlayerMatchSummary[]> {

  const extraData = await extractMatchStats2(page);
  const matchData = await extractMatchStats1(page);
  mergeMatchStats(matchData, extraData);

  return matchData;
}
