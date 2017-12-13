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
}

// Sequelize service object.
interface MatchInstance extends Sequelize.Instance<MatchData>, MatchData {
}

// Sequelize model for MatchSummary.
const Match = sequelize.define<MatchInstance, MatchData>('match', {
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

// Creates or updates a profile in the database cache.
export async function writeMatch(match : MatchSummary) {
  await Match.upsert({
    id: match.metadata.replayId,
    data: match,
    data_version: matchParserVersion,
  });
}

// Fetches a profile from the database cache.
export async function readMatch(replayId : string)
    : Promise<MatchSummary | null> {
  const record = await Match.findById(replayId);
  if (record === null || record.data_version !== matchParserVersion)
    return null;

  return record.data;
}
