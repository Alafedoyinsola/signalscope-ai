import type { GlobalMarketMetrics } from '../types/market.ts'
import { formatCurrency, formatTimestamp } from '../utils/formatters.ts'

interface GlobalMarketBannerProps {
  metrics: GlobalMarketMetrics | null
  dataSource?: 'live_cmc' | 'mock_fixture'
  cached?: boolean
}

export function GlobalMarketBanner({ metrics, cached }: GlobalMarketBannerProps) {
  if (!metrics) {
    return (
      <div className="banner-skeleton">
        <span>Loading global cryptocurrency market metrics...</span>
      </div>
    )
  }

  return (
    <div className="global-banner">
      <div className="global-metric">
        <span className="metric-label">TOTAL MARKET CAP</span>
        <span className="metric-value">{formatCurrency(metrics.totalMarketCap)}</span>
      </div>

      <div className="global-metric">
        <span className="metric-label">24H TRADING VOLUME</span>
        <span className="metric-value">{formatCurrency(metrics.totalVolume24h)}</span>
      </div>

      <div className="global-metric">
        <span className="metric-label">BTC DOMINANCE</span>
        <span className="metric-value highlight-btc">
          {metrics.btcDominance !== null ? `${metrics.btcDominance.toFixed(1)}%` : '—'}
        </span>
      </div>

      <div className="global-metric">
        <span className="metric-label">ETH DOMINANCE</span>
        <span className="metric-value">
          {metrics.ethDominance !== null ? `${metrics.ethDominance.toFixed(1)}%` : '—'}
        </span>
      </div>

      <div className="global-metric">
        <span className="metric-label">ACTIVE ASSETS</span>
        <span className="metric-value">
          {metrics.activeCryptocurrencies?.toLocaleString() ?? '—'}
        </span>
      </div>

      <div className="global-metric metric-status">
        <span className="metric-label">MARKET STATE</span>
        <div className="metric-status-sub">
          <span className="cache-indicator">{cached ? '⚡ CACHED' : '● FRESH'}</span>
          <span className="timestamp-indicator">{formatTimestamp(metrics.lastUpdated)}</span>
        </div>
      </div>
    </div>
  )
}
