import * as puppeteer from 'puppeteer';

import {
  parseDaysDuration, parseMmr, parsePercentage,
} from './string_parsing';
import { extractTableText } from './table_parsing';
import { throwUnlessHtmlDocument } from './rate_limit_helper';
import { retryWhileNavigationTimeout } from './timeout_helper';

// Updated every time the parser changes in a released version.
export const profileParserVersion = "2";

// Navigates to a player's profile page.
export async function goToProfileById(page : puppeteer.Page,
                                      playerId : string) : Promise<void> {
  const pageUrl =
    `https://www.hotslogs.com/Player/Profile?PlayerID=${playerId}`;

  await retryWhileNavigationTimeout(async () => await page.goto(pageUrl));

  // Hotslogs redirects to the home page for invalid player IDs.
  // Formerly valid player IDs can become invalid if hotslogs decides to block
  // profiles. Currently, silenced players have their profiles blocked.
  const currentUrl = page.url();
  if (currentUrl.indexOf(playerId) === -1)
    throw new Error(`No profile page for ${playerId}; profile blocked?`);
}

// (unfinished) locates a player based on name.
//
// This either redirects to a player profile, if the name is unique, or goes to a
// search results page, if the name is ambiguous.
//
// TODO: distinguish between the two, parse the search results.
export async function goToProfileByName(page : puppeteer.Page,
                                        playerName : string) : Promise<void> {
  await page.goto(`https://hotslogs.com/PlayerSearch?Name=${playerName}`);
}

export interface PlayerProfile {
  playerRegion? : string, playerName? : string, playerId? : string,
  mmr: {
    heroLeague? : number,
    quickMatch? : number,
    teamLeague? : number,
    unrankedDraft? : number,
  },
  winRate? : number, mvpRate? : number, heroLevel? : number,
  gamesPlayed? : number, timePlayed? : number,
};

export function extractPlayerIdFromUrl(url : string) : string | null {
  const match = /PlayerID=(\d+)/.exec(url);
  if (!match)
    return null;
  return match[1];
}

export interface PlayerIdentity {
  id : string,
  name : string,
};

// Extracts player profile links from an element's content.
//
// The caller owns the element, so it is responsible for keeping the element alive
// while the function runs, and for disposing of the element later on.
//
// The returned objects contain the link's text content (text), which is usually
// the player's name, and the absolute URL of the player profile (url).
export async function extractProfileLinkData(
    pageElement : puppeteer.ElementHandle) :
    Promise<PlayerIdentity[]> {
  const rawLinkData = await pageElement.executionContext().evaluate(
      (element : HTMLElement) => {
    const linkData = [];
    const links = element.querySelectorAll(
        'a[href*="Player/Profile?PlayerID="]') as NodeListOf<HTMLLinkElement>;
    for (let link of links) {
      if (!/PlayerID=(\d+)/.test(link.href))
        continue;
      linkData.push({ url: link.href, text: link.textContent });
    }
    return linkData;
  }, pageElement) as Array<{ text : string, url : string }>;

  return rawLinkData.map((linkData) => {
    const playerId = extractPlayerIdFromUrl(linkData.url);
    if (playerId) {
      return { id: playerId, name: linkData.text.trim() };
    } else {
      return null;
    }
  }).filter((linkData) => linkData !== null);
}

// Assumes the browser is navigated to a player profile page.
export async function extractPlayerProfile(page : puppeteer.Page)
    : Promise<PlayerProfile> {
  const data : PlayerProfile = {
    playerRegion: null, playerName: null, playerId: null,
    mmr: {
      heroLeague: null,
      quickMatch: null,
      teamLeague: null,
      unrankedDraft: null,
    },
    winRate: null, mvpRate: null,
    heroLevel: null,
    gamesPlayed: null,
    timePlayed: null,
  };

  data.playerId = extractPlayerIdFromUrl(page.url());

  {
    const heading = await page.$('h1');
    const headingText = await page.evaluate((h1) => h1.textContent, heading);
    heading.dispose();
    const match = /(.*)\s+Profile:(.*)/.exec(headingText);
    if (match) {
      data.playerRegion = match[1];
      data.playerName = match[2];
    }
  }

  const table = await page.$('table.rgMasterTable');
  if (!table) {
    await throwUnlessHtmlDocument(page);
    return data;
  }

  const tableText = await extractTableText(table, false);
  await table.dispose();

  for (let row of tableText) {
    const heading = row[0].trim().toLowerCase();
    const value = row[1].trim();
    switch (heading) {
      case 'team league':
        data.mmr.teamLeague = parseMmr(value);
        break;
      case 'hero league':
        data.mmr.heroLeague = parseMmr(value);
        break;
      case 'unranked draft':
        data.mmr.unrankedDraft = parseMmr(value);
        break;
      case 'quick match':
        data.mmr.quickMatch = parseMmr(value);
        break;
      case 'overall mvp percent':
        data.mvpRate = parsePercentage(value);
        break;
      case 'overall win percent':
        data.winRate = parsePercentage(value);
        break;
      case 'combined hero level':
        data.heroLevel = parseInt(value);
        break;
      case 'total games played':
        data.gamesPlayed = parseInt(value);
        break;
      case 'total time played':
        data.timePlayed = parseDaysDuration(value);
        break;
      default:
        console.log(`Unknown field in General Information: ${row[0]}`);
    }
  }
  return data;
}
