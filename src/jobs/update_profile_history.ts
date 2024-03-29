import PagePool from '../cluster/page_pool';
import { writeHistoryEntry } from '../db/match_profile';
import {
  extractMatchHistory, nextMatchHistory,
  selectMatchHistoryQueue,
  matchHistoryUrl,
  ensureOnMatchHistoryPage,
} from '../scraper/match_history';
import { PlayerProfile } from '../scraper/player_profile';

// Job logic, without exception handling.
async function updateProfileMatchHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<boolean> {
  const playerId = profile.playerId;
  return await pool.withPage(matchHistoryUrl(playerId), async (page) => {
    await ensureOnMatchHistoryPage(page, playerId);
    if (!await selectMatchHistoryQueue(page, queueName))
      return false;

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

      // TODO(pwnall): Consider a batched write instead of ~20 separate writes.
      for (let entry of entries)
        await writeHistoryEntry(entry, profile);

      const foundNext = await nextMatchHistory(page);
      if (!foundNext)
        break;
    }
    return true;
  });
}

// Return true for success, false if the job was abandoned due to an exception.
export default async function updateProfileHistory(
    profile : PlayerProfile, queueName : string, pool : PagePool)
    : Promise<boolean> {
  try {
    return await updateProfileMatchHistory(profile, queueName, pool);
  } catch (e) {
    const profileId = profile.playerId;
    console.error(`Failed to update history for ${profileId}: ${e}`);
    return false;
  }
}
