import { sequelize } from './db/connection';
import { writeHistoryEntry } from './db/match_profile';
import { readProfile, writeProfile } from './db/profile';
import {
  extractMatchHistory, goToMatchHistory, nextMatchHistory,
  selectMatchHistoryQueue,
} from './scraper/match_history';
import PagePool from './scraper/page_pool';
import {
  PlayerProfile,
  extractPlayerProfile,
  goToProfileById,
} from './scraper/player_profile';


async function fetchProfile(playerId : string,  pool : PagePool)
    : Promise<PlayerProfile> {
  const dbProfile = await readProfile(playerId);
  if (dbProfile !== null)
    return dbProfile;

  const profile = await pool.withPage(async (page) => {
    await goToProfileById(page, '274047');
    return await extractPlayerProfile(page);
  });
  await writeProfile(profile);

  return profile;
}

async function fetchProfileMatches(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<void> {

  await pool.withPage(async (page) => {
    await goToMatchHistory(page, profile.playerId);
    await selectMatchHistoryQueue(page, queueName);

    let lastTopEntryId = '';
    let lastBottomEntryId = '';
    while (true) {
      const entries = await extractMatchHistory(page);

      // The "next" button is always enabled on the history page, so we need a
      // heuristic. We currently assume that if the first and last entry haven't
      // changed, it means that the "next" button didn't do anything.
      if (entries.length === 0 || (lastTopEntryId === entries[0].replayId &&
          lastBottomEntryId === entries[entries.length - 1].replayId)) {
        break;
      }

      lastTopEntryId = entries[0].replayId;
      lastBottomEntryId = entries[entries.length - 1].replayId;

      for (let entry of entries) {
        await writeHistoryEntry(entry, profile);
      }

      const foundNext = await nextMatchHistory(page);
      if (!foundNext)
        break;
    }
  });
}

const main = async () => {
  await sequelize.sync();

  const pool = new PagePool();

  const profile = await fetchProfile('274047', pool);
  await fetchProfileMatches(profile, 'Quick Match', pool);
  console.log('Done fetching');

  await pool.shutdown();
};

main();
