import * as Sequelize from 'sequelize';

import { PlayerProfile, profileParserVersion } from '../scraper/player_profile';

import { sequelize } from './connection';

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
const Profile = sequelize.define<ProfileInstance, ProfileData>('profile', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  name: Sequelize.STRING,
  region: Sequelize.STRING,
  data: Sequelize.JSON,
  data_version: Sequelize.STRING,
}, {
  createdAt: 'created_at',
  updatedAt: false,
});

// Creates or updates a profile in the database cache.
export async function writeProfile(profile : PlayerProfile) {
  await Profile.upsert({
    id: profile.playerId,
    name: profile.playerName,
    region: profile.playerRegion,

    data: profile,
    data_version: profileParserVersion,
  });
}

// Fetches a profile from the database cache.
export async function readProfile(playerId : string)
    : Promise<PlayerProfile | null> {
  const record = await Profile.findById(playerId);
  if (record === null || record.data_version !== profileParserVersion)
    return null;

  return record.data;
}
