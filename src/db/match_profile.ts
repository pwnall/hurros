import * as Sequelize from 'sequelize';

import {
  historyParserVersion, MatchHistoryEntry,
} from '../scraper/match_history';
import { PlayerProfile } from '../scraper/player_profile';

import { sequelize } from './connection';

// Match information that applies to all players.
export interface MatchMetadata {
  replayId? : string,
  region? : string,
  mapName? : string,
  queueName? : string,
  playedAt? : Date,
  durationSeconds? : number,
}

// Extracts match metadata from history entry information.
export function matchMetadataFromHistoryEntry(
    entry : MatchHistoryEntry, profile : PlayerProfile) : MatchMetadata {
  return {
    replayId: entry.replayId,
    mapName: entry.map,
    queueName: entry.queueName,
    region: profile.playerRegion,
    playedAt: entry.time,
    durationSeconds: entry.durationSeconds,
  }
}

// Connection between a match and a profile.
export interface MatchProfileData {
  profile_id : string,
  match_id : string,
  played_at: Date,
  data: MatchMetadata,
  data_version: string,
}

// Sequelize service object.
interface MatchProfileInstance extends Sequelize.Instance<MatchProfileData>,
    MatchProfileData {
}

// Sequelzie model for MatchProfileData.
const MatchProfile = sequelize.define<MatchProfileInstance, MatchProfileData>(
    'match_profile', {
  profile_id: Sequelize.STRING,
  match_id: Sequelize.STRING,
  played_at: Sequelize.DATE,
  data : Sequelize.JSON,
  data_version: Sequelize.STRING,
}, {
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { unique: true, fields: [ 'profile_id', 'match_id' ]},
  ]
});

export async function readMatchProfile(playerId : string, replayId : string)
    : Promise<MatchProfileData | null> {
  const record = await MatchProfile.findOne(
      { where: { profile_id: playerId, match_id: replayId } });
  if (record === null || record.data_version !== historyParserVersion)
    return null;

  return record;
}

export async function writeHistoryEntry(
    entry : MatchHistoryEntry, profile : PlayerProfile) {
  await MatchProfile.upsert({
    profile_id: entry.playerId,
    match_id: entry.replayId,
    played_at: entry.time,
    data: matchMetadataFromHistoryEntry(entry, profile),
    data_version: historyParserVersion,
  })
}
