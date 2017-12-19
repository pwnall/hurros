import 'source-map-support/register';

import { readChromeWsUrls } from './cluster/open_stack_cluster';
import PagePool from './cluster/page_pool';
import { sequelize } from './db/connection';
import { readMatch, MatchSummary } from './db/match';
import { readProfileMatchMetadata } from './db/match_profile';
import fetchProfile from './jobs/fetch_profile';
import populateProfileHistory from './jobs/populate_profile_history';
import populateProfileMatches from './jobs/populate_profile_matches';
import { PlayerProfile } from './scraper/player_profile';
import { app, pagePool } from './server/app';
import { throttledAsyncMap } from './jobs/throttled_async_map';

async function readProfileMatches(profile : PlayerProfile)
    : Promise<MatchSummary[]> {
  const matchesMetadata = await readProfileMatchMetadata(profile.playerId);

  return (await Promise.all(matchesMetadata.map(async (matchMetadata) => {
    return await readMatch(matchMetadata.data.replayId);
  }))).filter((matchSummary) => matchSummary !== null);
}

async function fetchConnectedProfileIds(profile : PlayerProfile)
    : Promise<string[]> {
  const matches = await readProfileMatches(profile);

  const playerIds = new Set<string>();
  for (let match of matches) {
    for (let player of match.players) {
      if (player.playerId)  // Some match summary entries don't have player IDs.
        playerIds.add(player.playerId);
    }
  }

  return Array.from(playerIds);
}

async function populateProfileAndMatches(profileId : string, pool : PagePool)
    : Promise<PlayerProfile> {
  console.log(`Started crawling profile ${profileId}`);
  const profile = await fetchProfile(profileId, pool);
  console.log(`Populated profile ${profileId}`);

  await populateProfileHistory(profile, 'Quick Match', pool);
  console.log(`Populated profile ${profileId} history`);

  await populateProfileMatches(profile, pool);
  console.log(`Populated profile ${profileId} matches`);

  return profile;
}

const main = async () => {
  await sequelize.sync();
  app.listen(parseInt(process.env['PORT'] || '3000'));

  const inventoryDumpPath = 'os_cluster.json';
  const osPrefixes = [
    'hurrosprod',
  ];
  const workerUrls = await readChromeWsUrls(inventoryDumpPath, osPrefixes);

  // Concurrency seems to run into rate-limiting quite quickly, so we only open
  // 1 tab in all browsers we have access to.
  await pagePool.launchBrowser(1);
  await Promise.all(workerUrls.map(async (workerUrl) => {
    await pagePool.connectBrowser(workerUrl, 1);
  }));

  const profile = await populateProfileAndMatches('1141532', pagePool);

  const connectedProfileIds = await fetchConnectedProfileIds(profile);

  await throttledAsyncMap(connectedProfileIds, pagePool.pageCount(),
                    async (connectedProfileId) => {
    await populateProfileAndMatches(connectedProfileId, pagePool);
  });

  await pagePool.shutdown();
};

main();
