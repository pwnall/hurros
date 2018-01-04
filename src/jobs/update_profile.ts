import PagePool from '../cluster/page_pool';
import { writeProfile } from '../db/profile';
import {
   ensureOnProfilePage, extractPlayerProfile, profileUrl, PlayerProfile,
} from '../scraper/player_profile';

// Scrape a profile from hotslogs and update the database cache.
//
// Returns a rejected promise if an error occurs.
export default async function updateProfile(
    playerId : string, pool : PagePool) : Promise<PlayerProfile> {
  const profile = await pool.withPage(profileUrl(playerId), async (page) => {
    await ensureOnProfilePage(page, playerId);
    return await extractPlayerProfile(page);
  });
  await writeProfile(profile);
  return profile;
}
