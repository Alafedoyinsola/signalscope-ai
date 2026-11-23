import { config } from '../config/env.ts'
import type {
  CMCApiEnvelope,
  CMCRawCryptoItem,
  CMCRawGlobalMetrics,
  GlobalMarketMetrics,
  MarketOverviewResponse,
  MarketQuote,
} from '../types/cmc.ts'
import { cacheService } from './cacheService.ts'
import { MOCK_GLOBAL_METRICS, MOCK_MARKET_QUOTES } from './mockFixtures.ts'
import { rateLimiter } from './rateLimiter.ts'
import { snapshotBuffer } from './snapshotBuffer.ts'

export class CMCError extends Error {
  readonly statusCode: number
  readonly cmcErrorCode: number | null

  constructor(
    message: string,
    statusCode: number,
    cmcErrorCode: number | null = null
  ) {
    super(message)
    this.name = 'CMCError'
    this.statusCode = statusCode
    this.cmcErrorCode = cmcErrorCode
  }
}

export interface UpstreamStatusInfo {
  configured: boolean
  connectivityStatus: 'connected' | 'unreachable' | 'rate_limited' | 'auth_failed' | 'disabled'
  lastPingTimestamp: string | null
  lastHttpResponseCode: number | null
}

export class CMCClient {
  private readonly baseUrl = 'https://pro-api.coinmarketcap.com'
  private readonly apiKey: string | null
  private readonly timeoutMs: number
  private lastPingTimestamp: string | null = null
  private lastHttpResponseCode: number | null = null
  private connectivityStatus: UpstreamStatusInfo['connectivityStatus'] = 'disabled'

  constructor(
    apiKey: string | null = config.cmcApiKey,
    timeoutMs: number = config.requestTimeoutMs
  ) {
    this.apiKey = apiKey
    this.timeoutMs = timeoutMs
    if (!this.apiKey) {
      this.connectivityStatus = 'disabled'
    }
  }

  /**
   * Internal HTTP execution using native fetch with timeout, headers, and rate limiting.
   */
  private async request<T>(endpoint: string, params: Record<string, string>): Promise<CMCApiEnvelope<T>> {
    if (!this.apiKey) {
      throw new CMCError('CoinMarketCap API key is not configured', 503)
    }

    // Check application rate limit and monthly budget
    rateLimiter.checkAndAcquire()

    const url = new URL(`${this.baseUrl}${endpoint}`)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }

