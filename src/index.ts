import { sequelize } from './db/connection';
import { writeHistoryEntry, MatchMetadata, readProfileMatches, MatchProfileData } from './db/match_profile';
import { readProfile, writeProfile } from './db/profile';
import {
  extractMatchHistory, goToMatchHistory, nextMatchHistory,
  selectMatchHistoryQueue,
  historyParserVersion,
} from './scraper/match_history';
import PagePool from './scraper/page_pool';
import {
  PlayerProfile,
  extractPlayerProfile,
  goToProfileById,
} from './scraper/player_profile';
import { MatchSummary, readMatch, writeMatch } from './db/match';
import { extractMatchStats, goToMatchSummary } from './scraper/match_summary';
import { readJob, writeJob } from './db/job_cache';


async function fetchProfile(playerId : string,  pool : PagePool)
    : Promise<PlayerProfile> {
  const dbProfile = await readProfile(playerId);
  if (dbProfile !== null)
    return dbProfile;

  const profile = await pool.withPage(async (page) => {
    await goToProfileById(page, playerId);
    return await extractPlayerProfile(page);
  });
  await writeProfile(profile);

  return profile;
}

async function fetchMatchSummary(metadata : MatchMetadata, pool : PagePool)
    : Promise<MatchSummary> {
  const dbMatch = await readMatch(metadata.replayId);
  if (dbMatch !== null)
      return dbMatch;

  const players = await pool.withPage(async (page) => {
    await goToMatchSummary(page, metadata.replayId);
    return await extractMatchStats(page);
  });

  const match = { metadata: metadata, players: players };
  await writeMatch(match);
  return match;
}

async function populateProfileHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<void> {

  const namespace = `populate-profile-history.${queueName}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return;

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

  await writeJob(
      namespace, profile.playerId, historyParserVersion,
      { updatedAt: Date.now() });
  return;
}

async function fetchProfileMatches(
    profile : PlayerProfile, pool : PagePool) : Promise<MatchSummary[]> {
  const profileMatches : MatchProfileData[] =
      await readProfileMatches(profile.playerId);
  
  const summaries = await Promise.all(profileMatches.map((profileMatch) => {
    return (async () : Promise<MatchSummary> => {
      try {
        return await fetchMatchSummary(profileMatch.data, pool);
      } catch (e) {
        const replayId = profileMatch.data.replayId;
        console.error(`Failed to fetch match ${replayId}: ${e}`);
        return null;
      }
    })();
  }));
  
  return summaries.filter(summary => summary !== null);
}

const main = async () => {
  await sequelize.sync();

  const pool = new PagePool();

  const profile = await fetchProfile('1141532', pool);
  await populateProfileHistory(profile, 'Quick Match', pool);
  console.log('Populated profile history');

  await fetchProfileMatches(profile, pool);
  await pool.shutdown();
};

main();
