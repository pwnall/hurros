import { sequelize } from './db/connection';
import { readProfileMatches, MatchProfileData } from './db/match_profile';
import PagePool from './scraper/page_pool';
import { PlayerProfile } from './scraper/player_profile';
import { MatchSummary } from './db/match';
import fetchMatch from './jobs/fetch_match';
import fetchProfile from './jobs/fetch_profile';
import populateProfileHistory from './jobs/populate_profile_history';


async function populateProfileMatches(
    profile : PlayerProfile, pool : PagePool) : Promise<void> {
  const profileMatches : MatchProfileData[] =
      await readProfileMatches(profile.playerId);
  
  await Promise.all(profileMatches.map((profileMatch) => {
    return (async () : Promise<MatchSummary> => {
      try {
        return await fetchMatch(profileMatch.data, pool);
      } catch (e) {
        const replayId = profileMatch.data.replayId;
        console.error(`Failed to fetch match ${replayId}: ${e}`);
        return null;
      }
    })();
  }));
}

const main = async () => {
  await sequelize.sync();

  // Concurrency seems to run into rate-limiting quite quickly.
  const pool = new PagePool(1);

  const profile = await fetchProfile('1141532', pool);
  await populateProfileHistory(profile, 'Quick Match', pool);
  console.log('Populated profile history');

  await populateProfileMatches(profile, pool);
  await pool.shutdown();
};

main();
