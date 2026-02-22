import express from 'express';
import dotenv from 'dotenv';
import https from 'node:https';
import knex, { type Knex } from 'knex';

dotenv.config({ path: `${__dirname}/../.env` });

type DailyIngestRequest = {
  asOfDate: string;
  symbols: string[];
  force?: boolean;
};

type ComputeIndicatorsRequest = {
  asOfDate: string;
  symbols: string[];
  lookbackDays?: number;
};

type WeeklySectorRankRequest = {
  weekEndDate: string;
  benchmark: string;
  topN?: number;
};

type DailyIngestResult = {
  asOfDate: string;
  symbolsProcessed: number;
  barsUpserted: number;
};

type ComputeIndicatorsResult = {
  asOfDate: string;
  indicatorsUpserted: number;
};

type WeeklySectorRankResult = {
  weekEndDate: string;
  sectorsRanked: number;
  topSectors: Array<{
    sector: string;
    rank: number;
    rel_strength_5d: number;
  }>;
};

type RouteHandlers = {
  dailyIngest: (payload: DailyIngestRequest) => Promise<DailyIngestResult>;
  computeIndicators: (payload: ComputeIndicatorsRequest) => Promise<ComputeIndicatorsResult>;
  weeklySectorRank: (payload: WeeklySectorRankRequest) => Promise<WeeklySectorRankResult>;
};

