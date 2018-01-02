import { readProfileMatchMetadata } from '../db/match_profile';
import { readMatches, MatchSummary } from '../db/match';
import { PlayerProfile } from '../scraper/player_profile';

// Read all the matches associated with a profile.
export default async function readProfileMatches(
    profile : PlayerProfile, queueName : string | null)
    : Promise<MatchSummary[]> {
  const matchesMetadata = await readProfileMatchMetadata(profile.playerId,
                                                         queueName);
  const replayIds = matchesMetadata.map((metadata) => metadata.data.replayId);
  const matchById : { [id: string]: MatchSummary } = {};
  for (let match of await readMatches(replayIds))
    matchById[match.metadata.replayId] = match;

  return matchesMetadata.map((matchMetadata) => {
    if (matchById[matchMetadata.data.replayId])
      return matchById[matchMetadata.data.replayId];

    return {
      metadata: matchMetadata.data,
      // Setting players to null would make it possible to distinguish between
      // matches with no data and matches that haven't been scraped yet.
      //
      // However, having to check for nulls means that all the consumers of this
      // job, have to add a special case check, which has proven to be of a
      // pain.
      players: [],
    };
  });
}