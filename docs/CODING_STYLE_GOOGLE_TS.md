
# Coding Style Guide (Google Style) — TypeScript + Node + Express + Knex (Bazel Monorepo)

This repository follows **Google’s engineering style** where applicable, adapted to a Bazel + TypeScript backend.

> Principle: **readability > cleverness**, **consistency > preference**, **small, testable units**.

---

## 1) Canonical References
We align to these “source of truth” guides (in this order):
1. **Google TypeScript Style Guide** (primary)
2. **Google JavaScript Style Guide** (fallback when TS guide is silent)
3. Project-specific rules in this document

---

## 2) Language & Tooling Baseline

### TypeScript
- Use TypeScript for all backend code.
- Prefer **strict** typing.
- Prefer `unknown` over `any`. If `any` is unavoidable, isolate it and explain why.
- Use `readonly` where it improves intent.
- Use `enum` sparingly; prefer union string literal types for API payloads and DB row types.

### Node / Express
- Prefer explicit request/response types.
- Avoid mixing concerns: handlers should delegate to services/use-cases.

### Knex
- Centralize all DB access in `libs/db` and expose typed query functions.
- No raw SQL in route handlers. Raw SQL must live in `libs/db/queries/*` with tests.

---

## 3) Formatting & Linting

### Formatting
- Use **Prettier** for formatting (consistent whitespace, wrapping, etc.).
- Use 2 spaces indent.
- Use single quotes `'...'` unless it reduces escaping.
- Max line length: 100–120 (choose one and enforce consistently).

### Linting
- Use **ESLint** with TypeScript rules.
- Prefer rules that catch correctness issues (no-floating-promises, etc.).

> If lint and prettier disagree, adjust configs so they don’t fight.

---

## 4) Naming Conventions

### Files & Folders
- `kebab-case` for folders and filenames:
  - `decision-engine.ts`
  - `paper-portfolio.service.ts`
- `index.ts` only for intentional public re-exports.

### Types / Interfaces
- `PascalCase`: `Signal`, `AccelerationScore`, `MarketRegime`

### Functions / Variables
- `camelCase`: `computeIndicators`, `riskPerTradePct`

### Constants
- `SCREAMING_SNAKE_CASE` for module-level constants:
  - `DEFAULT_RISK_PER_TRADE_PCT`
- Avoid “magic numbers” in logic. Put in constants/config.

### DB Tables/Columns
- `snake_case` in SQL
- Map to camelCase in code when returning DTOs

---

## 5) Imports & Module Structure

### Imports
- Group imports in this order:
  1) Node built-ins
  2) Third-party deps
  3) Internal libs (absolute/tsconfig paths)
  4) Relative imports

Example:
```ts
import crypto from 'crypto';

import express from 'express';
import type { Request, Response } from 'express';

import { getDb } from '@libs/db/knex';
import { computeEma } from '@libs/indicators/ema';

import { toSignalDto } from './mappers';
```

### Re-exports
- Prefer explicit exports over wildcard exports.
- Re-export only stable public API from libraries.

---

## 6) Types & API Contracts

### General
- **Every API request/response must be typed**.
- Define request/response schemas in `libs/types` and validate at runtime (recommended: Zod).

### API DTOs vs DB Rows
- Keep DB row types separate from API DTOs.
- Never leak DB implementation details in API responses unless intentional.

### `unknown` + parsing
When receiving external data:
- treat it as `unknown`
- validate/parse into typed structures
- only then pass into domain logic

---

## 7) Error Handling

### Guidelines
- Do not throw raw strings.
- Use typed error classes for domain errors:
  - `ValidationError`
  - `NotFoundError`
  - `ConflictError`
- Route handlers translate errors to HTTP status codes.

### Express pattern
- Use a single error middleware.
- Always include a stable error code in JSON (for client logic).

Example error response shape:
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "asOfDate must be YYYY-MM-DD"
  }
}
```

---

## 8) Logging

### Principles
- Use structured logging (JSON).
- Logs should answer:
  - What happened?
  - For which symbol/job?
  - With which inputs?
  - How long did it take?
  - Did it succeed?

### Required log fields (backend)
- `service`
- `route` or `jobName`
- `requestId` (or `idempotencyKey` for jobs)
- `symbol` (when applicable)
- `durationMs`
- `status`

Do **not** log secrets or raw API keys.

---

## 9) Testing Style

### Unit tests
- Prefer pure function tests for indicators, decision rules, risk sizing.
- Use deterministic fixtures (no time-based randomness).

### Integration tests
- DB queries: run against a test database.
- APIs: test request/response contracts and idempotency behavior.

### Naming
- Test file naming: `*.test.ts`
- Test case names describe behavior, not implementation.

---

## 10) Bazel Considerations

### Determinism
- Avoid reading from the filesystem at runtime unless explicitly passed.
- All jobs should accept explicit inputs (date, symbols, etc.).

### Entry points
- Each runnable job should be a small `main()` that calls library logic.
- Avoid wiring business logic directly into binaries.

---

## 11) Knex / Database Style

### Query placement
- All DB access goes through `libs/db`.
- One file per table domain is fine (e.g. `signals.queries.ts`).

### Transactions
- Use transactions for:
  - creating paper orders + updating positions
  - job runs that must be atomic

### Migrations
- Migrations must be **forward-only safe** and idempotent where possible.
- Always include indexes in migrations (not later).

---

## 12) Express API Style

### Route shape
- Keep route handlers thin:
  - validate input
  - call service/use-case
  - return DTO
- No decision engine logic in routes.

### Idempotency
- Job endpoints must accept `Idempotency-Key` header.
- Implement `job_runs` to prevent duplicates.

---

## 13) Code Review Checklist (PR)

- [ ] Types are correct; no `any` leaks
- [ ] Runtime validation for external inputs exists
- [ ] Decision logic remains deterministic
- [ ] Errors mapped to stable error codes
- [ ] Logs are structured and include required fields
- [ ] Tests added/updated
- [ ] No secrets in code or logs
- [ ] Knex queries not in route handlers
- [ ] Migrations include needed indexes

---

## 14) Example Conventions (Quick)

### Prefer explicit return types for exported functions
```ts
export function computeRiskShares(args: RiskArgs): RiskResult { ... }
```

### Prefer early returns over deep nesting
```ts
if (!aiOk) return null;
if (!trendConfirmed) return makeWatchSignal(...);
return makeBuySignal(...);
```

### Prefer small pure functions for decision gates
```ts
export function isTrendConfirmed(i: Indicators): boolean { ... }
export function isAiOk(s: AccelerationScore): boolean { ... }
```

---

## 15) “Project-Specific” Clarifications

- The decision engine must be **pure**: no DB, no network calls.
- Gemini calls must be cached and validated.
- All stored signals must include the full `reason_json` payload schema.
- Alerts are emitted only on **state transitions** (anti-spam).

