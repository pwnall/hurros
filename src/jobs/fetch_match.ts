import { MatchSummary, writeMatch, readMatch } from '../db/match';
import { MatchMetadata } from '../db/match_profile';
import { extractMatchStats, goToMatchSummary } from '../scraper/match_summary';
import PagePool from '../scraper/page_pool';

export default async function fetchMatch(
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
