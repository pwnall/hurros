import * as puppeteer from 'puppeteer';

import { extractPlayerIdFromUrl, } from './player_profile';
import { parseHoursDuration, parseTimestamp, } from './string_parsing';
import { extractTableText } from './table_parsing';
import { catchNavigationTimeout } from './timeout_helper';

// Updated every time the parser changes in a released version.
export const historyParserVersion = "1";

// Navigates to a player's match history page.
export async function goToMatchHistory(page : puppeteer.Page,
                                       playerId : string) : Promise<void> {
  const pageUrl =
      `https://www.hotslogs.com/Player/MatchHistory?PlayerID=${playerId}`;
  await page.goto(pageUrl);
}

// Selects a value from match history page's dropdown.
//
// Assumes the browser is navigated to a match history page.
export async function selectMatchHistoryQueue(
    page : puppeteer.Page, queueName : string) : Promise<void> {

  await page.waitForSelector(
      'div[id*="DropDownGameType"][class*="DropDown"]',
      { visible: true });

  const matchTypeDropdown =
      await page.$('div[id*="DropDownGameType"][class*="DropDown"]');
  await matchTypeDropdown.click();
  await matchTypeDropdown.dispose();

  await catchNavigationTimeout(async () => {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  });

  const queueNameOptions = await page.$$('div[id*="DropDownGameType"] li');
  let clicked = false;
  for (let i = 0; i < queueNameOptions.length; ++i) {
    const option = queueNameOptions[i];
    const optionText : string =
        await page.evaluate((li : HTMLLIElement) => li.textContent, option);
    if (optionText.indexOf(queueName) !== -1) {
      await option.click();
      clicked = true;
    }
    await option.dispose();
  }

  if (!clicked)
    throw new Error(`Option ${queueName} not found.`);

  await catchNavigationTimeout(async () => {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  });
}

// Clicks on the Next button on the match history page.
//
// Returns false if the page does not have a next button.
export async function nextMatchHistory(page : puppeteer.Page)
    : Promise<boolean> {
  const link = await page.$('a.paginate_button.next');
  if (!link)
    return null;

  await link.click();
  await catchNavigationTimeout(async () => {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
  });
  return true;
}

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
  const queueNameOption =
      await page.$('div[id*="DropDownGameType"] li[class*="elected"]');
  const queueName : string = await page.evaluate((chromeLi : HTMLLIElement) => {
    return chromeLi.textContent;
  }, queueNameOption);
  await queueNameOption.dispose();

  const table = await page.$('table.rgMasterTable');
  const tableText = await extractTableText(table, true);
  await table.dispose();

  const historyData : MatchHistoryEntry[] = [];

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
    historyData.push(entry);
  }

  return historyData;
}
