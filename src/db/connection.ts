import * as Sequelize from 'sequelize';

// TODO: Pick this up from the environment's DATABASE_URL.
const databaseUrl = 'postgres://localhost/hurros';

export const sequelize = new Sequelize(databaseUrl, { native: true });
