import fetchMatch from './fetch_match';

import { MatchProfileData, readProfileMatches } from '../db/match_profile';
import { MatchSummary } from '../db/match';
import PagePool from '../scraper/page_pool';
import { PlayerProfile } from '../scraper/player_profile';

export default async function populateProfileMatches(
    profile : PlayerProfile, pool : PagePool) : Promise<void> {
  const profileMatches : MatchProfileData[] =
      await readProfileMatches(profile.playerId);
  
  await Promise.all(profileMatches.map((profileMatch) => {
    return (async () : Promise<MatchSummary> => {
      try {
        return await fetchMatch(profileMatch.data, pool);
      } catch (e) {
        const replayId = profileMatch.data.replayId;
        console.error(`Failed to fetch match ${replayId}: ${e}`);
        return null;
      }
    })();
  }));
}
