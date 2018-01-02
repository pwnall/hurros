import fetchProfile from './fetch_profile';
import populateProfileHistory from './populate_profile_history';

import { matchPlayerIds } from './helpers';
import PagePool from '../cluster/page_pool';
import { throttledAsyncMap } from '../cluster/throttled_async_map';
import { readJob, writeJob } from '../db/job_cache';
import { MatchSummary } from '../db/match';
import { historyParserVersion } from '../scraper/match_history';

// Return true for success, false if the job was abandoned due to an exception.
export default async function populateMatchHistories(
    match : MatchSummary, pool : PagePool) : Promise<boolean> {
  const namespace =
      `populate-match-histories.${historyParserVersion}`;
  const jobData = await readJob(
      namespace, match.metadata.replayId, historyParserVersion);
  if (jobData !== null)
    return true;

  let returnValue = true;
  try {
    // TODO(pwnall): Skip populating histories for matches without 10 players?
    const playerIds = matchPlayerIds(match);

    await throttledAsyncMap(playerIds, pool.pageCount(), async (playerId) => {
      const playerProfile = await fetchProfile(playerId, pool);
      if (!await populateProfileHistory(
          playerProfile, match.metadata.queueName, pool)) {
        returnValue = false;
      }
    });
  } catch(e) {
    const replayId = match.metadata.replayId;
    console.error(
        `Failed to populate match players history for ${replayId}: ${e}`);
    return false;
  }

  if (returnValue) {
    await writeJob(namespace, match.metadata.replayId, historyParserVersion,
                  { updatedAt: Date.now() });
  }
  return true;
}