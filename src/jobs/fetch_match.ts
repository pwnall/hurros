import fetchProfile from './fetch_profile';
import { scrapeMatchSummary } from './helpers';
import populateProfileHistory from './populate_profile_history';
import updateMatch from './update_match';
import PagePool from '../cluster/page_pool';
import { readMatch, writeMatch, MatchSummary } from '../db/match';
import {
  readMatchMetadata, readProfileMatchMetadata,
} from '../db/match_profile';

// Roots for all hotslogs queue names.
//
// The roots need to be clear enough to select the correct queue names from the
// dropdown on the history page, but don't need to be longer than that.
const queueNames = [
  // Listing "Hero League" before everything else should avoid one dropdown
  // change, as "Hero League" is the default mode.
  'Hero',      // Hero League

  'Quick',     // Quick Match
  'Team',      // Team Laegue
  'Unranked',  // Unranked Draft
];

// Gets a match from hotslogs or from the database.
export default async function fetchMatch(replayId : string,  pool : PagePool)
    : Promise<MatchSummary> {
  const dbMatch = await readMatch(replayId);
  if (dbMatch !== null)
    return dbMatch;

  // Use existing metadata, if it is available.
  const dbMetadata = await readMatchMetadata(replayId);
  if (dbMetadata.length > 0)
    return await updateMatch(dbMetadata[0].data, pool);

  // Existing metadata is not available. Fetch the match to get the player IDs,
  // then try to find the match in the players' histories.
  const players = await scrapeMatchSummary(replayId, pool);
  for (let player of players) {
    const playerId = player.playerId;
    const profile = await fetchProfile(playerId, pool);

    // Populate the player's history in all queue modes.
    for (let queueName of queueNames) {
      try {
        await populateProfileHistory(profile, queueName, pool);
      } catch(e) {
        // Keep looking at the other queues and players. The match might show up
        // elsewhere.
      }
    }

    // Read the populated metadata and try to find our match there.
    //
    // If history population was slow, we'd do the database read for every queue
    // name, instead of blindly retrieving the history for all queue names
    // first.
    const dbProfileMatchMetadata = await readProfileMatchMetadata(playerId,
                                                                  null);
    for (let metadata of dbProfileMatchMetadata) {
      if (metadata.data.replayId === replayId) {
        const match = { metadata: metadata.data, players: players };
        await writeMatch(match);
        return match;
      }
    }
  }

  throw new Error(`No player history metadata found for match ${replayId}`);
}