import * as Sequelize from 'sequelize';

// TODO: Pick this up from the environment's DATABASE_URL.
const databaseUrl = 'postgres://localhost/hurros';

export const sequelize = new Sequelize(databaseUrl, {
  native: true, logging: false,
  pool: { max: 10, min: 2, acquire: 24 * 60 * 60 * 1000 },
});
