import { MatchSummary } from "../db/match";
import PagePool from '../cluster/page_pool';
import {
  extractMatchStats, goToMatchSummary, PlayerMatchSummary,
} from '../scraper/match_summary';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Extract the valid player IDs associated with a match.
export function matchPlayerIds(match : MatchSummary) : string[] {
  const playerIdSet = new Set<string>();
  for (let player of match.players) {
    const playerId = player.playerId;
    if (playerId)
      playerIdSet.add(playerId);
  }
  return Array.from(playerIdSet);
}

// Retrieve match summary information from hotslogs.
//
// Returns a rejected promise if an error occurs.
export async function scrapeMatchSummary(replayId : string, pool : PagePool)
    : Promise<PlayerMatchSummary[]> {
  return await pool.withPage(async (page) => {
    return await retryWhileNonHtmlDocumentErrors(async () => {
      await goToMatchSummary(page, replayId);
      return await extractMatchStats(page);
    });
  });
}