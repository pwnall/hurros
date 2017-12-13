import { sequelize } from './db/connection';
import PagePool from './scraper/page_pool';
import fetchProfile from './jobs/fetch_profile';
import populateProfileHistory from './jobs/populate_profile_history';
import populateProfileMatches from './jobs/populate_profile_matches';
import { PlayerProfile } from './scraper/player_profile';
import { readProfileMatchMetadata } from './db/match_profile';
import { readMatch, MatchSummary } from './db/match';

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
      playerIds.add(player.playerId);
    }
  }

  return Array.from(playerIds);
}

async function populateProfileAndMatches(profileId : string, pool : PagePool)
    : Promise<PlayerProfile> {
  console.log(`Started crawling profile ${profileId}`);
  const profile = await fetchProfile(profileId, pool);
  console.log('Populated profile');

  await populateProfileHistory(profile, 'Quick Match', pool);
  console.log('Populated main profile history');

  await populateProfileMatches(profile, pool);
  console.log('Populated main profile matches');

  return profile;
}

const main = async () => {
  await sequelize.sync();

  // Concurrency seems to run into rate-limiting quite quickly.
  const pool = new PagePool(1);

  const profile = await populateProfileAndMatches('1141532', pool);

  const connectedProfileIds = await fetchConnectedProfileIds(profile);
  for (let connectedProfileId of connectedProfileIds) {
    await populateProfileAndMatches(connectedProfileId, pool);
  }

  await pool.shutdown();
};

main();
