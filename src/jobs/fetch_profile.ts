import updateProfile from './update_profile';
import PagePool from '../cluster/page_pool';
import { readProfile } from '../db/profile';
import { PlayerProfile } from '../scraper/player_profile';

// Return the profile for the given player ID.
//
// The database is used as a caching layer. If the profile is not cached, uses a
// scraper to read the profile from hotslogs.
export default async function fetchProfile(playerId : string,  pool : PagePool)
    : Promise<PlayerProfile> {
  const dbProfile = await readProfile(playerId);
  if (dbProfile !== null)
    return dbProfile;

  // TODO(pwnall): Attempt to refresh old profile data.

  return await updateProfile(playerId, pool);
}