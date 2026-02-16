require('dotenv').config();

const knex = require('knex');
const config = require('./knexfile');

async function runMigrations() {
  const env = process.env.NODE_ENV || 'development';
  const db = knex(config[env]);

  try {
    await db.migrate.latest();
    // eslint-disable-next-line no-console
    console.log('Migrations complete');
  } finally {
    await db.destroy();
  }
}

runMigrations().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
