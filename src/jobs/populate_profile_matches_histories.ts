import populateMatchHistories from './populate_match_histories';
import readProfileMatches from './read_profile_matches';

import { PlayerProfile } from '../scraper/player_profile';
import PagePool from '../cluster/page_pool';
import { readJob, writeJob } from '../db/job_cache';
import { historyParserVersion } from '../scraper/match_history';
import { MatchSummary } from '../db/match';

// Strip down match data to the bare minimum, to reduce memory consumption.
function strippedMatchData(fullMatches : MatchSummary[]) : MatchSummary[] {
  return fullMatches.map((fullMatch) => {
    return {
      metadata: {
        replayId: fullMatch.metadata.replayId,
        queueName: fullMatch.metadata.queueName,
      },
      players: fullMatch.players.map((fullPlayer) => {
        return {
          playerId: fullPlayer.playerId,
          winningTeam: fullPlayer.winningTeam,
          hlScore: null,
          mmr: null,
          talentNames: null,
          talentDescriptions: null,
        };
      }),
    };
  });
}

// Return true for success, false if the job was abandoned due to an exception.
export default async function populateProfileMatchesHistories(
    profile : PlayerProfile, pool : PagePool) : Promise<boolean> {
  const namespace =
      `populate-profile-matches-histories.${historyParserVersion}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return true;

  let returnValue = true;
  try {
    const matches = strippedMatchData(await readProfileMatches(profile));

    for (let match of matches) {
      if (!await populateMatchHistories(match, pool))
        returnValue = false;
    }
  } catch(e) {
    const profileId = profile.playerId;
    console.error(
        `Failed to populate matches players history for ${profileId}: ${e}`);
    return false;
  }

  if (returnValue) {
    await writeJob(namespace, profile.playerId, historyParserVersion,
                   { updatedAt: Date.now() });
  }
  return returnValue;
}