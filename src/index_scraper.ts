import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import 'source-map-support/register';
import { inspect, promisify } from 'util';

import {
  extractPlayerProfile,
  goToProfileById
} from './scraper/player_profile';
import {
  extractMatchHistory, goToMatchHistory, nextMatchHistory,
  selectMatchHistoryQueue,
} from './scraper/match_history';
import {
  extractMatchStats, goToMatchSummary,
} from './scraper/match_summary';

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--disable-notifications'],
  });
  const page = await browser.newPage();
  // Viewport setting is optional, but it makes debugging a tad better.
  await page.setViewport({width: 1024, height: 768});

  /*
  await goToProfileById(page, '274047');
  const playerProfile = await extractPlayerProfile(page);
  console.log(playerProfile);

  await goToMatchHistory(page, '274047');
  console.log('Gone to match history');
  await selectMatchHistoryQueue(page, 'Quick Match');
  console.log('Selected Quick Match');
  while (true) {
    const matchData = await extractMatchHistory(page);
    console.log(matchData);
    const foundNext = await nextMatchHistory(page);
    if (!foundNext) {
      console.log('No next button; done');
      break;
    }
    console.log('Clicked next button');
  }
  */

  // await goToMatchSummary(page, '129884617');  // New game with full data.
  await goToMatchSummary(page, '31056044');  // Old game from 2015.
  const text = await extractMatchStats(page);
  console.log(inspect(text, false, null));

  await browser.close();
};

main();
