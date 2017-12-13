import { readProfile, writeProfile } from '../db/profile';
import PagePool from '../scraper/page_pool';
import {
    PlayerProfile, extractPlayerProfile, goToProfileById,
} from '../scraper/player_profile';
import { retryWhileNonHtmlDocumentErrors } from '../scraper/rate_limit_helper';

// Gets a player profile from hotslogs or from the database.
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