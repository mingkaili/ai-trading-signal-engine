import 'dotenv/config';
import type { Knex } from 'knex';

type Env = 'development' | 'test' | 'production';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

const sharedConfig: Knex.Config = {
  client: 'mysql2',
  migrations: {
    directory: 'libs/db/migrations',
    extension: 'ts',
  },
};

const config: Record<Env, Knex.Config> = {
  development: {
    ...sharedConfig,
    connection: requiredEnv('DATABASE_URL'),
  },
  test: {
    ...sharedConfig,
    connection: requiredEnv('DATABASE_URL'),
  },
  production: {
    ...sharedConfig,
    connection: requiredEnv('DATABASE_URL'),
  },
};

export default config;
