import 'source-map-support/register';
import { inspect } from 'util';

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
import PagePool from './cluster/page_pool';

const main = async () => {
  const pool = new PagePool();
  // Concurrency seems to run into rate-limiting quite quickly, so we only open
  // 1 tab in all browsers we have access to.
  await pool.launchBrowser(1);

  await pool.withPage(async (page) => {
    await goToProfileById(page, '161027'); // dunktrain, full profile
    // await goToProfileById(page, '274047'); // pwnall, missing two ranks
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

    await goToMatchSummary(page, '129884617');  // New game with full data.
    // await goToMatchSummary(page, '31056044');  // Old game from 2015.
    // await goToMatchSummary(page, '10309929');  // Game with one missing playerID.

    const matchData = await extractMatchStats(page);
    console.log(inspect(matchData, false, null));
  });

  await pool.shutdown();
};

main();
