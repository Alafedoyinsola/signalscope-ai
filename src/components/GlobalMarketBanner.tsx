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
        <span className="skeleton-pulse">Connecting to cryptocurrency market metrics stream...</span>
      </div>
    )
  }

  return (
    <div className="global-banner">
      <div className="global-metric-group">
        <div className="global-metric">
          <span className="metric-label">TOTAL MARKET CAP</span>
          <span className="metric-value font-mono">{formatCurrency(metrics.totalMarketCap)}</span>
        </div>

        <div className="metric-divider" aria-hidden="true"></div>

        <div className="global-metric">
          <span className="metric-label">24H VOLUME</span>
          <span className="metric-value font-mono">{formatCurrency(metrics.totalVolume24h)}</span>
        </div>

        <div className="metric-divider" aria-hidden="true"></div>

        <div className="global-metric">
          <span className="metric-label">BTC DOMINANCE</span>
          <span className="metric-value font-mono highlight-btc">
            {metrics.btcDominance !== null ? `${metrics.btcDominance.toFixed(1)}%` : '—'}
          </span>
        </div>

        <div className="metric-divider" aria-hidden="true"></div>

        <div className="global-metric">
          <span className="metric-label">ETH DOMINANCE</span>
          <span className="metric-value font-mono">
            {metrics.ethDominance !== null ? `${metrics.ethDominance.toFixed(1)}%` : '—'}
          </span>
        </div>

        <div className="metric-divider" aria-hidden="true"></div>

        <div className="global-metric">
          <span className="metric-label">ACTIVE ASSETS</span>
          <span className="metric-value font-mono">
            {metrics.activeCryptocurrencies?.toLocaleString() ?? '—'}
          </span>
        </div>
      </div>

      <div className="global-status-group">
        <div className="market-state-badge">
          <span className={`state-indicator ${cached ? 'state-cached' : 'state-fresh'}`}>
            {cached ? '⚡ CACHED' : '● REAL-TIME'}
          </span>
          <span className="timestamp-indicator font-mono">
            {formatTimestamp(metrics.lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  )
}
