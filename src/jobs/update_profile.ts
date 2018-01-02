import PagePool from '../cluster/page_pool';
import { writeProfile } from '../db/profile';
import {
  PlayerProfile, goToProfileById, extractPlayerProfile,
} from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Scrape a profile from hotslogs and update the database cache.
//
// Returns a rejected promise if an error occurs.
export default async function updateProfile(
    playerId : string, pool : PagePool) : Promise<PlayerProfile> {
  const profile = await pool.withPage(async (page) => {
    return await retryWhileNonHtmlDocumentErrors(async () => {
      await goToProfileById(page, playerId);
      return await extractPlayerProfile(page);
    });
  });
  await writeProfile(profile);
  return profile;
}
