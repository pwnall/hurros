import fetchProfile from './fetch_profile';
import populateProfileHistory from './populate_profile_history';

import PagePool from '../cluster/page_pool';
import { throttledAsyncMap } from '../cluster/throttled_async_map';
import { readJob, writeJob } from '../db/job_cache';
import { MatchSummary } from '../db/match';
import { historyParserVersion } from '../scraper/match_history';

// Extracts the valid player IDs associated with a match.
function matchPlayerIds(match : MatchSummary) : string[] {
  const playerIdSet = new Set<string>();
  for (let player of match.players) {
    const playerId = player.playerId;
    if (playerId)
      playerIdSet.add(playerId);
  }
  return Array.from(playerIdSet);
}

// Returns true for success, false if the job was abandoned due to an exception.
export default async function populateMatchHistories(
    match : MatchSummary, pool : PagePool) : Promise<boolean> {
  const namespace =
      `populate-match-histories.${historyParserVersion}`;
  const jobData = await readJob(
      namespace, match.metadata.replayId, historyParserVersion);
  if (jobData !== null)
    return true;

  try {
    // TODO(pwnall): Skip populating histories for matches without 10 players?
    const playerIds = matchPlayerIds(match);

    throttledAsyncMap(playerIds, pool.pageCount(), async (playerId) => {
      const playerProfile = await fetchProfile(playerId, pool);
      await populateProfileHistory(
          playerProfile, match.metadata.queueName, pool);
    });
  } catch(e) {
    const replayId = match.metadata.replayId;
    console.error(
        `Failed to populate match players history for ${replayId}: ${e}`);
    return false;
  }

  await writeJob(namespace, match.metadata.replayId, historyParserVersion,
                 { updatedAt: Date.now() });
  return true;
}