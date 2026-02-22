import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

import dotenv from 'dotenv';

import { getUniverseSymbols } from './universe';

dotenv.config({ path: `${__dirname}/../.env` });

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type ServiceName = 'market-data' | 'research-ai' | 'signal-engine';

type JobConfig = {
  service: ServiceName;
  path: string;
  payload: JsonObject;
  idempotencyKey?: string;
};

type SchedulerFlow = 'daily' | 'weekly';
type CronFields = {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function getServiceBaseUrl(service: ServiceName): string {
  switch (service) {
    case 'market-data':
      return ensureEnv('MARKET_DATA_BASE_URL');
    case 'research-ai':
      return ensureEnv('RESEARCH_AI_BASE_URL');
    case 'signal-engine':
      return ensureEnv('SIGNAL_ENGINE_BASE_URL');
    default:
      throw new Error(`Unknown service ${service}`);
  }
}

function buildIdempotencyKey(jobName: string, payload: JsonObject): string {
  const input = `${jobName}:${JSON.stringify(payload)}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

function requestJson(url: string, payload: JsonObject, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(payload);
    const requestOptions = {
      method: 'POST',
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        ...headers,
      },
    };
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(requestOptions, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          reject(new Error(`HTTP ${status}: ${data}`));
          return;
        }
        if (!data) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${(error as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseCommaList(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got "${expression}"`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function matchCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  const parsed = Number(field);
  return Number.isFinite(parsed) && parsed === value;
}

function shouldRunCron(expression: string, now: Date): boolean {
  const cron = parseCron(expression);
  return (
    matchCronField(cron.minute, now.getMinutes()) &&
    matchCronField(cron.hour, now.getHours()) &&
    matchCronField(cron.dayOfMonth, now.getDate()) &&
    matchCronField(cron.month, now.getMonth() + 1) &&
    matchCronField(cron.dayOfWeek, now.getDay())
  );
}

function normalizeSymbols(symbols: string[]): string[] {
  const unique = new Set<string>();
  for (const symbol of symbols) {
    const normalized = symbol.trim().toUpperCase();
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique.values());
}

function buildDailyFlow(args: Record<string, string>): JobConfig[] {
  const asOfDate = args['as-of-date'] ?? new Date().toISOString().slice(0, 10);
  const symbols = normalizeSymbols(parseCommaList(args.symbols) ?? getUniverseSymbols());
  const force = args.force === 'true';
  const lookbackDays = args['lookback-days'] ? Number(args['lookback-days']) : undefined;
  const indicatorPayload: JsonObject = { asOfDate, symbols };
  if (lookbackDays !== undefined) {
    indicatorPayload.lookbackDays = lookbackDays;
  }

  return [
    {
      service: 'market-data',
      path: '/api/jobs/daily-ingest',
      payload: { asOfDate, symbols, force },
    },
    {
      service: 'market-data',
      path: '/api/jobs/compute-indicators',
      payload: indicatorPayload,
    },
  ];
}

function buildWeeklyFlow(args: Record<string, string>): JobConfig[] {
  const weekEndDate = args['week-end-date'] ?? new Date().toISOString().slice(0, 10);
  const benchmark = args.benchmark ?? 'QQQ';
  const topN = args['top-n'] ? Number(args['top-n']) : undefined;
  const payload: JsonObject = { weekEndDate, benchmark };
  if (topN !== undefined) {
    payload.topN = topN;
  }
  return [
    {
      service: 'market-data',
      path: '/api/jobs/weekly-sector-rank',
      payload,
    },
  ];
}

function parseRunJob(args: Record<string, string>): JobConfig {
  const jobValue = args['run-job'];
  if (!jobValue) {
    throw new Error('Missing --run-job <service:path>');
  }
  const [serviceRaw, path] = jobValue.split(':');
  if (!serviceRaw || !path) {
    throw new Error('--run-job format must be <service:/api/path>');
  }
  const service = serviceRaw as ServiceName;
  const payloadJson = args['payload-json'] ?? '{}';
  let payload: JsonObject;
  try {
    payload = JSON.parse(payloadJson) as JsonObject;
  } catch (error) {
    throw new Error(`Invalid --payload-json: ${(error as Error).message}`);
  }
  return {
    service,
    path,
    payload,
    idempotencyKey: args['idempotency-key'],
  };
}

async function runJob(job: JobConfig): Promise<void> {
  const baseUrl = getServiceBaseUrl(job.service);
  const url = new URL(job.path, baseUrl).toString();
  const idempotencyKey =
    job.idempotencyKey ?? buildIdempotencyKey(`${job.service}:${job.path}`, job.payload);
  const headers: Record<string, string> = {
    'Idempotency-Key': idempotencyKey,
  };
  const authToken = process.env.SCHEDULER_AUTH_TOKEN;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const result = await requestJson(url, job.payload, headers);
  console.log(JSON.stringify({ job: `${job.service}${job.path}`, result }, null, 2));
}

async function runFlow(flow: SchedulerFlow, args: Record<string, string>): Promise<void> {
  const jobs = flow === 'daily' ? buildDailyFlow(args) : buildWeeklyFlow(args);
  for (const job of jobs) {
    await runJob(job);
  }
}

async function runCronLoop(args: Record<string, string>): Promise<void> {
  const dailyCron = args['daily-cron'] ?? process.env.SCHEDULER_DAILY_CRON ?? '10 16 * * *';
  const weeklyCron = args['weekly-cron'] ?? process.env.SCHEDULER_WEEKLY_CRON ?? '10 16 * * 0';
  let lastDailyKey = '';
  let lastWeeklyKey = '';

  const tick = async () => {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    if (shouldRunCron(dailyCron, now) && lastDailyKey !== dayKey) {
      lastDailyKey = dayKey;
      await runFlow('daily', args);
    }
    if (shouldRunCron(weeklyCron, now) && lastWeeklyKey !== dayKey) {
      lastWeeklyKey = dayKey;
      await runFlow('weekly', args);
    }
  };

  await tick();
  setInterval(() => {
    tick().catch((error) => {
      console.error(error);
    });
  }, 60_000);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    console.log(`Usage:
  --flow daily|weekly
  --schedule true
  --run-job <service:/api/path> --payload-json '{}' [--idempotency-key key]
  --as-of-date YYYY-MM-DD --symbols SPY,QQQ --lookback-days 260 --force true
  --week-end-date YYYY-MM-DD --benchmark QQQ --top-n 2
  --daily-cron "10 16 * * *" --weekly-cron "10 16 * * 0"
Env:
  MARKET_DATA_BASE_URL, RESEARCH_AI_BASE_URL, SIGNAL_ENGINE_BASE_URL, SCHEDULER_AUTH_TOKEN
  SCHEDULER_DAILY_CRON, SCHEDULER_WEEKLY_CRON
`);
    return;
  }

  if (args['run-job']) {
    await runJob(parseRunJob(args));
    return;
  }

  if (args.schedule === 'true') {
    await runCronLoop(args);
    return;
  }

  const flow = args.flow as SchedulerFlow | undefined;
  if (!flow || (flow !== 'daily' && flow !== 'weekly')) {
    throw new Error('Missing --flow daily|weekly or --run-job');
  }
  await runFlow(flow, args);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
