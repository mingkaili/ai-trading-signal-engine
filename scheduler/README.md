# Scheduler

Runs the scheduled flows by invoking service job endpoints in order. This is the
orchestrator; services do not schedule themselves.

## Environment
- `MARKET_DATA_BASE_URL` (required)
- `RESEARCH_AI_BASE_URL` (required for future use)
- `SIGNAL_ENGINE_BASE_URL` (required for future use)
- `SCHEDULER_AUTH_TOKEN` (optional Bearer token for internal auth)

Copy `.envsample` to `.env` and edit as needed.

## Run with Bazel

Cron scheduler (in-process):
```
bazel --output_user_root=.bazel_user_root_sched run //scheduler:scheduler_bin --define include_env=true -- --schedule true
```

Daily flow (market data):
```
bazel --output_user_root=.bazel_user_root_sched run //scheduler:scheduler_bin --define include_env=true -- --flow daily --as-of-date 2026-02-14 --symbols SPY,QQQ,SMH
```

Weekly flow (market data):
```
bazel --output_user_root=.bazel_user_root_sched run //scheduler:scheduler_bin --define include_env=true -- --flow weekly --week-end-date 2026-02-14 --benchmark QQQ --top-n 2
```

One-off job (any service):
```
bazel --output_user_root=.bazel_user_root_sched run //scheduler:scheduler_bin --define include_env=true -- --run-job market-data:/api/jobs/daily-ingest --payload-json '{"asOfDate":"2026-02-14","symbols":["SPY","QQQ"],"force":false}'
```

## Notes
- All job calls include the `Idempotency-Key` header.
- The key is deterministic from the job path + payload unless you pass
  `--idempotency-key`.
 - Default daily/weekly cron can be set with `SCHEDULER_DAILY_CRON` and
   `SCHEDULER_WEEKLY_CRON` (5-field cron format).
