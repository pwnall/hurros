import { readProfileMatchMetadata } from '../db/match_profile';
import { readMatches, MatchSummary } from '../db/match';
import { PlayerProfile } from '../scraper/player_profile';

export default async function readProfileMatches(
    profile : PlayerProfile) : Promise<Array<MatchSummary>> {
  const matchesMetadata = await readProfileMatchMetadata(profile.playerId);

  const replayIds = matchesMetadata.map((metadata) => metadata.data.replayId);
  const matchById : { [id: string]: MatchSummary } = {};
  for (let match of await readMatches(replayIds))
    matchById[match.metadata.replayId] = match;

  return matchesMetadata.map((matchMetadata) => {
    if (matchById[matchMetadata.data.replayId])
      return matchById[matchMetadata.data.replayId];

    return {
      metadata: matchMetadata.data,
      players: null,
    };
  });
}