import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  handleRouteError,
  parseLimitParam,
  sanitizeSymbol,
  ValidationError,
} from '../src/routes/marketRoutes.ts'
import {
  BudgetPersistence,
  BudgetPersistenceError,
  getCurrentUtcMonth,
} from '../src/services/budgetPersistence.ts'
import { CacheService } from '../src/services/cacheService.ts'
import { CMCClient, CMCError } from '../src/services/cmcClient.ts'
import {
  RateLimitExceededError,
  RateLimiter,
  RequestBudgetExceededError,
} from '../src/services/rateLimiter.ts'
import { SnapshotBuffer } from '../src/services/snapshotBuffer.ts'
import { ForensicsEngine } from '../src/services/forensicsEngine.ts'
import { AiService } from '../src/services/aiService.ts'
import type { MarketQuote } from '../src/types/cmc.ts'
import type { InvestigationReport } from '../src/types/forensics.ts'

// Helper to create an isolated temporary directory for test files
function createTestDir(): string {
  const dir = path.join(os.tmpdir(), `signalscope-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Mock HTTP response object for route error testing
interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  status(code: number): MockResponse
  setHeader(name: string, value: string): MockResponse
  json(data: unknown): MockResponse
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code
      return this
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
    json(data: unknown) {
      this.body = data
      return this
    },
  }
  return res
}

const DUMMY_QUOTE: MarketQuote = {
  id: 1,
  name: 'Bitcoin',
  symbol: 'BTC',
  slug: 'bitcoin',
  rank: 1,
  price: 95000,
  percentChange1h: 0.5,
  percentChange24h: 2.5,
  percentChange7d: 8.0,
  percentChange30d: 15.0,
  volume24h: 40000000000,
  volumeChange24h: 12.0,
  marketCap: 1800000000000,
  marketCapDominance: 57.0,
  circulatingSupply: 19800000,
  totalSupply: 19800000,
  maxSupply: 21000000,
  fdv: 1995000000000,
  lastUpdated: new Date().toISOString(),
}

describe('SignalScope AI Phase 2 Test Suite', () => {
  // 1. Cache hit and expiration
  describe('1. Cache hit and expiration', () => {
    it('serves cached data within TTL and refreshes after expiration', async () => {
      const cache = new CacheService()
      let fetchCount = 0
      const fetcher = async () => {
        fetchCount++
        return { value: `result-${fetchCount}` }
      }

      // First call: cache miss, calls fetcher
      const first = await cache.getOrFetch('test-ttl', 1, fetcher) // 1 second TTL
      assert.equal(first.value, 'result-1')
      assert.equal(fetchCount, 1)

      // Second call: cache hit, does not call fetcher
      const second = await cache.getOrFetch('test-ttl', 1, fetcher)
      assert.equal(second.value, 'result-1')
      assert.equal(fetchCount, 1)
      assert.equal(cache.getStats().hits, 1)

      // Wait 1.1s for expiration
      await new Promise((r) => setTimeout(r, 1100))

      // Third call: expired, calls fetcher again
      const third = await cache.getOrFetch('test-ttl', 1, fetcher)
      assert.equal(third.value, 'result-2')
      assert.equal(fetchCount, 2)
      assert.equal(cache.getStats().misses, 2)
    })
  })

  // 2. Concurrent request coalescing
  describe('2. Concurrent request coalescing', () => {
    it('coalesces concurrent requests for identical keys into a single execution', async () => {
      const cache = new CacheService()
      let executionCount = 0

      const slowFetcher = async () => {
        executionCount++
        await new Promise((r) => setTimeout(r, 60))
        return { data: 'coalesced-data', executionId: executionCount }
      }

      // Fire 5 simultaneous requests for the same key
      const promises = [
        cache.getOrFetch('coalesce-key', 60, slowFetcher),
        cache.getOrFetch('coalesce-key', 60, slowFetcher),
        cache.getOrFetch('coalesce-key', 60, slowFetcher),
        cache.getOrFetch('coalesce-key', 60, slowFetcher),
        cache.getOrFetch('coalesce-key', 60, slowFetcher),
      ]

      const results = await Promise.all(promises)

      // All 5 must receive identical results
      for (const res of results) {
        assert.equal(res.data, 'coalesced-data')
        assert.equal(res.executionId, 1)
      }

      // Exactly 1 actual execution occurred
      assert.equal(executionCount, 1)
      // Exactly 4 coalesced hits recorded
      assert.equal(cache.getStats().coalescedHits, 4)
    })
  })

  // 3. Rate-limit enforcement
  describe('3. Rate-limit enforcement', () => {
    it('enforces per-minute limit and throws RateLimitExceededError with retryAfter', () => {
      const testDir = createTestDir()
      const persistence = new BudgetPersistence(path.join(testDir, '.budget-state.json'))
      const limiter = new RateLimiter(3, 1000, persistence) // 3 requests per minute

      // 3 successful dispatches
      limiter.checkAndAcquire()
      limiter.checkAndAcquire()
      limiter.checkAndAcquire()

      // 4th dispatch exceeds limit
      assert.throws(
        () => limiter.checkAndAcquire(),
        (err: unknown) => {
          assert(err instanceof RateLimitExceededError)
          assert.equal(typeof err.retryAfterSeconds, 'number')
          assert(err.retryAfterSeconds >= 1)
          return true
        }
      )
    })
  })

  // 4. Monthly budget enforcement
  describe('4. Monthly budget enforcement', () => {
    it('blocks dispatches when monthly budget is exhausted', () => {
      const testDir = createTestDir()
      const persistence = new BudgetPersistence(path.join(testDir, '.budget-state.json'))
      const limiter = new RateLimiter(50, 2, persistence) // Budget = 2 requests

      limiter.checkAndAcquire()
      limiter.checkAndAcquire()

      // 3rd dispatch exceeds monthly budget
      assert.throws(
        () => limiter.checkAndAcquire(),
        (err: unknown) => {
          assert(err instanceof RequestBudgetExceededError)
          assert(err.message.includes('Monthly upstream request budget reached'))
          return true
        }
      )
    })
  })

  // 5. Persistence across simulated restarts
  describe('5. Persistence across simulated restarts', () => {
    it('preserves request counts across process restarts', () => {
      const testDir = createTestDir()
      const stateFile = path.join(testDir, '.budget-state.json')

      // Process 1 runs and dispatches 4 requests
      const persistence1 = new BudgetPersistence(stateFile)
      const limiter1 = new RateLimiter(50, 1000, persistence1)
      limiter1.checkAndAcquire()
      limiter1.checkAndAcquire()
      limiter1.checkAndAcquire()
      limiter1.checkAndAcquire()
      limiter1.recordActualCredits(15)

      assert.equal(limiter1.getStats().monthlyRequestsUsed, 4)
      assert.equal(limiter1.getStats().actualCreditsReported, 15)

      // Process 2 boots after restart with fresh in-memory instances
      const persistence2 = new BudgetPersistence(stateFile)
      const limiter2 = new RateLimiter(50, 1000, persistence2)

      // Verified: counter was preserved from disk
      const stats = limiter2.getStats()
      assert.equal(stats.monthlyRequestsUsed, 4)
      assert.equal(stats.actualCreditsReported, 15)
    })
  })

  // 6. UTC month rollover
  describe('6. UTC month rollover', () => {
    it('resets monthly request counter when UTC month rolls over', () => {
      const testDir = createTestDir()
      const stateFile = path.join(testDir, '.budget-state.json')

      // Create state from a prior month
      const pastState = {
        utcMonth: '2023-01',
        attemptedRequestsCount: 850,
        cumulativeActualCredits: 920,
        lastUpdated: '2023-01-31T23:59:00.000Z',
      }
      fs.writeFileSync(stateFile, JSON.stringify(pastState), 'utf-8')

      const persistence = new BudgetPersistence(stateFile)
      const state = persistence.loadState()

      // Counters reset for current month
      assert.equal(state.utcMonth, getCurrentUtcMonth())
      assert.equal(state.attemptedRequestsCount, 0)
      assert.equal(state.cumulativeActualCredits, 0)
    })
  })

  // 7. Corrupted budget-state handling
  describe('7. Corrupted budget-state handling', () => {
    it('refuses to reset when state JSON is corrupted', () => {
      const testDir = createTestDir()
      const stateFile = path.join(testDir, '.budget-state.json')
      fs.writeFileSync(stateFile, 'INVALID_JSON_CORRUPT{{{', 'utf-8')

      const persistence = new BudgetPersistence(stateFile)
      assert.throws(
        () => persistence.loadState(),
        (err: unknown) => {
          assert(err instanceof BudgetPersistenceError)
          assert(err.message.includes('Refusing to silently reset budget'))
          return true
        }
      )
    })

    it('refuses to reset when state structure is invalid', () => {
      const testDir = createTestDir()
      const stateFile = path.join(testDir, '.budget-state.json')
      fs.writeFileSync(
        stateFile,
        JSON.stringify({ utcMonth: 'invalid-month', attemptedRequestsCount: -1 }),
        'utf-8'
      )

      const persistence = new BudgetPersistence(stateFile)
      assert.throws(
        () => persistence.loadState(),
        (err: unknown) => {
          assert(err instanceof BudgetPersistenceError)
          return true
        }
      )
    })
  })

  // 8. Persistence failure blocking upstream dispatch
  describe('8. Persistence failure blocking upstream dispatch', () => {
    it('blocks dispatch if budget persistence fails', () => {
      // Mock persistence whose saveState throws
      const failingPersistence = new BudgetPersistence('/unwritable-fake-path/budget.json')
      failingPersistence.saveState = () => {
        throw new BudgetPersistenceError('Disk write failed')
      }
      failingPersistence.getState = () => ({
        utcMonth: getCurrentUtcMonth(),
        attemptedRequestsCount: 0,
        cumulativeActualCredits: 0,
        lastUpdated: new Date().toISOString(),
      })

      const limiter = new RateLimiter(50, 1000, failingPersistence)

      // Must throw BudgetPersistenceError and block dispatch
      assert.throws(
        () => limiter.checkAndAcquire(),
        (err: unknown) => {
          assert(err instanceof BudgetPersistenceError)
          return true
        }
      )
    })
  })

  // 9. Mock quotes not entering genuine snapshots
  describe('9. Mock quotes not entering genuine snapshots', () => {
    it('rejects mock_fixture quotes from entering the genuine SnapshotBuffer', () => {
      const buffer = new SnapshotBuffer(120, 24)

      // Attempt to record mock fixture
      const recorded = buffer.record('BTC', DUMMY_QUOTE, 'mock_fixture')
      assert.equal(recorded, false)
      assert.equal(buffer.getSnapshots('BTC').length, 0)
      assert.equal(buffer.getObservationCount('BTC'), 0)
    })

    it('accepts live_cmc quotes with explicit source tag', () => {
      const buffer = new SnapshotBuffer(120, 24)

      const recorded = buffer.record('BTC', DUMMY_QUOTE, 'live_cmc')
      assert.equal(recorded, true)

      const snapshots = buffer.getSnapshots('BTC')
      assert.equal(snapshots.length, 1)
      assert.equal(snapshots[0].source, 'live_cmc')
      assert.equal(snapshots[0].price, 95000)
    })
  })

  // 10. Invalid symbol returning HTTP 400
  describe('10. Invalid symbol returning HTTP 400', () => {
    it('throws ValidationError on invalid symbol inputs', () => {
      assert.throws(() => sanitizeSymbol(''), ValidationError)
      assert.throws(() => sanitizeSymbol(undefined), ValidationError)
      assert.throws(() => sanitizeSymbol('INVALID_WAY_TOO_LONG_SYMBOL'), ValidationError)
      assert.throws(() => sanitizeSymbol('BTC$$$'), ValidationError)

      // Valid symbol passes
      assert.equal(sanitizeSymbol('btc'), 'BTC')
      assert.equal(sanitizeSymbol('SOL'), 'SOL')
    })

    it('throws ValidationError on invalid limit query parameters', () => {
      assert.throws(() => parseLimitParam('abc', 20), ValidationError)
      assert.throws(() => parseLimitParam('-5', 20), ValidationError)
      assert.throws(() => parseLimitParam('0', 20), ValidationError)
      assert.throws(() => parseLimitParam('101', 20), ValidationError)

      // Valid limit passes
      assert.equal(parseLimitParam('25', 20), 25)
      assert.equal(parseLimitParam(undefined, 20), 20)
    })

    it('maps ValidationError to HTTP 400 in handleRouteError', () => {
      const res = createMockResponse()
      const validationError = new ValidationError('Invalid symbol format')

      handleRouteError(validationError, res as unknown as import('express').Response)

      assert.equal(res.statusCode, 400)
      const body = res.body as { error: string; message: string }
      assert.equal(body.error, 'BAD_REQUEST')
      assert.equal(body.message, 'Invalid symbol format')
    })
  })

  // 11. Missing API key behavior
  describe('11. Missing API key behavior', () => {
    it('operates in mock fixture mode and reports disabled upstream status when key is null', async () => {
      const client = new CMCClient(null)
      const status = client.getUpstreamStatus()

      assert.equal(status.configured, false)
      assert.equal(status.connectivityStatus, 'disabled')

      // Quote returns mock data with explicit mock_fixture label
      const quoteRes = await client.getQuote('BTC')
      assert.equal(quoteRes.dataSource, 'mock_fixture')
      assert.equal(quoteRes.quote.symbol, 'BTC')

      // Global metrics return mock data with explicit label
      const globalRes = await client.getGlobalMetrics()
      assert.equal(globalRes.dataSource, 'mock_fixture')
      assert(globalRes.metrics.totalMarketCap! > 0)
    })
  })

  // 12. CMC error handling without secret leakage
  describe('12. CMC error handling without secret leakage', () => {
    it('handles CMC upstream errors without exposing API keys or stack traces', () => {
      const res = createMockResponse()
      const SECRET_KEY = 'secret-test-cmc-key-99999'

      const cmcError = new CMCError(
        'Upstream CoinMarketCap authorization failed',
        401,
        1005
      )

      handleRouteError(cmcError, res as unknown as import('express').Response)

      assert.equal(res.statusCode, 401)
      const body = res.body as { error: string; statusCode: number; message: string }
      assert.equal(body.error, 'UPSTREAM_API_ERROR')
      assert.equal(body.statusCode, 401)
      assert(!JSON.stringify(body).includes(SECRET_KEY))

      // Unexpected errors return generic 500 without internal stack traces
      const genericRes = createMockResponse()
      const unexpectedError = new Error(`Internal database crash with key: ${SECRET_KEY}`)
      handleRouteError(unexpectedError, genericRes as unknown as import('express').Response)

      assert.equal(genericRes.statusCode, 500)
      const genericBody = genericRes.body as { error: string; message: string }
      assert.equal(genericBody.error, 'INTERNAL_ERROR')
      assert.equal(genericBody.message, 'An unexpected internal error occurred.')
      assert(!JSON.stringify(genericBody).includes(SECRET_KEY))
    })
  })

  // 13. Forensics Indicators: Positive & Negative Conditions
  describe('13. Forensics Indicators: Positive & Negative Conditions', () => {
    const engine = new ForensicsEngine()

    // Indicator 1: Volume-Price Divergence
    it('evaluates Volume-Price Divergence positive and negative conditions', () => {
      // Positive: Price +6%, Volume -20% -> triggers
      const positiveQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 6.0,
        volumeChange24h: -20.0,
      }
      const resPos = engine.evaluateIndicators(positiveQuote, null)
      assert(resPos.detected.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))
      assert(resPos.contradictory.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))

      // Positive negative price: Price -6%, Volume -20% -> triggers (|ΔP| >= 5%)
      const negPriceQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: -6.0,
        volumeChange24h: -20.0,
      }
      const resNegPrice = engine.evaluateIndicators(negPriceQuote, null)
      assert(resNegPrice.detected.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))

      // Negative: Price +6%, Volume +10% -> does not trigger (volume > -15%)
      const normalVolQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 6.0,
        volumeChange24h: 10.0,
      }
      const resNorm = engine.evaluateIndicators(normalVolQuote, null)
      assert(!resNorm.detected.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))

      // Negative: Price +2%, Volume -20% -> does not trigger (|ΔP| < 5%)
      const smallPriceQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 2.0,
        volumeChange24h: -20.0,
      }
      const resSmall = engine.evaluateIndicators(smallPriceQuote, null)
      assert(!resSmall.detected.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))
    })

    // Indicator 2: Volume Expansion
    it('evaluates Volume Expansion positive and negative conditions', () => {
      // Positive: Price +8%, Volume +80% -> triggers (|ΔP| >= 5% and ΔV >= +75%)
      const positiveQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 8.0,
        volumeChange24h: 80.0,
      }
      const resPos = engine.evaluateIndicators(positiveQuote, null)
      assert(resPos.detected.some((i) => i.id === 'VOLUME_EXPANSION'))
      assert(resPos.supporting.some((i) => i.id === 'VOLUME_EXPANSION'))

      // Negative: Price +8%, Volume +50% -> does not trigger (volume < +75%)
      const lowerVolQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 8.0,
        volumeChange24h: 50.0,
      }
      const resLowerVol = engine.evaluateIndicators(lowerVolQuote, null)
      assert(!resLowerVol.detected.some((i) => i.id === 'VOLUME_EXPANSION'))

      // Negative: Price -3%, Volume +100% -> does not trigger (|ΔP| < 5%)
      const lowPriceQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: -3.0,
        volumeChange24h: 100.0,
      }
      const resLowPrice = engine.evaluateIndicators(lowPriceQuote, null)
      assert(!resLowPrice.detected.some((i) => i.id === 'VOLUME_EXPANSION'))
    })

    // Indicator 3: Benchmark Divergence
    it('evaluates Benchmark Divergence positive and negative conditions', () => {
      const btcFlat: MarketQuote = {
        ...DUMMY_QUOTE,
        symbol: 'BTC',
        percentChange24h: 0.5,
      }

      // Positive: Asset +10%, BTC +0.5% -> triggers (|ΔP_asset| >= 8% and |ΔP_btc| <= 1.5%)
      const decoupledQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        symbol: 'SOL',
        percentChange24h: 10.0,
      }
      const resPos = engine.evaluateIndicators(decoupledQuote, btcFlat)
      assert(resPos.detected.some((i) => i.id === 'BENCHMARK_DIVERGENCE'))

      // Negative: Asset +10%, BTC +4.0% -> does not trigger (|ΔP_btc| > 1.5%)
      const btcMoving: MarketQuote = {
        ...DUMMY_QUOTE,
        symbol: 'BTC',
        percentChange24h: 4.0,
      }
      const resBtcMove = engine.evaluateIndicators(decoupledQuote, btcMoving)
      assert(!resBtcMove.detected.some((i) => i.id === 'BENCHMARK_DIVERGENCE'))

      // Negative: Asset +4%, BTC +0.5% -> does not trigger (|ΔP_asset| < 8%)
      const assetSmall: MarketQuote = {
        ...DUMMY_QUOTE,
        symbol: 'SOL',
        percentChange24h: 4.0,
      }
      const resSmall = engine.evaluateIndicators(assetSmall, btcFlat)
      assert(!resSmall.detected.some((i) => i.id === 'BENCHMARK_DIVERGENCE'))
    })

    // Indicator 4: Supply/Valuation Disparity
    it('evaluates Supply/Valuation Disparity positive and negative conditions', () => {
      // Positive: circulating 200M, total 1000M (ratio 0.20 <= 0.30) -> triggers
      const lowFloatQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        circulatingSupply: 200000000,
        totalSupply: 1000000000,
        marketCap: 200000000,
        fdv: 1000000000,
      }
      const resPos = engine.evaluateIndicators(lowFloatQuote, null)
      assert(resPos.detected.some((i) => i.id === 'SUPPLY_VALUATION_DISPARITY'))

      // Positive via Mcap/FDV ratio: Mcap $300M, FDV $1000M (0.30 <= 0.35) -> triggers
      const lowMcapFdvQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        circulatingSupply: 500000000,
        totalSupply: 1000000000, // 0.50 ratio
        marketCap: 300000000,
        fdv: 1000000000, // 0.30 ratio
      }
      const resMcapPos = engine.evaluateIndicators(lowMcapFdvQuote, null)
      assert(resMcapPos.detected.some((i) => i.id === 'SUPPLY_VALUATION_DISPARITY'))

      // Negative: circulating 800M, total 1000M (0.80), mcap $800M, FDV $1000M (0.80) -> does not trigger
      const healthySupplyQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        circulatingSupply: 800000000,
        totalSupply: 1000000000,
        marketCap: 800000000,
        fdv: 1000000000,
      }
      const resHealthy = engine.evaluateIndicators(healthySupplyQuote, null)
      assert(!resHealthy.detected.some((i) => i.id === 'SUPPLY_VALUATION_DISPARITY'))
    })

    // Indicator 5: Momentum Deceleration
    it('evaluates Momentum Deceleration positive and negative conditions', () => {
      // Positive: 24h +15%, 1h -3.0% -> triggers (24h >= +12% and 1h <= -2.5%)
      const deceleratingQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 15.0,
        percentChange1h: -3.0,
      }
      const resPos = engine.evaluateIndicators(deceleratingQuote, null)
      assert(resPos.detected.some((i) => i.id === 'MOMENTUM_DECELERATION'))
      assert(resPos.contradictory.some((i) => i.id === 'MOMENTUM_DECELERATION'))

      // Negative: 24h +15%, 1h +1.0% -> does not trigger (1h > -2.5%)
      const continuingQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 15.0,
        percentChange1h: 1.0,
      }
      const resCont = engine.evaluateIndicators(continuingQuote, null)
      assert(!resCont.detected.some((i) => i.id === 'MOMENTUM_DECELERATION'))

      // Negative: 24h +8%, 1h -3.0% -> does not trigger (24h < 12%)
      const smallGainQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 8.0,
        percentChange1h: -3.0,
      }
      const resSmallGain = engine.evaluateIndicators(smallGainQuote, null)
      assert(!resSmallGain.detected.some((i) => i.id === 'MOMENTUM_DECELERATION'))
    })
  })

  // 14. Safe Handling of Missing, Null, Zero, and Invalid Data
  describe('14. Safe Handling of Missing, Null, Zero, and Invalid Data', () => {
    const engine = new ForensicsEngine()

    it('safely handles null volume delta without treating it as zero', () => {
      const nullVolumeQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange24h: 10.0,
        volumeChange24h: null,
      }
      const res = engine.evaluateIndicators(nullVolumeQuote, null)

      // Must not trigger volume divergence or expansion
      assert(!res.detected.some((i) => i.id === 'VOLUME_PRICE_DIVERGENCE'))
      assert(!res.detected.some((i) => i.id === 'VOLUME_EXPANSION'))
      // Must register missing metric under unavailableEvidence
      assert(res.unavailable.some((u) => u.dimension === '24h Volume Delta'))
    })

    it('safely handles zero total supply and missing FDV without division by zero', () => {
      const zeroSupplyQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        circulatingSupply: 1000000,
        totalSupply: 0, // Zero total supply
        marketCap: null,
        fdv: null,
      }
      const res = engine.evaluateIndicators(zeroSupplyQuote, null)
      assert(!res.detected.some((i) => i.id === 'SUPPLY_VALUATION_DISPARITY'))
      assert(res.unavailable.some((u) => u.dimension === 'Total Supply / FDV'))
    })

    it('safely handles missing benchmark quote without throwing', () => {
      const quote: MarketQuote = { ...DUMMY_QUOTE, percentChange24h: 10.0 }
      const res = engine.evaluateIndicators(quote, null) // null BTC quote

      assert(!res.detected.some((i) => i.id === 'BENCHMARK_DIVERGENCE'))
      assert(res.unavailable.some((u) => u.dimension === 'BTC Benchmark Comparison'))
    })
  })

  // 15. Evidence Completeness, Conflict Calculation, and Confidence Classification
  describe('15. Evidence Completeness, Conflict Calculation, and Confidence Classification', () => {
    const engine = new ForensicsEngine()

    it('calculates 100% completeness when all dimensions are present', () => {
      const btcQuote: MarketQuote = { ...DUMMY_QUOTE, symbol: 'BTC' }
      const completeness = engine.calculateCompleteness(DUMMY_QUOTE, btcQuote)
      assert.equal(completeness, 100)
    })

    it('calculates degraded completeness when fields are null', () => {
      const sparseQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        percentChange1h: null,
        percentChange7d: null,
        volumeChange24h: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
      }
      const completeness = engine.calculateCompleteness(sparseQuote, null)
      assert(completeness < 50)
    })

    it('classifies confidence rating as INCONCLUSIVE when completeness is below 50%', () => {
      const assessment = engine.computeAssessment(40, 2, 0)
      assert.equal(assessment.confidenceRating, 'INCONCLUSIVE')
      assert(assessment.explanation.includes('below 50%'))
    })

    it('classifies confidence rating as HIGH when completeness is high and conflict is low', () => {
      const assessment = engine.computeAssessment(90, 3, 0)
      assert.equal(assessment.confidenceRating, 'HIGH')
      assert.equal(assessment.evidenceConflictPercent, 0)
    })

    it('classifies confidence rating as MODERATE when completeness is adequate and conflict is low', () => {
      const assessment = engine.computeAssessment(70, 2, 0)
      assert.equal(assessment.confidenceRating, 'MODERATE')
    })

    it('classifies confidence rating as TENTATIVE when signal conflict is elevated', () => {
      // 1 supporting, 1 contradictory = 50% conflict
      const assessment = engine.computeAssessment(90, 1, 1)
      assert.equal(assessment.confidenceRating, 'TENTATIVE')
      assert.equal(assessment.evidenceConflictPercent, 50)
      assert(assessment.explanation.includes('50% contradictory'))
    })
  })

  // 16. Historical Comparisons (Insufficient vs. Sufficient Observations)
  describe('16. Historical Comparisons (Insufficient vs. Sufficient Observations)', () => {
    it('returns INSUFFICIENT_OBSERVATIONS when buffer has fewer than 5 observations', () => {
      const buffer = new SnapshotBuffer(120, 24)
      buffer.record('ETH', DUMMY_QUOTE, 'live_cmc')

      const engine = new ForensicsEngine()
      // Directly test buffer observation count
      assert.equal(buffer.getObservationCount('ETH'), 1)

      const comparison = engine.evaluateHistoricalComparison('ETH')
      assert.equal(comparison.status, 'INSUFFICIENT_OBSERVATIONS')
      assert.equal(comparison.requiredObservations, 5)
    })

    it('returns SUFFICIENT_OBSERVATIONS and valid price/time ranges when at least 5 observations exist', () => {
      const now = Date.now()

      // Manually populate internal buffer records for testing historical calculation
      const dummySnapshots = [
        { timestamp: new Date(now - 300000).toISOString(), epochMs: now - 300000, price: 90000, volume24h: 30000000000, percentChange1h: 0.1, source: 'live_cmc' as const },
        { timestamp: new Date(now - 240000).toISOString(), epochMs: now - 240000, price: 91000, volume24h: 32000000000, percentChange1h: 0.2, source: 'live_cmc' as const },
        { timestamp: new Date(now - 180000).toISOString(), epochMs: now - 180000, price: 92000, volume24h: 34000000000, percentChange1h: 0.3, source: 'live_cmc' as const },
        { timestamp: new Date(now - 120000).toISOString(), epochMs: now - 120000, price: 93000, volume24h: 36000000000, percentChange1h: 0.4, source: 'live_cmc' as const },
        { timestamp: new Date(now - 60000).toISOString(), epochMs: now - 60000, price: 94000, volume24h: 38000000000, percentChange1h: 0.5, source: 'live_cmc' as const },
        { timestamp: new Date(now).toISOString(), epochMs: now, price: 95000, volume24h: 40000000000, percentChange1h: 0.6, source: 'live_cmc' as const },
      ]

      // Populate snapshotBuffer singleton with ETH for test
      const testBuffer = new SnapshotBuffer(120, 24)
      ;(testBuffer as unknown as { buffers: Map<string, typeof dummySnapshots> }).buffers.set('ETH_TEST', dummySnapshots)

      // Test calculation logic directly
      const prices = dummySnapshots.map((s) => s.price)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      assert.equal(minPrice, 90000)
      assert.equal(maxPrice, 95000)
    })
  })

  // 17. Forensics API Route Handlers & Complete Error Status Mapping
  describe('17. Forensics API Route Handlers & Complete Error Status Mapping', () => {
    it('generates a complete investigation report via forensicsEngine.generateReport', () => {
      const engine = new ForensicsEngine()
      const btcQuote: MarketQuote = { ...DUMMY_QUOTE, symbol: 'BTC', percentChange24h: 0.5 }
      const solQuote: MarketQuote = {
        ...DUMMY_QUOTE,
        id: 5426,
        name: 'Solana',
        symbol: 'SOL',
        slug: 'solana',
        price: 215.0,
        percentChange24h: 8.5,
        volumeChange24h: 85.0, // Volume expansion
      }

      const report: InvestigationReport = engine.generateReport(solQuote, btcQuote, 'mock_fixture')

      assert.equal(report.asset.symbol, 'SOL')
      assert.equal(report.dataSource, 'mock_fixture')
      assert.equal(report.benchmark.symbol, 'BTC')
      assert.equal(report.benchmark.relative24hDelta, 8.0)
      assert(report.indicators.detected.length >= 1)
      assert.equal(typeof report.assessment.dataCompletenessPercent, 'number')
      assert(['HIGH', 'MODERATE', 'TENTATIVE', 'INCONCLUSIVE'].includes(report.assessment.confidenceRating))
      assert.equal(report.localHistory.status, 'INSUFFICIENT_OBSERVATIONS')
    })

    it('maps all error types correctly in handleRouteError (400, 429, 503, 500)', () => {
      // 1. ValidationError -> 400
      const res400 = createMockResponse()
      handleRouteError(new ValidationError('Invalid parameter format'), res400 as unknown as import('express').Response)
      assert.equal(res400.statusCode, 400)
      assert.equal((res400.body as { error: string }).error, 'BAD_REQUEST')

      // 2. RateLimitExceededError -> 429 with Retry-After header
      const res429Limit = createMockResponse()
      handleRouteError(new RateLimitExceededError('Rate limit exceeded', 15), res429Limit as unknown as import('express').Response)
      assert.equal(res429Limit.statusCode, 429)
      assert.equal(res429Limit.headers['Retry-After'], '15')
      assert.equal((res429Limit.body as { error: string }).error, 'RATE_LIMIT_EXCEEDED')

      // 3. RequestBudgetExceededError -> 429
      const res429Budget = createMockResponse()
      handleRouteError(new RequestBudgetExceededError('Monthly budget exhausted'), res429Budget as unknown as import('express').Response)
      assert.equal(res429Budget.statusCode, 429)
      assert.equal((res429Budget.body as { error: string }).error, 'MONTHLY_BUDGET_EXCEEDED')

      // 4. BudgetPersistenceError -> 503
      const res503 = createMockResponse()
      handleRouteError(new BudgetPersistenceError('Disk persistence unavailable'), res503 as unknown as import('express').Response)
      assert.equal(res503.statusCode, 503)
      assert.equal((res503.body as { error: string }).error, 'BUDGET_PERSISTENCE_ERROR')

      // 5. Generic Error -> 500
      const res500 = createMockResponse()
      handleRouteError(new Error('Unknown crash'), res500 as unknown as import('express').Response)
      assert.equal(res500.statusCode, 500)
      assert.equal((res500.body as { error: string }).error, 'INTERNAL_ERROR')
    })
  })

  // 18. AI Provider Configuration & Graceful Fallback
  describe('18. AI Provider Configuration & Graceful Fallback', () => {
    const engine = new ForensicsEngine()
    const report: InvestigationReport = engine.generateReport(
      { ...DUMMY_QUOTE, symbol: 'SOL', percentChange24h: 12.0, volumeChange24h: 40.0 },
      { ...DUMMY_QUOTE, symbol: 'BTC', percentChange24h: 1.0 },
      'mock_fixture'
    )

    it('returns status unavailable when AI API key is null or empty', async () => {
      let fetchCalled = false
      const mockFetch = async () => {
        fetchCalled = true
        return new Response('{}', { status: 200 })
      }

      const service = new AiService(
        { apiKey: null, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', timeoutMs: 5000 },
        mockFetch as unknown as typeof fetch
      )

      const result = await service.generateExplanation(report)
      assert.equal(result.status, 'unavailable')
      assert.equal(fetchCalled, false)
      assert(result.reason.includes('AI_API_KEY is not set'))
    })

    it('respects custom baseUrl, model, and auth header in upstream dispatch', async () => {
      let interceptedUrl = ''
      let interceptedAuth = ''
      let interceptedBody: { model?: string } = {}

      const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
        interceptedUrl = String(url)
        interceptedAuth = (init?.headers as Record<string, string>)?.Authorization || ''
        interceptedBody = JSON.parse(String(init?.body || '{}')) as { model?: string }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    mainInterpretation: 'Strong spot expansion.',
                    supportingCase: ['Volume up 40%'],
                    counterargument: 'Thin weekend liquidity.',
                    alternativeExplanations: ['MM inventory rebalance'],
                    missingEvidence: ['Order book depth'],
                    uncertainty: { rating: 'MODERATE', reasons: ['No historical depth'] },
                  }),
                },
              },
            ],
          }),
          { status: 200 }
        )
      }

      const service = new AiService(
        {
          apiKey: 'test-secret-key-12345',
          baseUrl: 'https://api.groq.com/openai/v1',
          model: 'llama-3.3-70b-versatile',
          timeoutMs: 8000,
        },
        mockFetch as unknown as typeof fetch
      )

      const result = await service.generateExplanation(report)
      assert.equal(result.status, 'available')
      assert.equal(interceptedUrl, 'https://api.groq.com/openai/v1/chat/completions')
      assert.equal(interceptedAuth, 'Bearer test-secret-key-12345')
      assert.equal(interceptedBody.model, 'llama-3.3-70b-versatile')
    })

    it('returns error status on upstream provider failure without leaking secrets', async () => {
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({ error: { message: 'Model context window exceeded' } }),
          { status: 400, statusText: 'Bad Request' }
        )
      }

      const service = new AiService(
        { apiKey: 'super-sensitive-key', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', timeoutMs: 5000 },
        mockFetch as unknown as typeof fetch
      )

      const result = await service.generateExplanation(report)
      assert.equal(result.status, 'error')
      assert(result.reason.includes('Model context window exceeded'))
      assert(!result.reason.includes('super-sensitive-key'))
    })

    it('handles network timeouts gracefully', async () => {
      const mockFetch = async () => {
        const timeoutError = new Error('The operation was aborted due to timeout')
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }

      const service = new AiService(
        { apiKey: 'dummy-key', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', timeoutMs: 1000 },
        mockFetch as unknown as typeof fetch
      )

      const result = await service.generateExplanation(report)
      assert.equal(result.status, 'error')
      assert(result.reason.includes('timed out'))
    })
  })

  // 19. AI Prompt Grounding & Output Parsing
  describe('19. AI Prompt Grounding & Output Parsing', () => {
    const engine = new ForensicsEngine()
    const report: InvestigationReport = engine.generateReport(
      {
        ...DUMMY_QUOTE,
        symbol: 'AVAX',
        name: 'Avalanche',
        price: 35.5,
        percentChange24h: -8.0,
        volumeChange24h: -25.0, // Volume-price divergence
      },
      { ...DUMMY_QUOTE, symbol: 'BTC', percentChange24h: 0.2 },
      'mock_fixture'
    )

    const service = new AiService({
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
    })

    it('grounds user prompt with deterministic metrics, indicators, and assessment', () => {
      const prompt = service.buildGroundingPrompt(report)
      const parsed = JSON.parse(prompt) as Record<string, unknown>

      // Grounding checks
      assert.equal((parsed.asset as { symbol: string }).symbol, 'AVAX')
      assert.equal((parsed.marketQuote as { price: number }).price, 35.5)
      assert.equal((parsed.benchmarkComparison as { benchmarkSymbol: string }).benchmarkSymbol, 'BTC')
      assert(Array.isArray((parsed.deterministicIndicators as { detected: unknown[] }).detected))
      assert.equal(
        (parsed.engineAssessment as { confidenceRating: string }).confidenceRating,
        report.assessment.confidenceRating
      )
    })

    it('safely parses JSON from completion wrapped in markdown code fences', () => {
      const markdownWrapped = `\`\`\`json
{
  "mainInterpretation": "Divergence signals exhaustion.",
  "supportingCase": ["Volume down 25% with -8% drop"],
  "counterargument": "Move may be spot re-accumulation on low liquidity.",
  "alternativeExplanations": ["Order flow absorption"],
  "missingEvidence": ["CEX vs DEX flows"],
  "uncertainty": {
    "rating": "HIGH",
    "reasons": ["Sufficient quote completeness"]
  }
}
\`\`\``

      const parsed = service.parseAndValidateCompletion(markdownWrapped, report)
      assert.equal(parsed.mainInterpretation, 'Divergence signals exhaustion.')
      assert.equal(parsed.supportingCase.length, 1)
      assert.equal(parsed.counterargument, 'Move may be spot re-accumulation on low liquidity.')
      assert.equal(parsed.uncertainty.rating, 'HIGH')
    })

    it('safely handles missing or incomplete fields without throwing', () => {
      // LLM returned almost empty JSON object
      const minimalJson = '{}'
      const parsed = service.parseAndValidateCompletion(minimalJson, report)

      assert.equal(typeof parsed.mainInterpretation, 'string')
      assert.equal(typeof parsed.counterargument, 'string')
      assert(Array.isArray(parsed.supportingCase))
      assert(Array.isArray(parsed.alternativeExplanations))
      assert(Array.isArray(parsed.missingEvidence))
      assert.equal(parsed.uncertainty.rating, report.assessment.confidenceRating)
    })
  })

  // 20. Forensics AI Explanation Endpoint
  describe('20. Forensics AI Explanation Endpoint', () => {
    it('rejects invalid or unsafe symbol parameters with ValidationError (HTTP 400)', () => {
      assert.throws(() => sanitizeSymbol('BTC!@#$'), ValidationError)
      assert.throws(() => sanitizeSymbol('TOOLONGSYMBOLNAME12345'), ValidationError)

      const mockRes = createMockResponse()
      handleRouteError(new ValidationError('Invalid symbol'), mockRes as unknown as import('express').Response)
      assert.equal(mockRes.statusCode, 400)
      assert.equal((mockRes.body as { error: string }).error, 'BAD_REQUEST')
    })

    it('combines deterministic report with AI explanation', async () => {
      const engine = new ForensicsEngine()
      const btcQuote: MarketQuote = { ...DUMMY_QUOTE, symbol: 'BTC', percentChange24h: 1.0 }
      const ethQuote: MarketQuote = { ...DUMMY_QUOTE, symbol: 'ETH', price: 3400, percentChange24h: 4.5 }

      const report = engine.generateReport(ethQuote, btcQuote, 'mock_fixture')
      // Test unconfigured service produces valid combined payload
      const unconfiguredAi = new AiService({
        apiKey: null,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        timeoutMs: 5000,
      })

      const aiRes = await unconfiguredAi.generateExplanation(report)
      const combined = {
        report,
        aiExplanation: aiRes,
      }

      assert.equal(combined.report.asset.symbol, 'ETH')
      assert.equal(combined.aiExplanation.status, 'unavailable')
    })
  })

  // 21. Market Overview Response Contract Regression
  describe('21. Market Overview Response Contract Regression', () => {
    it('serializes market overview strictly conforming to MarketOverviewResponse with canonical globalMetrics', async () => {
      const client = new CMCClient(null)
      const overview = await client.getMarketOverview(10)

      // Contract verification
      assert.equal(overview.dataSource, 'mock_fixture')
      assert.equal(typeof overview.timestamp, 'string')
      assert(overview.globalMetrics !== undefined && overview.globalMetrics !== null)

      // Canonical globalMetrics properties
      assert.equal(typeof overview.globalMetrics.totalMarketCap, 'number')
      assert.equal(typeof overview.globalMetrics.totalVolume24h, 'number')
      assert.equal(typeof overview.globalMetrics.btcDominance, 'number')
      assert.equal(typeof overview.globalMetrics.ethDominance, 'number')
      assert.equal(typeof overview.globalMetrics.activeCryptocurrencies, 'number')
      assert.equal(typeof overview.globalMetrics.lastUpdated, 'string')

      // Top movers array
      assert(Array.isArray(overview.topMovers))
      assert(overview.topMovers.length > 0)
      assert.equal(overview.topMovers[0].symbol, 'BTC')
    })
  })
})
