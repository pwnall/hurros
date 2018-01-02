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

// Create or update a match in the database cache.
export async function writeMatch(match : MatchSummary) {
  await MatchModel.upsert({
    id: match.metadata.replayId,
    data: match,
    data_version: matchParserVersion,
  });
}

// Fetch a match from the database cache.
export async function readMatch(replayId : string)
    : Promise<MatchSummary | null> {
  const record = await MatchModel.findById(replayId);
  if (record === null || record.data_version !== matchParserVersion)
    return null;

  return record.data;
}

// Fetches a bunch of matches from the database cache.
//
// If the cache does not contain all the requested data, returns the subset of
// the requested matches that do exist.
export async function readMatches(replayIds : string[])
    : Promise<MatchSummary[]> {
  const records = await MatchModel.findAll({ where: {
    id: { [Sequelize.Op.in]: replayIds },
  }});

  return records.
      filter((record) => record.data_version === matchParserVersion).
      map((record) => record.data);
}

// Fetch the update time of a match in the database cache.
export async function readMatchUpdatedAt(replayId : string)
    : Promise<Date | null> {

  const record = await MatchModel.findById(replayId);
  if (record === null || record.data_version !== matchParserVersion)
    return null;

  return record.updated_at;
}