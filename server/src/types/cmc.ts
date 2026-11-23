// Raw CoinMarketCap API Status Object
export interface CMCStatus {
  timestamp: string
  error_code: number
  error_message: string | null
  elapsed: number
  credit_count: number
  notice?: string | null
  total_count?: number
}

// Raw CoinMarketCap Quote USD
export interface CMCRawUSDQuote {
  price: number
  volume_24h: number | null
  volume_change_24h: number | null
  percent_change_1h: number | null
  percent_change_24h: number | null
  percent_change_7d: number | null
  percent_change_30d?: number | null
  market_cap: number | null
  market_cap_dominance: number | null
  fully_diluted_market_cap: number | null
  last_updated: string | null
}

// Raw CoinMarketCap Cryptocurrency Item (used in listings and quotes)
export interface CMCRawCryptoItem {
  id: number
  name: string
  symbol: string
  slug: string
  num_market_pairs?: number | null
  date_added?: string | null
  tags?: string[]
  max_supply: number | null
  circulating_supply: number | null
  total_supply: number | null
  infinite_supply?: boolean
  platform?: {
    id: number
    name: string
    symbol: string
    slug: string
    token_address: string
  } | null
  cmc_rank?: number | null
  self_reported_circulating_supply?: number | null
  self_reported_market_cap?: number | null
  tvl_ratio?: number | null
  last_updated: string | null
  quote: {
    USD?: CMCRawUSDQuote
    [currency: string]: CMCRawUSDQuote | undefined
  }
}

// Raw CMC Global Metrics
export interface CMCRawGlobalMetrics {
  active_cryptocurrencies: number | null
  total_cryptocurrencies: number | null
  active_market_pairs: number | null
  active_exchanges: number | null
  btc_dominance: number | null
  eth_dominance: number | null
  quote: {
    USD?: {
      total_market_cap: number | null
      total_volume_24h: number | null
      total_volume_24h_reported?: number | null
      altcoin_volume_24h?: number | null
      altcoin_market_cap?: number | null
      deficit?: number | null
      last_updated: string | null
    }
  }
  last_updated: string | null
}

// Generic CMC API envelope
export interface CMCApiEnvelope<T> {
  status: CMCStatus
  data: T
}

// Normalized Internal Market Quote (with strict nullability for unavailable fields)
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

// Normalized Global Market Metrics
export interface GlobalMarketMetrics {
  totalMarketCap: number | null
  totalVolume24h: number | null
  btcDominance: number | null
  ethDominance: number | null
  activeCryptocurrencies: number | null
  lastUpdated: string
}

// Normalized Overview Response
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

// Snapshot Record for Local Temporal History (Genuine CMC Observations Only)
export interface SnapshotRecord {
  timestamp: string      // ISO-8601 UTC
  epochMs: number        // Date.now()
  price: number
  volume24h: number | null
  percentChange1h: number | null
  source: 'live_cmc'     // Strictly live observations; mock data rejected from buffer
}
