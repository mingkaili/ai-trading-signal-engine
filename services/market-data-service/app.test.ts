import assert from 'node:assert/strict';

import request from 'supertest';

import { __test__, createApp } from './app';

async function runTests(): Promise<void> {
  const approxEqual = (value: number, expected: number, epsilon = 1e-6) => {
    assert.ok(Math.abs(value - expected) <= epsilon, `${value} ≈ ${expected}`);
  };

  assert.equal(__test__.ensureString('SPY', 'symbol'), 'SPY');
  assert.throws(() => __test__.ensureString('', 'symbol'));
  assert.deepEqual(__test__.ensureStringArray(['SPY', 'QQQ'], 'symbols'), ['SPY', 'QQQ']);
  assert.throws(() => __test__.ensureStringArray([], 'symbols'));

  assert.deepEqual(__test__.parseDailyIngest({ asOfDate: '2026-02-13', symbols: ['SPY'] }), {
    asOfDate: '2026-02-13',
    symbols: ['SPY'],
    force: false,
  });
  assert.deepEqual(
    __test__.parseComputeIndicators({
      asOfDate: '2026-02-13',
      symbols: ['SPY'],
      lookbackDays: 120,
    }),
    { asOfDate: '2026-02-13', symbols: ['SPY'], lookbackDays: 120 },
  );
  assert.deepEqual(
    __test__.parseComputeIndicators({
      asOfDate: '2026-02-13',
      symbols: ['SPY'],
      lookbackDays: -5,
    }),
    { asOfDate: '2026-02-13', symbols: ['SPY'], lookbackDays: undefined },
  );
  assert.deepEqual(
    __test__.parseWeeklySectorRank({ weekEndDate: '2026-02-13', benchmark: 'SPY', topN: 3 }),
    { weekEndDate: '2026-02-13', benchmark: 'SPY', topN: 3 },
  );

  assert.equal(__test__.normalizeDate(new Date('2026-02-13T00:00:00.000Z')), '2026-02-13');
  assert.equal(__test__.normalizeDate('2026-02-13T10:00:00.000Z'), '2026-02-13');

  process.env.MARKET_DATA_STOOQ_BASE_URL = 'https://example.com/data';
  assert.equal(
    __test__.buildStooqUrl('SPY'),
    'https://example.com/data?s=spy.us&i=d',
  );

  const csv = [
    'Date,Open,High,Low,Close,Volume',
    '2026-02-12,10,12,9,11,100',
    '2026-02-13,11,13,10,12,200',
  ].join('\n');
  const parsedBars = __test__.parseStooqCsv('SPY', csv);
  assert.equal(parsedBars.length, 2);
  assert.equal(parsedBars[1].close, 12);
  assert.equal(__test__.pickBarForDate(parsedBars, '2026-02-13')?.volume, 200);

  approxEqual(__test__.computeEma([1, 2, 3, 4, 5], 3) ?? 0, 4);
  assert.equal(__test__.computeEma([1, 2], 3), null);

  const atrBars = Array.from({ length: 15 }, (_, idx) => ({
    symbol: 'SPY',
    date: `2026-02-${String(idx + 1).padStart(2, '0')}`,
    open: 10,
    high: 11,
    low: 9,
    close: 10,
    volume: 100,
  }));
  approxEqual(__test__.computeAtrPct(atrBars, 14) ?? 0, 0.2);

  approxEqual(__test__.computeZScore([1, 2, 3, 4, 5]) ?? 0, 1.414213562, 1e-6);
  assert.equal(__test__.computeZScore([5, 5, 5]), 0);
  assert.equal(__test__.computeSlope([1, 2, 3, 4]), 1);

  const indicatorBars = Array.from({ length: 210 }, (_, idx) => {
    const close = idx + 1;
    return {
      symbol: 'QQQ',
      date: `2025-07-${String((idx % 28) + 1).padStart(2, '0')}`,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    };
  });
  indicatorBars[indicatorBars.length - 1].date = '2026-02-13';
  const spyCloseByDate = new Map(
    indicatorBars.map((bar) => [bar.date, bar.close * 2]),
  );
  const indicatorRow = __test__.computeIndicatorsFromBars(
    'QQQ',
    '2026-02-13',
    indicatorBars,
    spyCloseByDate,
  );
  assert.ok(indicatorRow);
  assert.equal(indicatorRow?.date, '2026-02-13');
  assert.equal(indicatorRow?.rs_vs_spy, 0.5);
  assert.equal(indicatorRow?.volume_z, 0);

  const etfBars = Array.from({ length: 6 }, (_, idx) => ({
    symbol: 'XLK',
    date: `2026-02-${String(idx + 1).padStart(2, '0')}`,
    open: 10,
    high: 12,
    low: 9,
    close: 10 + idx,
    volume: 100,
  }));
  const benchBars = Array.from({ length: 6 }, (_, idx) => ({
    symbol: 'SPY',
    date: `2026-02-${String(idx + 1).padStart(2, '0')}`,
    open: 10,
    high: 12,
    low: 9,
    close: 10,
    volume: 100,
  }));
  const metric = __test__.computeSectorMetric({
    sectorId: 'tech',
    etfSymbol: 'XLK',
    benchmark: 'SPY',
    weekEndDate: '2026-02-06',
    etfBars,
    benchBars,
    memberSymbols: ['AAPL', 'MSFT'],
    indicatorRows: [
      { symbol: 'AAPL', ema21: 100 },
      { symbol: 'MSFT', ema21: 100 },
    ],
    priceRows: [
      { symbol: 'AAPL', close: 120 },
      { symbol: 'MSFT', close: 80 },
    ],
  });
  assert.ok(metric);
  assert.equal(metric?.breadth_above_ema21, 0.5);

  const ranked = __test__.rankSectorMetrics([
    {
      sector_id: 'one',
      week_end_date: '2026-02-06',
      etf_symbol: 'X1',
      bench_symbol: 'SPY',
      etf_5d_return: 0.05,
      bench_5d_return: 0.01,
      rel_strength_5d: 0.04,
      etf_dollar_vol_z: 0.1,
      breadth_above_ema21: 0.2,
      rank: 0,
    },
    {
      sector_id: 'two',
      week_end_date: '2026-02-06',
      etf_symbol: 'X2',
      bench_symbol: 'SPY',
      etf_5d_return: 0.02,
      bench_5d_return: 0.01,
      rel_strength_5d: 0.01,
      etf_dollar_vol_z: 0.1,
      breadth_above_ema21: 0.9,
      rank: 0,
    },
  ]);
  assert.equal(ranked[0].sector_id, 'two');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);

  const handlers = {
    dailyIngest: async () => ({
      asOfDate: '2026-02-13',
      symbolsProcessed: 3,
      barsUpserted: 3,
    }),
    computeIndicators: async () => ({
      asOfDate: '2026-02-13',
      indicatorsUpserted: 3,
    }),
    weeklySectorRank: async () => ({
      weekEndDate: '2026-02-13',
      sectorsRanked: 1,
      topSectors: [{ sector: 'Semis', rank: 1, rel_strength_5d: 0.02 }],
    }),
  };

  const app = createApp(handlers);

  const dailyResponse = await request(app)
    .post('/api/jobs/daily-ingest')
    .send({ asOfDate: '2026-02-13', symbols: ['SPY', 'QQQ', 'SMH'], force: false });
  assert.equal(dailyResponse.status, 200);
  assert.equal(dailyResponse.body.ok, true);
  assert.equal(dailyResponse.body.data.barsUpserted, 3);

  const indicatorsResponse = await request(app)
    .post('/api/jobs/compute-indicators')
    .send({ asOfDate: '2026-02-13', symbols: ['SPY', 'QQQ', 'SMH'], lookbackDays: 260 });
  assert.equal(indicatorsResponse.status, 200);
  assert.equal(indicatorsResponse.body.ok, true);
  assert.equal(indicatorsResponse.body.data.indicatorsUpserted, 3);

  const weeklyResponse = await request(app)
    .post('/api/jobs/weekly-sector-rank')
    .send({ weekEndDate: '2026-02-13', benchmark: 'QQQ', topN: 2 });
  assert.equal(weeklyResponse.status, 200);
  assert.equal(weeklyResponse.body.ok, true);
  assert.equal(weeklyResponse.body.data.sectorsRanked, 1);

  const invalidDaily = await request(app).post('/api/jobs/daily-ingest').send({});
  assert.equal(invalidDaily.status, 400);
  assert.equal(invalidDaily.body.ok, false);

  const invalidIndicators = await request(app)
    .post('/api/jobs/compute-indicators')
    .send({ asOfDate: '2026-02-13' });
  assert.equal(invalidIndicators.status, 400);
  assert.equal(invalidIndicators.body.ok, false);

  const invalidWeekly = await request(app)
    .post('/api/jobs/weekly-sector-rank')
    .send({ weekEndDate: '2026-02-13' });
  assert.equal(invalidWeekly.status, 400);
  assert.equal(invalidWeekly.body.ok, false);
}

runTests()
  .then(() => {
    console.log('market-data-service route tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
