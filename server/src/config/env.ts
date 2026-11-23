import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Explicitly resolve project root .env regardless of process.cwd()
// Ensures single, deterministic dotenv configuration call
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootEnvPath = path.resolve(__dirname, '../../../.env')
dotenv.config({ path: rootEnvPath })

export const SUPPORTED_NODE_ENVS = ['development', 'production', 'test'] as const
export type NodeEnv = typeof SUPPORTED_NODE_ENVS[number]

function parseNodeEnv(rawValue: string | undefined): NodeEnv {
  if (rawValue === undefined || rawValue.trim() === '') {
    return 'development'
  }
  const normalized = rawValue.trim().toLowerCase()
  if (!SUPPORTED_NODE_ENVS.includes(normalized as NodeEnv)) {
    throw new Error(
      `[Config Error] Invalid NODE_ENV: "${rawValue}". Supported values: ${SUPPORTED_NODE_ENVS.join(', ')}`
    )
  }
  return normalized as NodeEnv
}

function parseBoundedInteger(
  name: string,
  rawValue: string | undefined,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValue
  }
  const trimmed = rawValue.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(
      `[Config Error] Environment variable ${name} must be a valid integer, received: "${rawValue}"`
    )
  }
  const parsed = parseInt(trimmed, 10)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(
      `[Config Error] Environment variable ${name} is not a safe integer, received: "${rawValue}"`
    )
  }
  if (parsed < min || parsed > max) {
    throw new Error(
      `[Config Error] Environment variable ${name} must be between ${min} and ${max}, received: ${parsed}`
    )
  }
  return parsed
}

export interface AppConfig {
  port: number
  nodeEnv: NodeEnv
  cmcApiKey: string | null
  rateLimitPerMinute: number
  monthlyRequestBudget: number
  requestTimeoutMs: number
  cacheTtl: {
    globalMetricsSec: number
    listingsSec: number
    quotesSec: number
  }
  snapshotPolicy: {
    maxObservationsPerAsset: number
    maxAgeHours: number
  }
  ai: {
    apiKey: string | null
    baseUrl: string
    model: string
    timeoutMs: number
  }
}

export const config: AppConfig = {
  port: parseBoundedInteger('PORT', process.env.PORT, 3001, 1024, 65535),
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  cmcApiKey:
    process.env.CMC_API_KEY && process.env.CMC_API_KEY.trim().length > 0
      ? process.env.CMC_API_KEY.trim()
      : null,
  // Account-specific safety ceiling of 50 req/min; default 25 req/min.
  // Note: 50 req/min reflects the user's currently reported CMC Basic account limit.
  // It is an account-specific safeguard, not a universal CoinMarketCap limit.
  rateLimitPerMinute: parseBoundedInteger(
    'CMC_RATE_LIMIT_PER_MINUTE',
    process.env.CMC_RATE_LIMIT_PER_MINUTE,
    25,
    1,
    50
  ),
  // Application-level soft cap on outgoing HTTP requests to CMC (not a CMC credit allowance)
  monthlyRequestBudget: parseBoundedInteger(
    'CMC_MONTHLY_REQUEST_BUDGET',
    process.env.CMC_MONTHLY_REQUEST_BUDGET,
    10000,
    1,
    100000
  ),
  // Configured upstream request timeout in milliseconds (bounds: 1000 - 30000 ms, default 10000 ms)
  requestTimeoutMs: parseBoundedInteger(
    'CMC_REQUEST_TIMEOUT_MS',
    process.env.CMC_REQUEST_TIMEOUT_MS,
    10000,
    1000,
    30000
  ),
  cacheTtl: {
    globalMetricsSec: parseBoundedInteger(
      'CACHE_TTL_GLOBAL_METRICS_SEC',
      process.env.CACHE_TTL_GLOBAL_METRICS_SEC,
      120,
      5,
      86400
    ),
    listingsSec: parseBoundedInteger(
      'CACHE_TTL_LISTINGS_SEC',
      process.env.CACHE_TTL_LISTINGS_SEC,
      60,
      5,
      86400
    ),
    quotesSec: parseBoundedInteger(
      'CACHE_TTL_QUOTES_SEC',
      process.env.CACHE_TTL_QUOTES_SEC,
      30,
      5,
      86400
    ),
  },
  snapshotPolicy: {
    // Retains between 1 and 1440 observations (default 120)
    maxObservationsPerAsset: parseBoundedInteger(
      'SNAPSHOT_MAX_OBSERVATIONS_PER_ASSET',
      process.env.SNAPSHOT_MAX_OBSERVATIONS_PER_ASSET,
      120,
      1,
      1440
    ),
    maxAgeHours: parseBoundedInteger(
      'SNAPSHOT_MAX_AGE_HOURS',
      process.env.SNAPSHOT_MAX_AGE_HOURS,
      24,
      1,
      168
    ),
  },
  ai: {
    apiKey:
      process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0
        ? process.env.AI_API_KEY.trim()
        : null,
    baseUrl:
      process.env.AI_BASE_URL && process.env.AI_BASE_URL.trim().length > 0
        ? process.env.AI_BASE_URL.trim()
        : 'https://api.openai.com/v1',
    model:
      process.env.AI_MODEL && process.env.AI_MODEL.trim().length > 0
        ? process.env.AI_MODEL.trim()
        : 'gpt-4o-mini',
    timeoutMs: parseBoundedInteger(
      'AI_TIMEOUT_MS',
      process.env.AI_TIMEOUT_MS,
      15000,
      1000,
      60000
    ),
  },
}
