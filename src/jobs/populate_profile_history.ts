import { readJob, writeJob } from '../db/job_cache';
import { writeHistoryEntry } from '../db/match_profile';
import {
  extractMatchHistory, goToMatchHistory, historyParserVersion,
  nextMatchHistory, selectMatchHistoryQueue
} from '../scraper/match_history';
import PagePool from '../scraper/page_pool';
import { PlayerProfile } from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Populates the database with MatchProfile entries for all the matches.
export default async function populateProfileHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<void> {

  const namespace =
      `populate-profile-history.${historyParserVersion}.${queueName}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return;

  await pool.withPage(async (page) => {
    await retryWhileNonHtmlDocumentErrors(async () => {
      await goToMatchHistory(page, profile.playerId);
      await selectMatchHistoryQueue(page, queueName);

      let lastTopEntryId = '';
      let lastBottomEntryId = '';
      while (true) {
        const entries = await extractMatchHistory(page);

        // The "next" button is always enabled on the history page, so we need a
        // heuristic. We currently assume that if the first and last entry haven't
        // changed, it means that the "next" button didn't do anything.
        if (entries.length === 0 || (lastTopEntryId === entries[0].replayId &&
            lastBottomEntryId === entries[entries.length - 1].replayId)) {
          break;
        }

        lastTopEntryId = entries[0].replayId;
        lastBottomEntryId = entries[entries.length - 1].replayId;

        for (let entry of entries) {
          await writeHistoryEntry(entry, profile);
        }

        const foundNext = await nextMatchHistory(page);
        if (!foundNext)
          break;
      }
    });
  });

  await writeJob(
      namespace, profile.playerId, historyParserVersion,
      { updatedAt: Date.now() });
  return;
}
