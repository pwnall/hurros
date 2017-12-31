import * as puppeteer from 'puppeteer';

import PagePool from '../cluster/page_pool';
import { readJob, writeJob } from '../db/job_cache';
import { writeHistoryEntry } from '../db/match_profile';
import {
  extractMatchHistory, goToMatchHistory, historyParserVersion,
  nextMatchHistory, selectMatchHistoryQueue
} from '../scraper/match_history';
import { PlayerProfile } from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Job variant that does not handle exceptions.
async function populateProfileMatchHistory(
    profile : PlayerProfile, queueName : string, page : puppeteer.Page)
    : Promise<void> {
  await goToMatchHistory(page, profile.playerId);
  await selectMatchHistoryQueue(page, queueName);

  let lastTopEntryId = '';
  let lastBottomEntryId = '';
  while (true) {
    const entries = await extractMatchHistory(page);

    // The "next" button is always enabled on the history page, so we need a
    // heuristic. We currently assume that if the first and last entry
    // haven't changed, it means that the "next" button didn't do anything.
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
}

// Returns true for success, false if the job was abandoned due to an exception.
export default async function populateProfileHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<boolean> {

  const namespace =
      `populate-profile-history.${historyParserVersion}.${queueName}`;
  const jobData = await readJob(
      namespace, profile.playerId, historyParserVersion);
  if (jobData !== null)
    return true;

  try {
    await pool.withPage(async (page) => {
      await retryWhileNonHtmlDocumentErrors(async () => {
        await populateProfileMatchHistory(profile, queueName, page);
      });
    });
  } catch (e) {
    const profileId = profile.playerId;
    console.error(`Failed to populate history for ${profileId}: ${e}`);
    return false;
  }

  await writeJob(namespace, profile.playerId, historyParserVersion,
                 { updatedAt: Date.now() });
  return true;
}
