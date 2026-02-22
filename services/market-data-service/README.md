# Market Data Service

The market data service ingests daily OHLCV bars, computes technical indicators, and produces
weekly sector ranking metrics used by the signal engine.

## Responsibilities
- Fetch daily OHLCV and upsert into `price_bars_daily`.
- Compute indicators and upsert into `indicators_daily`.
- Compute weekly sector metrics and upsert into `sector_metrics_weekly`.

## Environment
Create `services/market-data-service/.env` from `.envsample`:
- `DATABASE_URL` MySQL connection string.
- `MARKET_DATA_PORT` service port (default 3001).
- `MARKET_DATA_STOOQ_BASE_URL` Stooq CSV endpoint (default included in sample).

## Run (Bazel)
```
bazel run //services/market-data-service:market_data_service_bin --define include_env=true
```

## API

### POST `/api/jobs/daily-ingest`
Fetch OHLCV and upsert into `price_bars_daily`.

Request:
```json
{
  "asOfDate": "2026-02-13",
  "symbols": ["SPY", "QQQ", "SMH"],
  "force": false
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "asOfDate": "2026-02-13",
    "symbolsProcessed": 3,
    "barsUpserted": 3
  }
}
```

### POST `/api/jobs/compute-indicators`
Compute indicators and upsert into `indicators_daily`.

Request:
```json
{
  "asOfDate": "2026-02-13",
  "symbols": ["SPY", "QQQ", "SMH"],
  "lookbackDays": 260
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "asOfDate": "2026-02-13",
    "indicatorsUpserted": 3
  }
}
```

### POST `/api/jobs/weekly-sector-rank`
Compute weekly sector metrics and ranks.

Request:
```json
{
  "weekEndDate": "2026-02-13",
  "benchmark": "QQQ",
  "topN": 2
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "weekEndDate": "2026-02-13",
    "sectorsRanked": 8,
    "topSectors": [
      { "sector": "Semis", "rank": 1, "rel_strength_5d": 0.023 }
    ]
  }
}
```
