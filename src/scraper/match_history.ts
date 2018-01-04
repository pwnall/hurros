import * as puppeteer from 'puppeteer';

import { elementHash, waitForElementHashChange } from './element_hash';
import { extractPlayerIdFromUrl, } from './player_profile';
import { parseHoursDuration, parseTimestamp, } from './string_parsing';
import { extractTableText } from './table_parsing';
import { throwUnlessHtmlDocument } from './rate_limit_helper';

import { catchTemporaryError } from '../cluster/errors';

// Updated every time the parser changes in a released version.
export const historyParserVersion = "3";

// The URL of a player's match history page.
export function matchHistoryUrl(playerId : string) : string {
  return `https://www.hotslogs.com/Player/MatchHistory?PlayerID=${playerId}`;
}

// Throws if the browser is not navigated to a player match history page.
export async function ensureOnMatchHistoryPage(
    page : puppeteer.Page, playerId : string) : Promise<void> {
  // Hotslogs redirects to the home page for invalid player IDs.
  // Formerly valid player IDs can become invalid if hotslogs decides to block
  // profiles. Currently, silenced players have their profiles blocked.
  const currentUrl = page.url();
  if (extractPlayerIdFromUrl(currentUrl) !== playerId)
    throw new Error(`No match history page for ${playerId}; profile blocked?`);

  await throwUnlessHtmlDocument(page);
}

// Extracts the selected queue name from the match history page's dropdown.
async function matchHistoryQueueName(page : puppeteer.Page) : Promise<string> {
  await page.waitForSelector(
      'div[id*="DropDownGameType"] li[class*="elected"]', { timeout: 10000 });

  return await page.evaluate(() => {
    const element = document.querySelector(
        'div[id*="DropDownGameType"] li[class*="elected"]');
    return element.textContent;
  });
}

// Selects a value from match history page's dropdown.
//
// Assumes the browser is navigated to a match history page.
export async function selectMatchHistoryQueue(
    page : puppeteer.Page, queueName : string) : Promise<boolean> {
  // Avoid doing the dropdown dance if the desired queue is already selected.
  const currentQueueName = await matchHistoryQueueName(page);
  if (currentQueueName.includes(queueName))
     return true;

  // Hash the current match data contents.
  const currentHash = await elementHash(page, 'table.rgMasterTable');
  if (currentHash === '')
    throw new Error("Datatable missing from match history page");

  await page.waitForSelector(
      'div[id*="DropDownGameType"][class*="DropDown"]',
      { visible: true });

  const matchTypeDropdown =
      await page.$('div[id*="DropDownGameType"][class*="DropDown"]');
  await matchTypeDropdown.click();
  await matchTypeDropdown.dispose();

  // The dropdown is animated, and there's no good way to know when it settles.
  // If we try to click the list item we want before the animation settles, the
  // click coordinates will be wrong.
  await page.waitFor(1000);

  await catchTemporaryError(async () => {
    await page.waitForSelector(
        'div[id*="DropDownGameType"] li', { timeout: 10000 });
  });

  const queueNameOptions = await page.$$('div[id*="DropDownGameType"] li');
  let clicked = false;
  for (let i = 0; i < queueNameOptions.length; ++i) {
    const option = queueNameOptions[i];
    const optionText : string =
        await page.evaluate((li : HTMLLIElement) => li.textContent, option);
    if (optionText.includes(queueName)) {
      await option.click();
      clicked = true;
      // Not breaking here so all options can be disposed.
    }
    await option.dispose();
  }

  if (!clicked)
    throw new Error(`Option ${queueName} not found.`);

  // The new hash is irrelevant, but a null value here means that a timeout has
  // been suppressed, so the selection failed.
  const newHash = await catchTemporaryError(async () => {
    return await waitForElementHashChange(
        page, 'table.rgMasterTable', currentHash);
  });
  if (newHash === null) {
    // TODO(pwnall): Content hashing can't detect the transition between two
    //               queues with no history. That would be a false error here.

    // TODO(pwnall): Figure out a proper way to detect rate-limiting here. The
    //               main page is not replaced, so the call below will not
    //               trigger.
    await throwUnlessHtmlDocument(page);
    return false;
  }

  return true;
}

