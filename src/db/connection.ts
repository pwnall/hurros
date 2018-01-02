import * as Sequelize from 'sequelize';

// TODO: Pick this up from the environment's DATABASE_URL.
const databaseUrl = 'postgres://localhost/hurros';

export const sequelize = new Sequelize(databaseUrl, {
  operatorsAliases: false,  // Disables an old feature with security problems.
  native: true,  // Passed to the pg module, so it can use pg-native.
  logging: false,  // Database logging creates a lot of noise.
  pool: {
    max: 6,  // More I/O concurrency costs more RAM.
    min: 2,  // Not sure this is relevant, we always keep the DB busy.
    acquire: 24 * 60 * 60 * 1000,  // Avoid timeouts during brief DB floods.
  },
});
