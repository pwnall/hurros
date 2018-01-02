import { scrapeMatchSummary } from './helpers';
import PagePool from '../cluster/page_pool';
import { MatchSummary, writeMatch } from '../db/match';
import { MatchMetadata } from '../db/match_profile';

// Scrape a match from hotslogs and update the database cache.
//
// Returns a rejected promise if an error occurs.
//
// The match summary page does not contain the match's queue name (such as
// "Quick Match"). This job works around that lack by taking in the match's
// metadata (obtained from a history page). The queue name is then copied from
// the metadata.
export default async function updateMatch(
    metadata : MatchMetadata, pool : PagePool) : Promise<MatchSummary> {
  const players = await scrapeMatchSummary(metadata.replayId, pool);

  const match = { metadata: metadata, players: players };
  await writeMatch(match);
  return match;
}