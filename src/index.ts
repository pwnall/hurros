import { sequelize } from './db/connection';
import PagePool from './scraper/page_pool';
import fetchProfile from './jobs/fetch_profile';
import populateProfileHistory from './jobs/populate_profile_history';
import populateProfileMatches from './jobs/populate_profile_matches';


const main = async () => {
  await sequelize.sync();

  // Concurrency seems to run into rate-limiting quite quickly.
  const pool = new PagePool(1);

  const profile = await fetchProfile('1141532', pool);
  await populateProfileHistory(profile, 'Quick Match', pool);
  console.log('Populated main profile history');

  await populateProfileMatches(profile, pool);
  console.log('Populated main profile matches');

  await pool.shutdown();
};

main();
