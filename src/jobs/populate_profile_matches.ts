import { MatchMetadata, readProfileMatchMetadata } from '../db/match_profile';
import { MatchSummary, writeMatch, readMatch, readMatchUpdatedAt } from '../db/match';
import { extractMatchStats, goToMatchSummary } from '../scraper/match_summary';
import PagePool from '../cluster/page_pool';
import { PlayerProfile } from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

async function fetchMatch(
    metadata : MatchMetadata, pool : PagePool) : Promise<MatchSummary> {
  const dbMatch = await readMatch(metadata.replayId);

  if (dbMatch !== null) {
    // Check for matches with missing player IDs, and re-fetch them every 14
    // days, in case they get fixed.

    let hasInvalidPlayerId = false;
    for (let player of dbMatch.players) {
      if (!player.playerId) {
        hasInvalidPlayerId = true;
        break;
      }
    }

    if (!hasInvalidPlayerId)
      return dbMatch;

    const matchDate = await readMatchUpdatedAt(metadata.replayId);
    const cacheLifetime = 14 * 24 * 60 * 60 * 1000;  // 14 days
    if (matchDate && Date.now() - matchDate.getTime() <= cacheLifetime)
      return dbMatch;
  }

  const players = await pool.withPage(async (page) => {
    return await retryWhileNonHtmlDocumentErrors(async () => {
      await goToMatchSummary(page, metadata.replayId);
      return await extractMatchStats(page);
    });
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
