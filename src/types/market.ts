export interface MarketQuote {
  id: number
  name: string
  symbol: string
  slug: string
  rank: number | null
  price: number
  percentChange1h: number | null
  percentChange24h: number | null
  percentChange7d: number | null
  percentChange30d: number | null
  volume24h: number | null
  volumeChange24h: number | null
  marketCap: number | null
  marketCapDominance: number | null
  circulatingSupply: number | null
  totalSupply: number | null
  maxSupply: number | null
  fdv: number | null
  lastUpdated: string
}

export interface GlobalMarketMetrics {
  totalMarketCap: number | null
  totalVolume24h: number | null
  btcDominance: number | null
  ethDominance: number | null
  activeCryptocurrencies: number | null
  lastUpdated: string
}

export interface MarketOverviewResponse {
  dataSource: 'live_cmc' | 'mock_fixture'
  timestamp: string
  globalMetrics: GlobalMarketMetrics
  topMovers: MarketQuote[]
  quotaInfo?: {
    recordedCreditCost: number
    monthlyRequestsUsed: number
    monthlyRequestBudget: number
  }
}

export interface SystemHealthResponse {
  status: string
  timestamp: string
  uptimeSeconds: number
  service: {
    name: string
    version: string
    memoryUsageMb: number
    cache: {
      keysCount: number
      hits: number
      misses: number
      hitRatio: number
    }
    rateLimiter: {
      requestsInLastMinute: number
      rateLimitPerMinute: number
      monthlyRequestsUsed: number
      monthlyRequestBudget: number
      actualCreditsReported: number
    }
    snapshotPolicy: {
      collectionActive: boolean
      trackedAssets: number
      totalSnapshots: number
      maxObservationsPerAsset: number
      maxAgeHours: number
      theoreticalOneMinuteWindowMinutes: number
      note: string
    }
  }
  upstream: {
    coinMarketCap: {
      configured: boolean
      connectivityStatus: string
      lastPingTimestamp: string | null
      lastHttpResponseCode: number | null
      entitlements: {
        latestListings: string
        latestQuotes: string
        globalMetrics: string
        historicalSeries: string
      }
    }
    ai?: {
      configured: boolean
      model: string
      baseUrl: string
    }
  }
}

export interface SnapshotRecord {
  timestamp: string
  epochMs: number
  price: number
  volume24h: number | null
  percentChange1h: number | null
  source: 'live_cmc'
}

export interface AssetSnapshotsResponse {
  symbol: string
  observationCount: number
  status: 'SUFFICIENT_OBSERVATIONS' | 'INSUFFICIENT_OBSERVATIONS'
  dataSource: 'live_cmc'
  snapshots: SnapshotRecord[]
}
