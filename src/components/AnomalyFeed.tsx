import type { AnomalySummary } from '../types/forensics.ts'
import { formatCurrency, formatPercent } from '../utils/formatters.ts'

interface AnomalyFeedProps {
  anomalies: AnomalySummary[]
  isLoading: boolean
  onSelectAsset: (symbol: string) => void
  selectedSymbol: string | null
}

const INDICATOR_LABELS: Record<string, string> = {
  VOLUME_PRICE_DIVERGENCE: 'Volume-Price Divergence',
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
      <div className="card anomaly-feed">
        <div className="card-header">
          <h2 className="card-title">⚠️ Active Market Anomalies</h2>
        </div>
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Scanning listings for forensic divergence and volume expansion signals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card anomaly-feed">
      <div className="card-header">
        <div className="header-title-row">
          <h2 className="card-title">
            <span className="card-icon">⚡</span>
            Active Market Anomalies
          </h2>
          <span className="badge-count">
            {anomalies.length} Flagged
          </span>
        </div>
        <p className="card-desc">
          Automated forensic indicator triggers across top scanned market pairs.
        </p>
      </div>

      {anomalies.length === 0 ? (
        <div className="empty-state">
          <p>No active market move anomalies detected across scanned assets.</p>
        </div>
      ) : (
        <div className="anomaly-list">
          {anomalies.map((item) => {
            const isSelected = selectedSymbol === item.symbol
            const change = item.percentChange24h ?? 0
            const isBullish = change > 0

            return (
              <div
                key={item.symbol}
                className={`anomaly-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectAsset(item.symbol)}
              >
                <div className="anomaly-top">
                  <div className="anomaly-asset">
                    <span className="anomaly-symbol">{item.symbol}</span>
                    <span className="anomaly-name">{item.name}</span>
                  </div>
                  <div className="anomaly-stats">
                    <span className="anomaly-price">{formatCurrency(item.price)}</span>
                    <span
                      className={`anomaly-change ${
                        isBullish ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(item.percentChange24h)}
                    </span>
                  </div>
                </div>

                <div className="indicator-tags">
                  {item.indicators.map((ind) => (
                    <span
                      key={ind.id}
                      className="indicator-tag"
                      title={`${ind.name}: ${ind.explanation} (Threshold: ${ind.threshold})`}
                    >
                      {INDICATOR_LABELS[ind.id] || ind.name}
                    </span>
                  ))}
                </div>

                <div className="anomaly-action-row">
                  <span className="anomaly-trigger-count">
                    {item.detectedIndicatorCount} indicator{item.detectedIndicatorCount !== 1 ? 's' : ''} triggered
                  </span>
                  <button
                    type="button"
                    className="btn-investigate"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAsset(item.symbol)
                    }}
                  >
                    Investigate →
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
