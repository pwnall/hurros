import 'source-map-support/register';
import { inspect } from 'util';

import PagePool from './cluster/page_pool';
import { PrioritizedPagePool, PoolPriority } from './cluster/pool_priority';
import {
  ensureOnProfilePage, extractPlayerProfile, profileUrl
} from './scraper/player_profile';
import {
  ensureOnMatchHistoryPage, extractMatchHistory, nextMatchHistory,
  selectMatchHistoryQueue, matchHistoryUrl,
} from './scraper/match_history';
import {
  ensureOnMatchSummaryPage, extractMatchStats, matchSummaryUrl,
} from './scraper/match_summary';

import { sequelize } from './db/connection';
import { app, resourceManager } from './server/app';

const main = async () => {
  // Hook up the HTTP API, for debugging purposes.
  await sequelize.sync();
  app.listen(parseInt(process.env['PORT'] || '3000'));

  // Concurrency seems to run into rate-limiting quite quickly, so we only open
  // 1 tab in all browsers we have access to.
  await resourceManager.launchBrowser(1);

  const pool : PagePool = new PrioritizedPagePool(resourceManager,
                                                  PoolPriority.Medium);

  let profileId = '161027';  // dunktrain, full profile.
  // let profileId = '274047';  // pwnall, missing two ranks.
  // let profileId = '9198884';  // Blocked profile.

  const playerProfile =
      await pool.withPage(profileUrl(profileId), async (page) => {
    await ensureOnProfilePage(page, profileId);
    return await extractPlayerProfile(page);
  });
  console.log(playerProfile);

  await pool.withPage(matchHistoryUrl(profileId), async (page) => {
    await ensureOnMatchHistoryPage(page, profileId);
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
  });
  console.log('Done listing match history');

  let replayId = '129884617';  // New game with full data.
  // let replayId = '31056044';  // Old game from 2015.
  // let replayId = '10309929';  // Game with one missing playerID.
  // let replayId = '0';  // Invalid replayID.

  const matchData =
      await pool.withPage(matchSummaryUrl(replayId), async (page) => {
    await ensureOnMatchSummaryPage(page, replayId);
    return await extractMatchStats(page);
  });
  console.log(inspect(matchData, false, null));

  // await resourceManager.shutdown();
};

main();
