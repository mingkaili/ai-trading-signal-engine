import knex, { type Knex } from 'knex';

let cachedDb: Knex | null = null;

export type DbConfig = {
  connectionString: string;
  pool?: {
    min?: number;
    max?: number;
  };
};

function buildConfig(config: DbConfig): Knex.Config {
  return {
    client: 'mysql2',
    connection: config.connectionString,
    pool: config.pool,
    migrations: {
      directory: 'libs/db/migrations',
    },
  };
}

export function getDb(config?: DbConfig): Knex {
  if (cachedDb) return cachedDb;
  if (!config?.connectionString) {
    throw new Error('DB connection string is required');
  }
  cachedDb = knex(buildConfig(config));
  return cachedDb;
}
