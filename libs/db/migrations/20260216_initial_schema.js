const TABLES = [
  'paper_orders',
  'paper_positions',
  'signals',
  'ai_scores',
  'ai_documents',
  'sector_metrics_weekly',
  'indicators_daily',
  'price_bars_daily',
  'universe',
  'sector_members',
  'sectors',
  'portfolio_settings',
];

exports.up = async function up(knex) {
  await knex.schema.createTable('sectors', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable().unique();
    table.string('benchmark_etf').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sector_members', (table) => {
    table.uuid('sector_id').notNullable().references('id').inTable('sectors').onDelete('CASCADE');
    table.string('symbol').notNullable();
    table.enu('source', ['manual', 'etf_holdings', 'classifier']).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['sector_id', 'symbol']);
  });

  await knex.schema.createTable('universe', (table) => {
    table.string('symbol').primary();
    table.enu('type', ['stock', 'etf']).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.json('meta_json');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('price_bars_daily', (table) => {
    table.string('symbol').notNullable();
    table.date('date').notNullable();
    table.decimal('open', 18, 6).notNullable();
    table.decimal('high', 18, 6).notNullable();
    table.decimal('low', 18, 6).notNullable();
    table.decimal('close', 18, 6).notNullable();
    table.bigInteger('volume').notNullable();
    table.primary(['symbol', 'date']);
    table.index(['symbol', 'date']);
    table.index(['date']);
  });

  await knex.schema.createTable('indicators_daily', (table) => {
    table.string('symbol').notNullable();
    table.date('date').notNullable();
    table.decimal('ema21', 18, 6).notNullable();
    table.decimal('ema50', 18, 6).notNullable();
    table.decimal('ema200', 18, 6).notNullable();
    table.decimal('atr_pct', 18, 6).notNullable();
    table.decimal('rs_vs_spy', 18, 6).notNullable();
    table.decimal('rs_slope_10d', 18, 6).notNullable();
    table.decimal('volume_z', 18, 6).notNullable();
    table.decimal('dollar_vol', 18, 6).notNullable();
    table.primary(['symbol', 'date']);
    table.index(['symbol', 'date']);
    table.index(['date']);
  });

  await knex.schema.createTable('sector_metrics_weekly', (table) => {
    table.uuid('sector_id').notNullable().references('id').inTable('sectors').onDelete('CASCADE');
    table.date('week_end_date').notNullable();
    table.string('etf_symbol').notNullable();
    table.string('bench_symbol').notNullable();
    table.decimal('etf_5d_return', 18, 6).notNullable();
    table.decimal('bench_5d_return', 18, 6).notNullable();
    table.decimal('rel_strength_5d', 18, 6).notNullable();
    table.decimal('etf_dollar_vol_z', 18, 6).notNullable();
    table.decimal('breadth_above_ema21', 18, 6).notNullable();
    table.integer('rank').notNullable();
    table.primary(['sector_id', 'week_end_date']);
  });

  await knex.schema.createTable('ai_documents', (table) => {
    table.uuid('id').primary();
    table.string('symbol').notNullable();
    table.enu('doc_type', ['earnings', 'news_batch', 'manual']).notNullable();
    table.timestamp('published_at').notNullable();
    table.string('raw_text_hash').notNullable();
    table.text('raw_text').notNullable();
    table.json('source_meta_json').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['symbol', 'doc_type', 'published_at']);
    table.unique(['raw_text_hash']);
  });

  await knex.schema.createTable('ai_scores', (table) => {
    table.uuid('id').primary();
    table
      .uuid('ai_document_id')
      .notNullable()
      .references('id')
      .inTable('ai_documents')
      .onDelete('CASCADE');
    table.string('symbol').notNullable();
    table.enu('score_type', ['acceleration']).notNullable();
    table.json('json_result').notNullable();
    table.string('growth_phase').notNullable();
    table.integer('conviction').notNullable();
    table.string('hype_risk').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['symbol', 'created_at']);
    table.index(['ai_document_id']);
  });

  await knex.schema.createTable('signals', (table) => {
    table.uuid('id').primary();
    table.string('symbol').notNullable();
    table.enu('signal_type', ['BUY', 'WATCH', 'SELL', 'ADD', 'TRIM']).notNullable();
    table.json('reason_json').notNullable();
    table.integer('confidence');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('sent_at');
    table.index(['created_at']);
    table.index(['symbol', 'created_at']);
  });

  await knex.schema.createTable('paper_positions', (table) => {
    table.string('symbol').primary();
    table.enu('state', ['open', 'closed']).notNullable();
    table.integer('shares').notNullable();
    table.decimal('avg_entry', 18, 6).notNullable();
    table.decimal('stop_price', 18, 6).notNullable();
    table.timestamp('opened_at').notNullable();
    table.timestamp('closed_at');
    table.decimal('last_mark_price', 18, 6);
    table.json('pnl_json');
  });

  await knex.schema.createTable('paper_orders', (table) => {
    table.uuid('id').primary();
    table.string('symbol').notNullable();
    table.enu('side', ['buy', 'sell']).notNullable();
    table.enu('order_type', ['market']).notNullable();
    table.integer('shares').notNullable();
    table.enu('requested_fill_rule', ['close', 'next_open']).notNullable();
    table.decimal('requested_price', 18, 6);
    table.decimal('filled_price', 18, 6);
    table.enu('status', ['created', 'filled', 'cancelled']).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('filled_at');
  });

  await knex.schema.createTable('portfolio_settings', (table) => {
    table.decimal('equity_usd', 18, 6).notNullable();
    table.decimal('risk_per_trade_pct', 18, 6).notNullable().defaultTo(0.01);
    table.decimal('max_position_pct', 18, 6).notNullable().defaultTo(0.2);
    table.enu('entry_fill_rule', ['close']).notNullable().defaultTo('close');
    table
      .enu('stop_rule', ['pct_12', 'ema21_3close', 'ema21_minus_atr'])
      .notNullable()
      .defaultTo('pct_12');
    table.integer('inflow_sector_top_n').notNullable().defaultTo(2);
    table.boolean('require_ai_for_buy').notNullable().defaultTo(true);
    table.boolean('add_rule_enabled').notNullable().defaultTo(true);
    table.boolean('trim_rule_enabled').notNullable().defaultTo(true);
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  for (const tableName of TABLES) {
    await knex.schema.dropTableIfExists(tableName);
  }
};
