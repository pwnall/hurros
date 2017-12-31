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

// Match information from MatchHistoryEntry that only applies to one player.
export interface PersonalMatchMetadata {
  won? : boolean,
  hero? : string,
  heroLevel? : number,
  mmr : { starting? : number, delta? : number },
}

// Extracts MatchMetadata information from MatchHistoryEntry.
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

export function personalMatchMetadataFromHistoryEntry(
    entry : MatchHistoryEntry) : PersonalMatchMetadata {
  return {
    won: entry.won,
    hero: entry.hero,
    heroLevel: entry.heroLevel,
    mmr: entry.mmr,
  };
}

// Connection between a match and a profile.
export interface MatchProfileData {
  profile_id : string,
  match_id : string,
  played_at: Date,
  data: MatchMetadata,
  data_version: string,
  player_data: PersonalMatchMetadata,
}

// Sequelize service object.
interface MatchProfileInstance extends Sequelize.Instance<MatchProfileData>,
    MatchProfileData {
}

// Sequelzie model for MatchProfileData.
export const MatchProfileModel =
    sequelize.define<MatchProfileInstance, MatchProfileData>('match_profile', {
  profile_id: Sequelize.STRING,
  match_id: Sequelize.STRING,
  played_at: Sequelize.DATE,
  data : Sequelize.JSON,
  data_version: Sequelize.STRING,
  player_data: Sequelize.JSON,
}, {
  createdAt: false,
  updatedAt: 'updated_at',
  indexes: [
    // Fetch all the matches belonging to a player.
    { unique: true, fields: [ 'profile_id', 'match_id' ]},

    // Fetch all the players beloning to a match.
    // This is only useful if the match hasn't been populated. Otherwise, the
    // match data should have all the player IDs in it.
    { unique: true, fields: [ 'match_id', 'profile_id' ]},
  ]
});

export async function readMatchProfile(playerId : string, replayId : string)
    : Promise<MatchProfileData | null> {
  const record = await MatchProfileModel.findOne(
      { where: { profile_id: playerId, match_id: replayId } });
  if (record === null || record.data_version !== historyParserVersion)
    return null;

  return record;
}

// Write a MatchProfile record extracted from a MatchHistoryEntry.
export async function writeHistoryEntry(
    entry : MatchHistoryEntry, profile : PlayerProfile) {
  await MatchProfileModel.upsert({
    profile_id: entry.playerId,
    match_id: entry.replayId,
    played_at: entry.time,
    data: matchMetadataFromHistoryEntry(entry, profile),
    player_data: personalMatchMetadataFromHistoryEntry(entry),
    data_version: historyParserVersion,
  });
}

// Read metadata for all the matches associated with a profile.
export async function readProfileMatchMetadata(playerId : string)
    : Promise<MatchProfileData[]> {
  const records = await MatchProfileModel.findAll(
    { where: { profile_id: playerId }});

  return records.filter(
      (record) => record.data_version === historyParserVersion);
}