require('dotenv').config();

const sharedConfig = {
  client: 'mysql2',
  migrations: {
    directory: 'libs/db/migrations',
  },
};

module.exports = {
  development: {
    ...sharedConfig,
    connection: process.env.DATABASE_URL,
  },
  test: {
    ...sharedConfig,
    connection: process.env.DATABASE_URL,
  },
  production: {
    ...sharedConfig,
    connection: process.env.DATABASE_URL,
  },
};
