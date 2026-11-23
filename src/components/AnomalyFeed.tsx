import type { AnomalySummary } from '../types/forensics.ts'
import { formatCurrency, formatPercent } from '../utils/formatters.ts'

interface AnomalyFeedProps {
  anomalies: AnomalySummary[]
  isLoading: boolean
  onSelectAsset: (symbol: string) => void
  selectedSymbol: string | null
}

const INDICATOR_LABELS: Record<string, string> = {
  VOLUME_PRICE_DIVERGENCE: 'Vol-Price Divergence',
  VOLUME_EXPANSION: 'Volume Expansion',
  BENCHMARK_DIVERGENCE: 'Benchmark Divergence',
  SUPPLY_VALUATION_DISPARITY: 'Supply Disparity',
  MOMENTUM_DECELERATION: 'Momentum Deceleration',
}

export function AnomalyFeed({
  anomalies,
  isLoading,
  onSelectAsset,
  selectedSymbol,
}: AnomalyFeedProps) {
  if (isLoading && anomalies.length === 0) {
    return (
      <div className="card anomaly-feed-card">
        <div className="panel-header">
          <div className="panel-title-group">
            <svg className="panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
            </svg>
            <h2 className="panel-title">FORENSIC ANOMALY RADAR</h2>
          </div>
        </div>
        <div className="empty-state">
          <div className="spinner"></div>
          <p className="empty-text">Scanning market orderflow for divergence &amp; volume expansion signals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card anomaly-feed-card">
      <div className="panel-header">
        <div className="panel-title-group">
          <svg className="panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          <div>
            <h2 className="panel-title">FORENSIC ANOMALY RADAR</h2>
            <p className="panel-subtitle">Algorithmic divergence &amp; volume triggers</p>
          </div>
        </div>
        <span className="badge-flagged font-mono">
          {anomalies.length} FLAGGED
        </span>
      </div>

      {anomalies.length === 0 ? (
        <div className="empty-state">
          <p className="empty-text">No active market divergence anomalies detected in current scan.</p>
        </div>
      ) : (
        <div className="anomaly-scroll-container">
          {anomalies.map((item) => {
            const isSelected = selectedSymbol === item.symbol
            const change = item.percentChange24h ?? 0
            const isBullish = change >= 0

            return (
              <div
                key={item.symbol}
                className={`anomaly-card ${isSelected ? 'selected' : ''} ${
                  isBullish ? 'edge-positive' : 'edge-negative'
                }`}
                onClick={() => onSelectAsset(item.symbol)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectAsset(item.symbol)
                  }
                }}
              >
                <div className="anomaly-top">
                  <div className="anomaly-asset">
                    <span className="anomaly-symbol">{item.symbol}</span>
                    <span className="anomaly-name">{item.name}</span>
                  </div>
                  <div className="anomaly-stats">
                    <span className="anomaly-price font-mono">{formatCurrency(item.price)}</span>
                    <span
                      className={`anomaly-change font-mono ${
                        isBullish ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(item.percentChange24h)}
                    </span>
                  </div>
                </div>

                <div className="indicator-tags">
                  {item.indicators.map((ind) => {
                    const isExpansion = ind.id === 'VOLUME_EXPANSION'
                    const isDivergence = ind.id === 'VOLUME_PRICE_DIVERGENCE' || ind.id === 'BENCHMARK_DIVERGENCE'
                    const tagClass = isExpansion
                      ? 'tag-gold'
                      : isDivergence
                        ? 'tag-crimson'
                        : 'tag-silver'

                    return (
                      <span
                        key={ind.id}
                        className={`indicator-tag ${tagClass}`}
                        title={`${ind.name}: ${ind.explanation} (Threshold: ${ind.threshold})`}
                      >
                        {INDICATOR_LABELS[ind.id] || ind.name}
                      </span>
                    )
                  })}
                </div>

                <div className="anomaly-action-row">
                  <span className="anomaly-trigger-count font-mono">
                    {item.detectedIndicatorCount} indicator{item.detectedIndicatorCount !== 1 ? 's' : ''} active
                  </span>
                  <button
                    type="button"
                    className="btn-card-action"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAsset(item.symbol)
                    }}
                  >
                    <span>INVESTIGATE</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
