import type { HistoricalComparisonResult } from '../types/forensics.ts'
import { formatCurrency, formatPercent, formatTimestamp } from '../utils/formatters.ts'

interface LocalHistoryCardProps {
  history: HistoricalComparisonResult
}

export function LocalHistoryCard({ history }: LocalHistoryCardProps) {
  const isInsufficient = history.status === 'INSUFFICIENT_OBSERVATIONS'

  if (isInsufficient) {
    return (
      <div className="card local-history-card history-insufficient">
        <div className="card-header-compact">
          <h3 className="section-title">
            <span className="section-icon">⏱</span>
            Local Snapshot Buffer
          </h3>
          <span className="badge-insufficient">
            {history.observationCount} / {history.requiredObservations} Observations
          </span>
        </div>
        <p className="history-message">{history.message}</p>
        <div className="history-footnote text-muted">
          Continuous local pattern forensics requires a minimum of 5 sampled observations.
          Snapshots accumulate in a 120-observation circular buffer (effective continuous intraday window ≤ 120 min).
        </div>
      </div>
    )
  }

  // Sufficient observations
  const { observationCount, timeRange, priceRange, volumeRange, disclaimer } = history
  const priceSpread = priceRange.max - priceRange.min
  const currentRatio =
    priceSpread > 0
      ? Math.max(0, Math.min(1, (priceRange.current - priceRange.min) / priceSpread))
      : 0.5

  return (
    <div className="card local-history-card history-sufficient">
      <div className="card-header-compact">
        <h3 className="section-title">
          <span className="section-icon">⏱</span>
          Local Snapshot History
        </h3>
        <span className="badge-sufficient">
          {observationCount} Observations ({timeRange.durationMinutes}m window)
        </span>
      </div>

      <div className="history-metrics-grid">
        <div className="history-metric-box">
          <span className="history-box-label">SAMPLED MIN</span>
          <span className="history-box-val font-mono">{formatCurrency(priceRange.min)}</span>
          <span className="history-box-delta text-muted">
            {formatPercent(priceRange.deltaFromMinPercent)} from min
          </span>
        </div>

        <div className="history-metric-box highlight-box">
          <span className="history-box-label">CURRENT OBSERVED</span>
          <span className="history-box-val font-mono font-bold">
            {formatCurrency(priceRange.current)}
          </span>
          <span className="history-box-delta text-muted">
            {timeRange.durationMinutes} min interval
          </span>
        </div>

        <div className="history-metric-box">
          <span className="history-box-label">SAMPLED MAX</span>
          <span className="history-box-val font-mono">{formatCurrency(priceRange.max)}</span>
          <span className="history-box-delta text-muted">
            {formatPercent(priceRange.deltaFromMaxPercent)} from max
          </span>
        </div>
      </div>

      {/* Lightweight SVG Range Bar */}
      <div className="svg-range-container">
        <div className="range-labels font-mono text-muted">
          <span>Min: {formatCurrency(priceRange.min)}</span>
          <span>Max: {formatCurrency(priceRange.max)}</span>
        </div>
        <svg
          viewBox="0 0 400 16"
          className="range-svg"
          aria-label="Price range relative position"
        >
          {/* Background track */}
          <rect x="0" y="6" width="400" height="4" rx="2" fill="#334155" />
          {/* Active filled track to current position */}
          <rect
            x="0"
            y="6"
            width={Math.round(currentRatio * 400)}
            height="4"
            rx="2"
            fill="#38bdf8"
          />
          {/* Current position marker */}
          <circle
            cx={Math.round(currentRatio * 400)}
            cy="8"
            r="6"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="2"
          />
        </svg>
      </div>

      {volumeRange.min !== null && volumeRange.max !== null && (
        <div className="volume-summary text-muted">
          <span>Observed Volume Range: </span>
          <span className="font-mono">
            {formatCurrency(volumeRange.min)} — {formatCurrency(volumeRange.max)}
          </span>
          <span className="time-window">
            (Window: {formatTimestamp(timeRange.start)} to {formatTimestamp(timeRange.end)})
          </span>
        </div>
      )}

      <p className="disclaimer-text text-muted">{disclaimer}</p>
    </div>
  )
}