    let response: Response
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
          Accept: 'application/json',
          'Accept-Encoding': 'deflate, gzip',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err: unknown) {
      this.lastPingTimestamp = new Date().toISOString()
      this.lastHttpResponseCode = null
      this.connectivityStatus = 'unreachable'
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      throw new CMCError(`Upstream request to CoinMarketCap failed: ${errorMsg}`, 504)
    }

    this.lastPingTimestamp = new Date().toISOString()
    this.lastHttpResponseCode = response.status

    if (!response.ok) {
      let cmcCode: number | null = null
      let message = `CMC API responded with HTTP ${response.status}`

      try {
        const errorJson = (await response.json()) as { status?: { error_code?: number; error_message?: string } }
        if (errorJson.status) {
          cmcCode = errorJson.status.error_code ?? null
          message = errorJson.status.error_message || message
        }
      } catch {
        // Fallback to HTTP status text
      }

      if (response.status === 401) {
        this.connectivityStatus = 'auth_failed'
      } else if (response.status === 429) {
        this.connectivityStatus = 'rate_limited'
      } else {
        this.connectivityStatus = 'unreachable'
      }

      throw new CMCError(message, response.status, cmcCode)
    }

    this.connectivityStatus = 'connected'

    const payload = (await response.json()) as CMCApiEnvelope<T>

    // Record verified actual credit cost returned by CoinMarketCap
    if (payload.status && typeof payload.status.credit_count === 'number') {
      rateLimiter.recordActualCredits(payload.status.credit_count)
    }

    return payload
  }

  /**
   * Normalizes a raw CoinMarketCap crypto item into an internal MarketQuote.
   */
  private normalizeQuote(item: CMCRawCryptoItem): MarketQuote {
    const usd = item.quote?.USD

    return {
      id: item.id,
      name: item.name,
      symbol: item.symbol,
      slug: item.slug,
      rank: item.cmc_rank ?? null,
      price: usd?.price ?? 0,
      percentChange1h: usd?.percent_change_1h ?? null,
      percentChange24h: usd?.percent_change_24h ?? null,
      percentChange7d: usd?.percent_change_7d ?? null,
      percentChange30d: usd?.percent_change_30d ?? null,
      volume24h: usd?.volume_24h ?? null,
      volumeChange24h: usd?.volume_change_24h ?? null,
      marketCap: usd?.market_cap ?? null,
      marketCapDominance: usd?.market_cap_dominance ?? null,
      circulatingSupply: item.circulating_supply ?? null,
      totalSupply: item.total_supply ?? null,
      maxSupply: item.max_supply ?? null,
      fdv: usd?.fully_diluted_market_cap ?? null,
      lastUpdated: usd?.last_updated ?? item.last_updated ?? new Date().toISOString(),
    }
  }

  /**
   * 1. GET /v1/cryptocurrency/listings/latest
   * Sensible limits: default limit = 25 to protect credit budget.
   */
  public async getListings(limit = 25): Promise<{ quotes: MarketQuote[]; dataSource: 'live_cmc' | 'mock_fixture' }> {
    if (!this.apiKey) {
      // Mock fixture fallback (clearly labeled; mock data never enters genuine snapshot buffer)
      const quotes = MOCK_MARKET_QUOTES.slice(0, limit)
      return { quotes, dataSource: 'mock_fixture' }
    }

    const cacheKey = `cmc:listings:${limit}`
    const quotes = await cacheService.getOrFetch<MarketQuote[]>(
      cacheKey,
      config.cacheTtl.listingsSec,
      async () => {
        const envelope = await this.request<CMCRawCryptoItem[]>(
          '/v1/cryptocurrency/listings/latest',
          {
            start: '1',
            limit: String(limit),
            convert: 'USD',
          }
        )

        const normalized = envelope.data.map((item) => this.normalizeQuote(item))
        // Record into local snapshot buffer upon retrieval (live observations only)
        for (const q of normalized) {
          snapshotBuffer.record(q.symbol, q, 'live_cmc')
        }
        return normalized
      }
    )

    return { quotes, dataSource: 'live_cmc' }
  }

  /**
   * 2. GET /v1/cryptocurrency/quotes/latest
   * Fetches latest quote for symbol or comma-separated symbols.
   */
  public async getQuote(symbol: string): Promise<{ quote: MarketQuote; dataSource: 'live_cmc' | 'mock_fixture' }> {
    const normalizedSymbol = symbol.toUpperCase().trim()

    if (!this.apiKey) {
      const found = MOCK_MARKET_QUOTES.find((q) => q.symbol === normalizedSymbol)
      if (!found) {
        throw new CMCError(`Asset with symbol ${normalizedSymbol} not found in mock fixtures`, 404)
      }
      return { quote: found, dataSource: 'mock_fixture' }
    }

    const cacheKey = `cmc:quote:${normalizedSymbol}`
    const quote = await cacheService.getOrFetch<MarketQuote>(
      cacheKey,
      config.cacheTtl.quotesSec,
      async () => {
        const envelope = await this.request<Record<string, CMCRawCryptoItem>>(
          '/v1/cryptocurrency/quotes/latest',
          {
            symbol: normalizedSymbol,
            convert: 'USD',
          }
        )

        const rawItem = envelope.data[normalizedSymbol]
        if (!rawItem) {
          throw new CMCError(`Asset with symbol ${normalizedSymbol} not found in CoinMarketCap response`, 404)
        }

        const normalized = this.normalizeQuote(rawItem)
        snapshotBuffer.record(normalized.symbol, normalized, 'live_cmc')
        return normalized
      }
    )

    return { quote, dataSource: 'live_cmc' }
  }

  /**
   * 3. GET /v1/global-metrics/quotes/latest
   */
  public async getGlobalMetrics(): Promise<{ metrics: GlobalMarketMetrics; dataSource: 'live_cmc' | 'mock_fixture' }> {
    if (!this.apiKey) {
      return { metrics: MOCK_GLOBAL_METRICS, dataSource: 'mock_fixture' }
    }

    const cacheKey = 'cmc:global-metrics'
    const metrics = await cacheService.getOrFetch<GlobalMarketMetrics>(
      cacheKey,
      config.cacheTtl.globalMetricsSec,
      async () => {
        const envelope = await this.request<CMCRawGlobalMetrics>(
          '/v1/global-metrics/quotes/latest',
          { convert: 'USD' }
        )

        const raw = envelope.data
        const usd = raw.quote?.USD

        return {
          totalMarketCap: usd?.total_market_cap ?? null,
          totalVolume24h: usd?.total_volume_24h ?? null,
          btcDominance: raw.btc_dominance ?? null,
          ethDominance: raw.eth_dominance ?? null,
          activeCryptocurrencies: raw.active_cryptocurrencies ?? null,
          lastUpdated: usd?.last_updated ?? raw.last_updated ?? new Date().toISOString(),
        }
      }
    )

    return { metrics, dataSource: 'live_cmc' }
  }

  /**
   * Aggregated Market Overview endpoint combining global metrics and top listings.
   */
  public async getMarketOverview(limit = 20): Promise<MarketOverviewResponse> {
    const [globalRes, listingsRes] = await Promise.all([
      this.getGlobalMetrics(),
      this.getListings(limit),
    ])

    const isLive = globalRes.dataSource === 'live_cmc' && listingsRes.dataSource === 'live_cmc'
    const stats = rateLimiter.getStats()

    return {
      dataSource: isLive ? 'live_cmc' : 'mock_fixture',
      timestamp: new Date().toISOString(),
      globalMetrics: globalRes.metrics,
      topMovers: listingsRes.quotes,
      quotaInfo: {
        recordedCreditCost: stats.actualCreditsReported,
        monthlyRequestsUsed: stats.monthlyRequestsUsed,
        monthlyRequestBudget: stats.monthlyRequestBudget,
      },
    }
  }

  /**
   * Diagnostic info for health endpoint.
   */
  public getUpstreamStatus(): UpstreamStatusInfo {
    return {
      configured: this.apiKey !== null,
      connectivityStatus: this.apiKey ? this.connectivityStatus : 'disabled',
      lastPingTimestamp: this.lastPingTimestamp,
      lastHttpResponseCode: this.lastHttpResponseCode,
    }
  }
}

// Global singleton instance for CMC client
export const cmcClient = new CMCClient()
