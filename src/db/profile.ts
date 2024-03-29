import * as Sequelize from 'sequelize';

import { PlayerProfile, profileParserVersion } from '../scraper/player_profile';

import { sequelize } from './connection';
import { MatchProfileModel } from './match_profile';

// Sequelize service object.
export interface ProfileData {
  id : string,
  name : string,
  region : string,
  data : PlayerProfile,
  data_version : string,
}

// Sequelize service object.
interface ProfileInstance extends Sequelize.Instance<ProfileData>, ProfileData {
}

// Sequelize model for PlayerProfile.
export const ProfileModel = sequelize.define<ProfileInstance, ProfileData>(
    'profile', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  name: Sequelize.STRING,
  region: Sequelize.STRING,
  data: Sequelize.JSON,
  data_version: Sequelize.STRING,
}, {
  createdAt: false,
  updatedAt: 'updated_at',
});

ProfileModel.hasMany(MatchProfileModel, { foreignKey: 'profile_id' });

// Create or update a profile in the database cache.
export async function writeProfile(profile : PlayerProfile) {
  await ProfileModel.upsert({
    id: profile.playerId,
    name: profile.playerName,
    region: profile.playerRegion,

    data: profile,
    data_version: profileParserVersion,
  });
}

// Fetch a profile from the database cache.
export async function readProfile(playerId : string)
    : Promise<PlayerProfile | null> {
  const record = await ProfileModel.findById(playerId);
  if (record === null || record.data_version !== profileParserVersion)
    return null;

  return record.data;
}

// Fetch a bunch of profiles from the database cache.
//
// If the cache does not contain all the requested data, returns the subset of
// the requested profiles that do exist.
export async function readProfiles(playerIds : string[])
    : Promise<PlayerProfile[]> {
  const records = await ProfileModel.findAll({ where: {
    id: { [Sequelize.Op.in]: playerIds },
  }});

  return records.
      filter((record) => record.data_version === profileParserVersion).
      map((record) => record.data);
}

// Fetch a page of profiles from the database cache.
//
// This can be used to iterate over the entire database cache. pageStart should
// be the empty string for the first call. Future calls should use nextPageStart
// as the pageStart value. When nextPageStart is null, the iteration has
// completed.
//
// Each call might return fewer than pageSize results due to internal filtering.
export async function readProfilesPaged(pageStart : string, pageSize : number)
    : Promise<{ data: PlayerProfile[], nextPageStart: string | null }> {
  const records = await ProfileModel.findAll({
    where: { id: { [Sequelize.Op.gt]: pageStart } },
    order: [ 'id' ], limit: pageSize,
  });

  const resultSize = records.length;
  const nextPageStart = (resultSize < pageSize) ?
      null : records[resultSize - 1].id;

  const data = records.
      filter((record) => record.data_version === profileParserVersion).
      map((record) => record.data);

  return { data: data, nextPageStart: nextPageStart };
}