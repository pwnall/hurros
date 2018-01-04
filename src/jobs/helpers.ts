import { MatchSummary } from "../db/match";
import PagePool from '../cluster/page_pool';
import {
  ensureOnMatchSummaryPage, extractMatchStats,  matchSummaryUrl,
  PlayerMatchSummary,
} from '../scraper/match_summary';

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
  return await pool.withPage(matchSummaryUrl(replayId), async (page) => {
    await ensureOnMatchSummaryPage(page, replayId);
    return await extractMatchStats(page);
  });
}