import * as Sequelize from 'sequelize';

import { sequelize } from './connection';

interface JsonBag {
  [propertyName : string] : (number | string | boolean | null);
}

// Sequelize service object.
export interface JobData {
  id : string,
  data : JsonBag,
  data_version : string,
}

// Sequelize service object.
interface JobInstance extends Sequelize.Instance<JobData>, JobData {
}

// Sequelize model for JsonBag.
const Job = sequelize.define<JobInstance, JobData>('job', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  data: Sequelize.JSON,
  data_version: Sequelize.STRING,
}, {
  createdAt: false,
  updatedAt: false,
});

// Creates or updates a profile in the database cache.
export async function writeJob(
    namespace : string, entityId : string, dataVersion : string,
    data : JsonBag) {
  const jobKey = `${namespace}.${entityId}`;
  await Job.upsert({
    id: jobKey,
    data: data,
    data_version: dataVersion,
  });
}

// Fetches a profile from the database cache.
export async function readJob(
    namespace : string, entityId : string, dataVersion : string)
    : Promise<JsonBag | null> {
  const jobKey = `${namespace}.${entityId}`;
  const record = await Job.findById(jobKey);
  if (record === null || record.data_version !== dataVersion)
    return null;

  return record.data;
}
