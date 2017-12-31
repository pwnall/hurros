import populateMatchHistories from './populate_match_histories';
import readProfileMatches from './read_profile_matches';

import { PlayerProfile } from '../scraper/player_profile';
import PagePool from '../cluster/page_pool';
import { readJob, writeJob } from '../db/job_cache';
import { historyParserVersion } from '../scraper/match_history';

// Returns true for success, false if the job was abandoned due to an exception.
export default async function populateProfileMatchesHistories(
    profile : PlayerProfile, pool : PagePool) : Promise<boolean> {
  const namespace =
      `populate-profile-matches-histories.${historyParserVersion}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return true;

  const matches = await readProfileMatches(profile);
  // Remove unnecessary match components to reduce memory consumption.
  for (let match of matches) {
    for (let player of match.players) {
      player.talentNames = null;
      player.talentDescriptions = null;
      player.award = null;
    }
  }

  for (let match of matches)
    await populateMatchHistories(match, pool);

  await writeJob(namespace, profile.playerId, historyParserVersion,
                 { updatedAt: Date.now() });
  return true;
}