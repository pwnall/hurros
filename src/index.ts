import 'source-map-support/register';

import { readChromeWsUrls } from './cluster/open_stack_cluster';
import PagePool from './cluster/page_pool';
import { PrioritizedPagePool, PoolPriority } from './cluster/pool_priority';
import ResourceManager from './cluster/resource_manager';
import { throttledAsyncMap } from './cluster/throttled_async_map';
import { sequelize } from './db/connection';
import fetchProfile from './jobs/fetch_profile';
import populateProfileHistory from './jobs/populate_profile_history';
import populateProfileMatches from './jobs/populate_profile_matches';
import readProfileMatches from './jobs/read_profile_matches';
import { PlayerProfile } from './scraper/player_profile';
import { app, resourceManager } from './server/app';
import populateProfileMatchesHistories
    from './jobs/populate_profile_matches_histories';

async function fetchConnectedProfileIds(
    profile : PlayerProfile, queueName : string | null)
    : Promise<string[]> {
  const matches = await readProfileMatches(profile, queueName);

  const playerIds = new Set<string>();
  for (let match of matches) {
    for (let player of match.players) {
      if (player.playerId)  // Some match summary entries don't have player IDs.
        playerIds.add(player.playerId);
    }
  }

  return Array.from(playerIds);
}

async function populateProfileAndMatches(
    profileId : string, queueName : string, pool : PagePool)
    : Promise<PlayerProfile | null> {
  console.log(`Started crawling profile ${profileId}`);
  let profile;
  try {
    profile = await fetchProfile(profileId, pool);
  } catch(e) {
    console.error(`Failed populating profile ${profileId}: ${e}`);
    return null;
  }
  console.log(`Populated profile ${profileId}`);

  await populateProfileHistory(profile, queueName, pool);
  console.log(`Populated profile ${profileId} history`);

  await populateProfileMatches(profile, queueName, pool);
  console.log(`Populated profile ${profileId} matches`);

  await populateProfileMatchesHistories(profile, queueName, pool);
  console.log(`Populated profile ${profileId} match histories`);

  return profile;
}

// Connect the resource manager to all available Chrome instances.
//
// This should eventually be driven by a database configuration that can be
// changed via the HTTP API.
async function setupResourceManager(resourceManager : ResourceManager) {
  const inventoryDumpPath = 'os_cluster.json';
  const osPrefixes = [
    'hurrosprod',
  ];
  const workerUrls = await readChromeWsUrls(inventoryDumpPath, osPrefixes);
  const maxParallelConnects = 4;

  // Concurrency seems to run into rate-limiting quite quickly, so we only open
  // 1 tab in all browsers we have access to.
  await throttledAsyncMap(workerUrls, maxParallelConnects, async (workerUrl) => {
    console.log(`Connecting to worker WS: ${workerUrl}`);
    await resourceManager.connectBrowser(workerUrl, 1);
    console.log(`Connected  to worker WS: ${workerUrl}`);
  });

  await resourceManager.launchBrowser(1);
}

// Run the main job.
//
// This should eventually be driven by the HTTP API, which should be used to
// queue / query jobs into / from the database.
async function mainJob(pool : PagePool) {
  const mainProfileId = '1141532';
  const queueName = 'Quick Match';

  const profile = await populateProfileAndMatches(mainProfileId, queueName,
                                                  pool);

  const connectedProfileIds = await fetchConnectedProfileIds(profile,
                                                             queueName);

  await throttledAsyncMap(connectedProfileIds, pool.pageCount(),
                    async (connectedProfileId) => {
    await populateProfileAndMatches(connectedProfileId, queueName, pool);
  });
}

const main = async () => {
  await sequelize.sync();
  app.listen(parseInt(process.env['PORT'] || '3000'));

  await setupResourceManager(resourceManager);

  const pool : PagePool = new PrioritizedPagePool(resourceManager,
                                                  PoolPriority.Medium);
  await mainJob(pool);

  await resourceManager.shutdown();
};

main();
