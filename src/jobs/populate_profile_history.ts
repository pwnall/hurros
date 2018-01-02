import PagePool from '../cluster/page_pool';
import { readJob, writeJob } from '../db/job_cache';
import { historyParserVersion } from '../scraper/match_history';
import { PlayerProfile } from '../scraper/player_profile';
import updateProfileHistory from './update_profile_history';

// Return true for success, false if the job was abandoned due to an exception.
export default async function populateProfileHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<boolean> {

  const namespace =
      `populate-profile-history.${queueName}.${historyParserVersion}`;
  const jobData = await readJob(namespace, profile.playerId,
                                historyParserVersion);
  if (jobData !== null)
    return true;

  // TODO(pwnall): Attempt to refresh old history data.

  const returnValue = await updateProfileHistory(profile, queueName, pool);
  if (returnValue) {
    await writeJob(namespace, profile.playerId, historyParserVersion,
                   { updatedAt: Date.now() });
  }
  return returnValue;
}
