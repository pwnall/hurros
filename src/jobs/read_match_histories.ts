import { MatchSummary } from '../db/match';
import { MatchProfileData, readProfilesMatchMetadata } from '../db/match_profile';


// Extracts the valid player IDs associated with a match.
//
// TODO(pwnall): This is duplicated in populate_match_histories.
function matchPlayerIds(match : MatchSummary) : string[] {
  const playerIdSet = new Set<string>();
  for (let player of match.players) {
    const playerId = player.playerId;
    if (playerId)
      playerIdSet.add(playerId);
  }
  return Array.from(playerIdSet);
}

// Reads the histories of all players associated with a match.
//
// Each player's history is a list of matches, sorted by match time. The matches
// will all be in the same queue type as the given match, and will have been
// played before the given match.
export default async function readMatchHistories(match : MatchSummary) :
    Promise<{ [playerId: string] : MatchProfileData[] }> {
  const playedAt = match.metadata.playedAt;
  const queueName = match.metadata.queueName;

  const playerIds = matchPlayerIds(match);
  const metadataByPlayer = new Map<string, MatchProfileData[]>();
  for (let matchMetadata of await readProfilesMatchMetadata(playerIds)) {
    // Filter new history.
    if (matchMetadata.data.playedAt >= playedAt)
      continue;

    // Filter diffrent queues.
    if (matchMetadata.data.queueName !== queueName)
      continue;

    const playerId = matchMetadata.profile_id;
    if (!metadataByPlayer.has(playerId))
      metadataByPlayer.set(playerId, []);
    metadataByPlayer.get(playerId).push(matchMetadata);
  }

  const returnValue : { [playerId: string] : MatchProfileData[] } = {};
  for (let [playerId, matches] of metadataByPlayer) {
    matches.sort((a, b) => {
      return a.data.playedAt.valueOf() - b.data.playedAt.valueOf();
    });
    returnValue[playerId] = matches;
  }
  return returnValue;
}