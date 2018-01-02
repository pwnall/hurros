import PagePool from '../cluster/page_pool';
import { readProfile, writeProfile } from '../db/profile';
import {
    PlayerProfile, extractPlayerProfile, goToProfileById,
} from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Return the profile for the given player ID.
//
// The database is used as a caching layer. If the profile is not cached, uses a
// scraper to read the profile from hotslogs.
export default async function fetchProfile(playerId : string,  pool : PagePool)
    : Promise<PlayerProfile> {
  const dbProfile = await readProfile(playerId);
  if (dbProfile !== null)
    return dbProfile;

  const profile = await pool.withPage(async (page) => {
    return await retryWhileNonHtmlDocumentErrors(async () => {
      await goToProfileById(page, playerId);
      return await extractPlayerProfile(page);
    });
  });
  await writeProfile(profile);

  return profile;
}