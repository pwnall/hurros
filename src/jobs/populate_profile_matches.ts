import updateMatch from './update_match';
import PagePool from '../cluster/page_pool';
import { throttledAsyncMap } from '../cluster/throttled_async_map';
import { readJob, writeJob } from '../db/job_cache';
import { readMatch, readMatchUpdatedAt, MatchSummary } from '../db/match';
import { readProfileMatchMetadata, MatchMetadata } from '../db/match_profile';
import { matchParserVersion } from '../scraper/match_summary';
import { PlayerProfile } from '../scraper/player_profile';

// Return full match data corresponding to the given metadata.
//
// The database is used as a caching layer. If the profile is not cached, uses a
// scraper to read the match data from hotslogs.
export async function fetchMatchFromMetadata(
    metadata : MatchMetadata, pool : PagePool) : Promise<MatchSummary> {
  const dbMatch = await readMatch(metadata.replayId);

  if (dbMatch !== null) {
    // Check for matches with missing player IDs, and re-fetch them every 14
    // days, in case they get fixed.

    let hasInvalidPlayerId = false;
    for (let player of dbMatch.players) {
      if (!player.playerId) {
        hasInvalidPlayerId = true;
        break;
      }
    }

    if (!hasInvalidPlayerId)
      return dbMatch;

    const matchDate = await readMatchUpdatedAt(metadata.replayId);
    const cacheLifetime = 14 * 24 * 60 * 60 * 1000;  // 14 days
    if (matchDate && Date.now() - matchDate.getTime() <= cacheLifetime)
      return dbMatch;
  }

  return await updateMatch(metadata, pool);
}

// Return true for success, false if the job was abandoned due to an exception.
export default async function populateProfileMatches(
    profile : PlayerProfile, queueName : string | null, pool : PagePool)
    : Promise<boolean> {
  const namespace =
      `populate-profile-matches.${queueName}.${matchParserVersion}`;
  const jobData = await readJob(
      namespace, profile.playerId, matchParserVersion);
  if (jobData !== null)
    return true;

  const matchesMetadata = await readProfileMatchMetadata(profile.playerId,
                                                         queueName);

  await throttledAsyncMap(matchesMetadata, pool.pageCount(),
                          async (matchMetadata) => {
    try {
      return await fetchMatchFromMetadata(matchMetadata.data, pool);
    } catch (e) {
      const replayId = matchMetadata.data.replayId;
      console.error(`Failed to fetch match ${replayId}: ${e}`);
      return false;
    }
  });

  await writeJob(namespace, profile.playerId, matchParserVersion,
                 { updatedAt: Date.now() });
  return true;
}
