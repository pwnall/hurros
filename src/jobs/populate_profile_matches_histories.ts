import populateMatchHistories from './populate_match_histories';
import readProfileMatches from './read_profile_matches';

import { PlayerProfile } from '../scraper/player_profile';
import PagePool from '../cluster/page_pool';
import { readJob, writeJob } from '../db/job_cache';
import { historyParserVersion } from '../scraper/match_history';

export default async function populateProfileMatchesHistories(
    profile : PlayerProfile, pool : PagePool) : Promise<boolean> {
  const namespace =
      `populate-profile-matches-histories.${historyParserVersion}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return true;

  const matches = await readProfileMatches(profile);
  for (let match of matches)
    await populateMatchHistories(match, pool);

  await writeJob(namespace, profile.playerId, historyParserVersion,
                 { updatedAt: Date.now() });
  return true;
}