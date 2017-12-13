import { MatchMetadata, readProfileMatchMetadata } from '../db/match_profile';
import { MatchSummary, writeMatch, readMatch } from '../db/match';
import { extractMatchStats, goToMatchSummary } from '../scraper/match_summary';
import PagePool from '../scraper/page_pool';
import { PlayerProfile } from '../scraper/player_profile';

async function fetchMatch(
    metadata : MatchMetadata, pool : PagePool) : Promise<MatchSummary> {
  const dbMatch = await readMatch(metadata.replayId);
  if (dbMatch !== null)
      return dbMatch;

  const players = await pool.withPage(async (page) => {
    await goToMatchSummary(page, metadata.replayId);
    return await extractMatchStats(page);
  });

  const match = { metadata: metadata, players: players };
  await writeMatch(match);
  return match;
}

export default async function populateProfileMatches(
    profile : PlayerProfile, pool : PagePool) : Promise<void> {
  const matchesMetadata = await readProfileMatchMetadata(profile.playerId);
  
  await Promise.all(matchesMetadata.map(async (matchMetadata) => {
    try {
      return await fetchMatch(matchMetadata.data, pool);
    } catch (e) {
      const replayId = matchMetadata.data.replayId;
      console.error(`Failed to fetch match ${replayId}: ${e}`);
      return null;
    }
  }));
}
