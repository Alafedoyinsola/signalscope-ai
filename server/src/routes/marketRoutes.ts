import { Router, type Request, type Response } from 'express'
import { BudgetPersistenceError } from '../services/budgetPersistence.ts'
import { CMCError, cmcClient } from '../services/cmcClient.ts'
import { RateLimitExceededError, RequestBudgetExceededError } from '../services/rateLimiter.ts'
import { snapshotBuffer } from '../services/snapshotBuffer.ts'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const router = Router()

// Helper to sanitize crypto symbol input
export function sanitizeSymbol(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || typeof value !== 'string') {
    throw new ValidationError('Symbol parameter is required')
  }
  const trimmed = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,10}$/.test(trimmed)) {
    throw new ValidationError('Invalid symbol format. Must be 1-10 alphanumeric characters.')
  }
  return trimmed
}

// Helper to validate integer limit parameter
export function parseLimitParam(rawLimit: unknown, defaultLimit: number): number {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return defaultLimit
  }
  const rawStr = String(rawLimit).trim()
  if (!/^\d+$/.test(rawStr)) {
    throw new ValidationError('Invalid limit parameter. Must be a positive integer.')
  }
  const parsed = parseInt(rawStr, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new ValidationError('Invalid limit parameter. Must be between 1 and 100.')
  }
  return parsed
}

// Global error mapper for route handlers
export function handleRouteError(err: unknown, res: Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: err.message,
    })
    return
  }

  if (err instanceof RateLimitExceededError) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds))
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: err.message,
      retryAfterSeconds: err.retryAfterSeconds,
    })
    return
  }

  if (err instanceof RequestBudgetExceededError) {
    res.status(429).json({
      error: 'MONTHLY_BUDGET_EXCEEDED',
      message: err.message,
    })
    return
  }

  if (err instanceof BudgetPersistenceError) {
    res.status(503).json({
      error: 'BUDGET_PERSISTENCE_ERROR',
      message: 'Persistent budget accounting unavailable. Upstream requests safely blocked.',
    })
    return
  }

  if (err instanceof CMCError) {
    res.status(err.statusCode).json({
      error: 'UPSTREAM_API_ERROR',
      statusCode: err.statusCode,
      cmcErrorCode: err.cmcErrorCode,
      message: err.message,
    })
    return
  }

  // Unexpected internal errors: generic response without exposing stack traces or internals
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred.',
  })
}

/**
 * GET /api/market/overview
 * Combined market overview: global metrics, top movers, and budget stats.
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const limit = parseLimitParam(req.query.limit, 20)
    const overview = await cmcClient.getMarketOverview(limit)
    res.json(overview)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * GET /api/market/listings
 * Top crypto listings with multi-timeframe deltas.
 */
router.get('/listings', async (req: Request, res: Response) => {
  try {
    const limit = parseLimitParam(req.query.limit, 25)
    const listings = await cmcClient.getListings(limit)
    res.json(listings)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * GET /api/market/quote/:symbol
 * Detailed quote with multi-timeframe deltas for a specific asset.
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = sanitizeSymbol(req.params.symbol)
    const quoteRes = await cmcClient.getQuote(symbol)
    res.json(quoteRes)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * GET /api/market/global
 * Global crypto market metrics.
 */
router.get('/global', async (_req: Request, res: Response) => {
  try {
    const globalRes = await cmcClient.getGlobalMetrics()
    res.json(globalRes)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * GET /api/market/snapshots/:symbol
 * Locally collected temporal snapshots for an asset (strictly genuine observations).
 */
router.get('/snapshots/:symbol', (req: Request, res: Response) => {
  try {
    const symbol = sanitizeSymbol(req.params.symbol)
    const snapshots = snapshotBuffer.getSnapshots(symbol)

    res.json({
      symbol,
      observationCount: snapshots.length,
      status: snapshots.length >= 5 ? 'SUFFICIENT_OBSERVATIONS' : 'INSUFFICIENT_OBSERVATIONS',
      dataSource: 'live_cmc',
      snapshots,
    })
  } catch (err) {
    handleRouteError(err, res)
  }
})

export default router