// Clicks on the Next button on the match history page.
//
// Returns false if the page does not have a next button.
export async function nextMatchHistory(page : puppeteer.Page)
    : Promise<boolean> {
  // We assume that the matches have been re-rendered when the page number
  // changes.
  const currentPageNumber : string = await page.evaluate(() => {
    const pageButton = document.querySelector(
        'a[class*="paginate"][class*="current"]');
    return pageButton.textContent;
  });

  const link = await page.$(
      'a[class*="paginate"][class*="next"]:not([class*="disable"])');
  if (!link) {
    await throwUnlessHtmlDocument(page);
    return false;
  }

  await link.click();
  await link.dispose();
  await page.waitForFunction((oldNumber : string) => {
    const pageButton = document.querySelector(
        'a[class*="paginate"][class*="current"]');
    return pageButton.textContent !== oldNumber;
  }, { polling: 'raf' }, currentPageNumber);
  return true;
}

// The result of scraping an entry on a hotslogs player match history page.
export interface MatchHistoryEntry {
  playerId? : string,
  replayId? : string,
  queueName? : string,
  time? : Date,
  durationSeconds? : number,
  won? : boolean,
  map? : string,
  hero? : string,
  heroLevel? : number,
  mmr : { starting? : number, delta? : number },
};

// Extracts match data from the current match history page.
//
// Assumes the browser is navigated to a match history page.
export async function extractMatchHistory(page : puppeteer.Page) :
    Promise<MatchHistoryEntry[]> {
  const queueName = await matchHistoryQueueName(page);

  const historyData : MatchHistoryEntry[] = [];

  const table = await page.$('table.rgMasterTable');
  if (!table) {
    await throwUnlessHtmlDocument(page);
    return historyData;
  }

  const tableText = await extractTableText(table, true);
  await table.dispose();

  const playerId = extractPlayerIdFromUrl(page.url());

  for (let i = 1; i < tableText.length; ++i) {
    const entry : MatchHistoryEntry = {
      playerId: null, replayId: null, queueName: null,  time: null,
      durationSeconds: null, won: null, map: null, hero: null, heroLevel: null,
      mmr: { starting: null, delta: null },
    };
    entry.playerId = playerId;
    entry.queueName = queueName;

    for (let j = 0; j < tableText[i].length; ++j) {
      const heading = tableText[0][j].trim().toLowerCase();
      const value = tableText[i][j].trim();

      switch (heading) {
        case 'replayid':
          entry.replayId = parseInt(value).toString();
          break;
        case 'map name':
          entry.map = value;
          break;
        case 'length':
          entry.durationSeconds = parseHoursDuration(value);
          break;
        case 'hero':
          entry.hero = value;
          break;
        case 'lvl':
          entry.heroLevel = parseInt(value);
          break;
        case 'result':
          entry.won = parseInt(value) != 0;
          break;
        case 'mmr':
          entry.mmr.starting = parseFloat(value);
          break;
        case 'mmr Δ':
        case 'mmr δ':
          entry.mmr.delta = parseFloat(value);
          break;
        case 'date and time (utc)':
          // 5/14/2015 3:22:05 AM
          entry.time = parseTimestamp(value);
          break;
        case 'share replay': break;  // Nothing useful here.
        case '': break;  // A few fields have no heading.
        default:
          console.log(
              `Unknown field in Match History main table: ${tableText[0][j]}`);
      }
    }

    if (entry.replayId === '0' || !entry.replayId) {
      // Skip over artificial entries that break up seasons. Entries currently
      // look like this:
      // {  replayId: '0',
      //    time: 2017-12-13T00:00:00.000Z,
      //    durationSeconds: null,
      //    won: false,
      //    map: '2018 Season 1',
      //    hero: 'Hero',
      //    heroLevel: NaN,
      //    mmr: { starting: NaN, delta: NaN } }
      // }
      continue;
    }
    historyData.push(entry);
  }

  return historyData;
}