type PriceBar = {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type IndicatorRow = {
  symbol: string;
  date: string;
  ema21: number;
  ema50: number;
  ema200: number;
  atr_pct: number;
  rs_vs_spy: number;
  rs_slope_10d: number;
  volume_z: number;
  dollar_vol: number;
};

type SectorMetricRow = {
  sector_id: string;
  week_end_date: string;
  etf_symbol: string;
  bench_symbol: string;
  etf_5d_return: number;
  bench_5d_return: number;
  rel_strength_5d: number;
  etf_dollar_vol_z: number;
  breadth_above_ema21: number;
  rank: number;
};

type DbConfig = {
  connectionString: string;
  pool?: {
    min?: number;
    max?: number;
  };
};

let cachedDb: Knex | null = null;

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

function getDb(config?: DbConfig): Knex {
  if (cachedDb) return cachedDb;
  if (!config?.connectionString) {
    throw new Error('DB connection string is required');
  }
  cachedDb = knex(buildConfig(config));
  return cachedDb;
}

type SymbolRow = {
  symbol: string;
};

type PriceBarRow = {
  symbol: string;
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type IndicatorValueRow = {
  symbol: string;
  ema21: number;
};

type CloseRow = {
  symbol: string;
  close: number;
};

type SectorRow = {
  id: string;
  name: string;
  benchmark_etf: string;
};

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function ensureStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array of strings`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new Error(`${field} must contain only non-empty strings`);
    }
  }
  return value;
}

function parseDailyIngest(body: unknown): DailyIngestRequest {
  const payload = body as Record<string, unknown>;
  return {
    asOfDate: ensureString(payload.asOfDate, 'asOfDate'),
    symbols: ensureStringArray(payload.symbols, 'symbols'),
    force: payload.force === true,
  };
}

function parseComputeIndicators(body: unknown): ComputeIndicatorsRequest {
  const payload = body as Record<string, unknown>;
  const lookbackDays =
    typeof payload.lookbackDays === 'number' && payload.lookbackDays > 0
      ? payload.lookbackDays
      : undefined;
  return {
    asOfDate: ensureString(payload.asOfDate, 'asOfDate'),
    symbols: ensureStringArray(payload.symbols, 'symbols'),
    lookbackDays,
  };
}

function parseWeeklySectorRank(body: unknown): WeeklySectorRankRequest {
  const payload = body as Record<string, unknown>;
  const topN = typeof payload.topN === 'number' && payload.topN > 0 ? payload.topN : undefined;
  return {
    weekEndDate: ensureString(payload.weekEndDate, 'weekEndDate'),
    benchmark: ensureString(payload.benchmark, 'benchmark'),
    topN,
  };
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  return connectionString;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  throw new Error('Invalid date value');
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          reject(new Error(`HTTP ${status} from ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

function buildStooqUrl(symbol: string): string {
  const baseUrl = process.env.MARKET_DATA_STOOQ_BASE_URL ?? 'https://stooq.com/q/d/l/';
  const normalizedSymbol = `${symbol.toLowerCase()}.us`;
  return `${baseUrl}?s=${encodeURIComponent(normalizedSymbol)}&i=d`;
}

function parseStooqCsv(symbol: string, csv: string): PriceBar[] {
  const lines = csv.trim().split('\n');
  if (lines.length <= 1) return [];
  const rows: PriceBar[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const [date, open, high, low, close, volume] = lines[i].split(',');
    if (!date || !open || !high || !low || !close || !volume) continue;
    const parsed = {
      symbol,
      date: date.trim(),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    };
    if (!Number.isFinite(parsed.open) || !Number.isFinite(parsed.close)) continue;
    rows.push(parsed);
  }
  return rows;
}

async function fetchDailyBars(symbol: string): Promise<PriceBar[]> {
  const csv = await fetchText(buildStooqUrl(symbol));
  return parseStooqCsv(symbol, csv);
}

function pickBarForDate(bars: PriceBar[], asOfDate: string): PriceBar | null {
  for (const bar of bars) {
    if (bar.date === asOfDate) return bar;
  }
  return null;
}

async function getExistingBars(
  db: Knex,
  asOfDate: string,
  symbols: string[],
): Promise<Set<string>> {
  if (symbols.length === 0) return new Set();
  const rows = await db<SymbolRow>('price_bars_daily')
    .select('symbol')
    .where('date', asOfDate)
    .whereIn('symbol', symbols);
  return new Set(rows.map((row) => row.symbol));
}

async function upsertPriceBars(db: Knex, bars: PriceBar[]): Promise<number> {
  if (bars.length === 0) return 0;
  const rows = bars.map((bar) => ({
    symbol: bar.symbol,
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
  await db('price_bars_daily').insert(rows).onConflict(['symbol', 'date']).merge();
  return rows.length;
}

async function loadBarsForSymbol(
  db: Knex,
  symbol: string,
  endDate: string,
  limit: number,
): Promise<PriceBar[]> {
  const rows = await db<PriceBarRow>('price_bars_daily')
    .select('symbol', 'date', 'open', 'high', 'low', 'close', 'volume')
    .where('symbol', symbol)
    .andWhere('date', '<=', endDate)
    .orderBy('date', 'desc')
    .limit(limit);
  const bars = rows.map((row) => ({
    symbol: row.symbol as string,
    date: normalizeDate(row.date),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  }));
  bars.reverse();
  return bars;
}

function computeEma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < values.length; i += 1) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeAtrPct(bars: PriceBar[], period: number): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const current = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const recent = trs.slice(-period);
  const atr = recent.reduce((sum, value) => sum + value, 0) / period;
  const lastClose = bars[bars.length - 1].close;
  return lastClose === 0 ? null : atr / lastClose;
}

function computeZScore(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  const latest = values[values.length - 1];
  return (latest - mean) / std;
}

function computeSlope(values: number[]): number | null {
  if (values.length < 2) return null;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
}

async function computeIndicatorsForSymbol(
  db: Knex,
  symbol: string,
  asOfDate: string,
  lookbackDays: number,
  spyCloseByDate: Map<string, number>,
): Promise<IndicatorRow | null> {
  const bars = await loadBarsForSymbol(db, symbol, asOfDate, lookbackDays);
  return computeIndicatorsFromBars(symbol, asOfDate, bars, spyCloseByDate);
}

function computeIndicatorsFromBars(
  symbol: string,
  asOfDate: string,
  bars: PriceBar[],
  spyCloseByDate: Map<string, number>,
): IndicatorRow | null {
  if (bars.length === 0) return null;
  const lastBar = bars[bars.length - 1];
  if (lastBar.date !== asOfDate) return null;

  const closes = bars.map((bar) => bar.close);
  const ema21 = computeEma(closes, 21);
  const ema50 = computeEma(closes, 50);
  const ema200 = computeEma(closes, 200);
  const atrPct = computeAtrPct(bars, 14);
  if (ema21 === null || ema50 === null || ema200 === null || atrPct === null) {
    return null;
  }

  const spyClose = spyCloseByDate.get(asOfDate);
  if (!spyClose) return null;
  const rsVsSpy = spyClose === 0 ? null : lastBar.close / spyClose;
  if (rsVsSpy === null) return null;

  const rsSeries: number[] = [];
  for (const bar of bars) {
    const benchClose = spyCloseByDate.get(bar.date);
    if (benchClose && benchClose !== 0) {
      rsSeries.push(bar.close / benchClose);
    }
  }
  const rsSlope10d = computeSlope(rsSeries.slice(-10));
  if (rsSlope10d === null) return null;

  const volumeZ = computeZScore(bars.slice(-60).map((bar) => bar.volume));
  if (volumeZ === null) return null;

  const dollarVol = lastBar.close * lastBar.volume;

  return {
    symbol,
    date: asOfDate,
    ema21,
    ema50,
    ema200,
    atr_pct: atrPct,
    rs_vs_spy: rsVsSpy,
    rs_slope_10d: rsSlope10d,
    volume_z: volumeZ,
    dollar_vol: dollarVol,
  };
}

async function upsertIndicators(db: Knex, rows: IndicatorRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db('indicators_daily').insert(rows).onConflict(['symbol', 'date']).merge();
  return rows.length;
}

async function computeWeeklySectorMetrics(
  db: Knex,
  weekEndDate: string,
  benchmark: string,
): Promise<{ rows: SectorMetricRow[]; sectorNameById: Map<string, string> }> {
  const sectors = await db<SectorRow>('sectors')
    .select('id', 'name', 'benchmark_etf')
    .where('enabled', true);
  if (sectors.length === 0) return { rows: [], sectorNameById: new Map() };

  const metrics: SectorMetricRow[] = [];
  const sectorNameById = new Map<string, string>();
  for (const sector of sectors) {
    const sectorId = sector.id as string;
    const sectorName = sector.name as string;
    const etfSymbol = sector.benchmark_etf as string;
    if (!etfSymbol) continue;
    sectorNameById.set(sectorId, sectorName);

    const etfBars = await loadBarsForSymbol(db, etfSymbol, weekEndDate, 60);
    const benchBars = await loadBarsForSymbol(db, benchmark, weekEndDate, 60);
    const members = await db<SymbolRow>('sector_members')
      .select('symbol')
      .where('sector_id', sectorId)
      .andWhere('enabled', true);
    const memberSymbols = members.map((row) => row.symbol);
    let indicatorRows: IndicatorValueRow[] = [];
    let priceRows: CloseRow[] = [];
    if (memberSymbols.length > 0) {
      [indicatorRows, priceRows] = await Promise.all([
        db<IndicatorValueRow>('indicators_daily')
          .select('symbol', 'ema21')
          .where('date', weekEndDate)
          .whereIn('symbol', memberSymbols),
        db<CloseRow>('price_bars_daily')
          .select('symbol', 'close')
          .where('date', weekEndDate)
          .whereIn('symbol', memberSymbols),
      ]);
    }

    const metric = computeSectorMetric({
      sectorId,
      etfSymbol,
      benchmark,
      weekEndDate,
      etfBars,
      benchBars,
      memberSymbols,
      indicatorRows,
      priceRows,
    });
    if (metric) metrics.push(metric);
  }

  return { rows: rankSectorMetrics(metrics), sectorNameById };
}

function computeSectorMetric(params: {
  sectorId: string;
  etfSymbol: string;
  benchmark: string;
  weekEndDate: string;
  etfBars: PriceBar[];
  benchBars: PriceBar[];
  memberSymbols: string[];
  indicatorRows: IndicatorValueRow[];
  priceRows: CloseRow[];
}): SectorMetricRow | null {
  const {
    sectorId,
    etfSymbol,
    benchmark,
    weekEndDate,
    etfBars,
    benchBars,
    memberSymbols,
    indicatorRows,
    priceRows,
  } = params;
  if (etfBars.length < 6 || benchBars.length < 6) return null;

  const etfReturn = etfBars[etfBars.length - 1].close / etfBars[etfBars.length - 6].close - 1;
  const benchReturn =
    benchBars[benchBars.length - 1].close / benchBars[benchBars.length - 6].close - 1;
  const relStrength = etfReturn - benchReturn;

  const etfDollarVolZ = computeZScore(etfBars.map((bar) => bar.close * bar.volume).slice(-60));
  if (etfDollarVolZ === null) return null;

  let breadth = 0;
  if (memberSymbols.length > 0) {
    const emaBySymbol = new Map<string, number>(
      indicatorRows.map((row) => [row.symbol, Number(row.ema21)]),
    );
    const closeBySymbol = new Map<string, number>(
      priceRows.map((row) => [row.symbol, Number(row.close)]),
    );
    let above = 0;
    let total = 0;
    for (const symbol of memberSymbols) {
      const ema = emaBySymbol.get(symbol);
      const close = closeBySymbol.get(symbol);
      if (ema === undefined || close === undefined) continue;
      total += 1;
      if (close > ema) above += 1;
    }
    breadth = total === 0 ? 0 : above / total;
  }

  return {
    sector_id: sectorId,
    week_end_date: weekEndDate,
    etf_symbol: etfSymbol,
    bench_symbol: benchmark,
    etf_5d_return: etfReturn,
    bench_5d_return: benchReturn,
    rel_strength_5d: relStrength,
    etf_dollar_vol_z: etfDollarVolZ,
    breadth_above_ema21: breadth,
    rank: 0,
  };
}

function rankSectorMetrics(metrics: SectorMetricRow[]): SectorMetricRow[] {
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;
  const scored = metrics
    .map((metric) => ({
      metric,
      score:
        w1 * metric.rel_strength_5d +
        w2 * metric.breadth_above_ema21 +
        w3 * metric.etf_dollar_vol_z,
    }))
    .sort((a, b) => b.score - a.score);
  scored.forEach((item, index) => {
    item.metric.rank = index + 1;
  });
  return scored.map((item) => item.metric);
}

async function upsertSectorMetrics(db: Knex, rows: SectorMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db('sector_metrics_weekly')
    .insert(rows)
    .onConflict(['sector_id', 'week_end_date'])
    .merge();
  return rows.length;
}

const defaultHandlers: RouteHandlers = {
  dailyIngest: async (payload) => {
    const db = getDb({ connectionString: getConnectionString() });

    const uniqueSymbols = Array.from(new Set(payload.symbols.map((symbol) => symbol.toUpperCase())));
    const existing = payload.force
      ? new Set<string>()
      : await getExistingBars(db, payload.asOfDate, uniqueSymbols);
    const symbolsToFetch = uniqueSymbols.filter((symbol) => !existing.has(symbol));

    const fetchedBars: PriceBar[] = [];
    for (const symbol of symbolsToFetch) {
      const bars = await fetchDailyBars(symbol);
      const bar = pickBarForDate(bars, payload.asOfDate);
      if (bar) {
        fetchedBars.push(bar);
      }
    }

    const barsUpserted = await upsertPriceBars(db, fetchedBars);
    return {
      asOfDate: payload.asOfDate,
      symbolsProcessed: uniqueSymbols.length,
      barsUpserted,
    };
  },
  computeIndicators: async (payload) => {
    const db = getDb({ connectionString: getConnectionString() });

    const uniqueSymbols = Array.from(new Set(payload.symbols.map((symbol) => symbol.toUpperCase())));
    const lookbackDays = payload.lookbackDays ?? 260;
    const spyBars = await loadBarsForSymbol(db, 'SPY', payload.asOfDate, lookbackDays);
    const spyCloseByDate = new Map(spyBars.map((bar) => [bar.date, bar.close]));

    const indicatorRows: IndicatorRow[] = [];
    for (const symbol of uniqueSymbols) {
      const row = await computeIndicatorsForSymbol(
        db,
        symbol,
        payload.asOfDate,
        lookbackDays,
        spyCloseByDate,
      );
      if (row) indicatorRows.push(row);
    }

    const indicatorsUpserted = await upsertIndicators(db, indicatorRows);
    return {
      asOfDate: payload.asOfDate,
      indicatorsUpserted,
    };
  },
  weeklySectorRank: async (payload) => {
    const db = getDb({ connectionString: getConnectionString() });

    const { rows: metrics, sectorNameById } = await computeWeeklySectorMetrics(
      db,
      payload.weekEndDate,
      payload.benchmark,
    );
    const sectorsRanked = await upsertSectorMetrics(db, metrics);
    const topSectors = metrics
      .sort((a, b) => a.rank - b.rank)
      .slice(0, payload.topN ?? 2)
      .map((metric) => ({
        sector: sectorNameById.get(metric.sector_id) ?? metric.sector_id,
        rank: metric.rank,
        rel_strength_5d: metric.rel_strength_5d,
      }));

    return {
      weekEndDate: payload.weekEndDate,
      sectorsRanked,
      topSectors,
    };
  },
};

export function createApp(handlers: RouteHandlers = defaultHandlers): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/jobs/daily-ingest', async (req, res) => {
    try {
      const payload = parseDailyIngest(req.body);
      const data = await handlers.dailyIngest(payload);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: (error as Error).message,
      });
    }
  });

  app.post('/api/jobs/compute-indicators', async (req, res) => {
    try {
      const payload = parseComputeIndicators(req.body);
      const data = await handlers.computeIndicators(payload);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: (error as Error).message,
      });
    }
  });

  app.post('/api/jobs/weekly-sector-rank', async (req, res) => {
    try {
      const payload = parseWeeklySectorRank(req.body);
      const data = await handlers.weeklySectorRank(payload);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: (error as Error).message,
      });
    }
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.MARKET_DATA_PORT ?? process.env.PORT ?? 3001);
  const app = createApp();
  app.listen(port, () => {
    console.log(`market-data-service listening on port ${port}`);
  });
}

export const __test__ = {
  ensureString,
  ensureStringArray,
  parseDailyIngest,
  parseComputeIndicators,
  parseWeeklySectorRank,
  normalizeDate,
  buildStooqUrl,
  parseStooqCsv,
  pickBarForDate,
  computeEma,
  computeAtrPct,
  computeZScore,
  computeSlope,
  computeIndicatorsFromBars,
  computeSectorMetric,
  rankSectorMetrics,
};
