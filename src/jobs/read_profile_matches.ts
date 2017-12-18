import { readProfileMatchMetadata } from '../db/match_profile';
import { readMatch, MatchSummary } from '../db/match';
import { PlayerProfile } from '../scraper/player_profile';

export default async function readProfileMatches(
    profile : PlayerProfile) : Promise<Array<MatchSummary>> {
  const matchesMetadata = await readProfileMatchMetadata(profile.playerId);

  return await Promise.all(matchesMetadata.map(async (matchMetadata) => {
    let matchData : MatchSummary;
    try {
      matchData = await readMatch(matchMetadata.data.replayId);
    } catch (e) {
      matchData = {
        metadata: matchMetadata.data,
        players: null,
      };
    }
    return matchData;
  }));
}