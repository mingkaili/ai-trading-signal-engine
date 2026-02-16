const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');

const knex = require('knex');

const migrationPath = require.resolve('./20260216_initial_schema');
const migrationsDir = path.dirname(migrationPath);

function getDatabaseUrl() {
  return process.env.DATABASE_URL_TEST || '';
}

function parseConnection(urlString) {
  const url = new URL(urlString);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname ? url.pathname.replace(/^\//, '') : '',
  };
}

async function ensureSchemaTables(db, schemaName) {
  const rows = await db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: schemaName });
  return new Set(rows.map((row) => row.table_name));
}

async function ensureColumn(db, schemaName, tableName, columnName) {
  const rows = await db('information_schema.columns')
    .select('column_name')
    .where({
      table_schema: schemaName,
      table_name: tableName,
      column_name: columnName,
    });
  return rows.length > 0;
}

async function run() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.log('Skipping integration test: DATABASE_URL_TEST not set.');
    return;
  }

  const baseConnection = parseConnection(databaseUrl);
  const tempDbName = `test_schema_${crypto.randomUUID().replace(/-/g, '')}`;

  const adminDb = knex({
    client: 'mysql2',
    connection: {
      host: baseConnection.host,
      port: baseConnection.port,
      user: baseConnection.user,
      password: baseConnection.password,
    },
  });

  try {
    await adminDb.raw(`CREATE DATABASE \`${tempDbName}\``);
    const testDb = knex({
      client: 'mysql2',
      connection: {
        host: baseConnection.host,
        port: baseConnection.port,
        user: baseConnection.user,
        password: baseConnection.password,
        database: tempDbName,
      },
      migrations: {
        directory: migrationsDir,
      },
    });

    try {
      const [batch, log] = await testDb.migrate.latest();
      assert.ok(batch >= 1, 'Expected at least one migration batch');
      assert.ok(log.length >= 1, 'Expected at least one migration file applied');

      const tables = await ensureSchemaTables(testDb, tempDbName);
      const expectedTables = [
        'sectors',
        'sector_members',
        'universe',
        'price_bars_daily',
        'indicators_daily',
        'sector_metrics_weekly',
        'ai_documents',
        'ai_scores',
        'signals',
        'paper_positions',
        'paper_orders',
        'portfolio_settings',
      ];
      for (const tableName of expectedTables) {
        assert.ok(tables.has(tableName), `Missing table: ${tableName}`);
      }

      assert.ok(await ensureColumn(testDb, tempDbName, 'sectors', 'benchmark_etf'));
      assert.ok(await ensureColumn(testDb, tempDbName, 'signals', 'signal_type'));
      assert.ok(await ensureColumn(testDb, tempDbName, 'portfolio_settings', 'equity_usd'));
    } finally {
      await testDb.destroy();
    }
  } finally {
    await adminDb.raw(`DROP DATABASE IF EXISTS \`${tempDbName}\``);
    await adminDb.destroy();
  }
}

run()
  .then(() => {
    console.log('Migration integration test completed.');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
