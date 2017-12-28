import * as Sequelize from 'sequelize';

import {
  PlayerMatchSummary, matchParserVersion,
} from '../scraper/match_summary';

import { sequelize } from './connection';
import { MatchMetadata } from './match_profile';

// Information stored in the database for each game.
//
// This includes general metadata and per-player information.
export interface MatchSummary {
  metadata : MatchMetadata,
  players : PlayerMatchSummary[],
}

// Sequelize service object.
interface MatchData {
  id : string,
  data : MatchSummary,
  data_version : string,

  updated_at? : Date,
}

// Sequelize service object.
interface MatchInstance extends Sequelize.Instance<MatchData>, MatchData {
}

// Sequelize model for MatchSummary.
export const MatchModel = sequelize.define<MatchInstance, MatchData>('match', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  data: Sequelize.JSON,
  data_version: Sequelize.STRING,
}, {
  createdAt: false,
  updatedAt: 'updated_at',
});

// Creates or updates a match in the database cache.
export async function writeMatch(match : MatchSummary) {
  await MatchModel.upsert({
    id: match.metadata.replayId,
    data: match,
    data_version: matchParserVersion,
  });
}

// Fetches a match from the database cache.
export async function readMatch(replayId : string)
    : Promise<MatchSummary | null> {
  const record = await MatchModel.findById(replayId);
  if (record === null || (record.data_version !== matchParserVersion &&
                          record.data_version !== "1"))
    return null;

  // TODO(pwnall): Remove the additional version check above and in-place
  //               upgrade code here when the database has been fully upgraded.
  if (record.data_version === "1") {
    const data = record.data;
    for (let player of data.players) {
      if ('blueTeam' in player) {
        player.winningTeam = (player as any).blueTeam;
        delete (player as any).blueTeam;
      } else {
        player.winningTeam = player.winningTeam || null;
      }
    }
    await writeMatch(data);
  }

  return record.data;
}

// Fetches the update time of a match in the database cache.
export async function readMatchUpdatedAt(replayId : string)
    : Promise<Date | null> {

  const record = await MatchModel.findById(replayId);
  if (record === null || record.data_version !== matchParserVersion)
    return null;

  return record.updated_at;
}