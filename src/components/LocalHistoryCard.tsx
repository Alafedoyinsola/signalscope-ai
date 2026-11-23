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
          <div className="section-title-group">
            <svg className="panel-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 className="section-title">LOCAL IN-MEMORY SNAPSHOT BUFFER</h3>
          </div>
          <span className="badge-insufficient font-mono">
            {history.observationCount} / {history.requiredObservations} OBSERVATIONS
          </span>
        </div>
        <p className="history-message font-mono">{history.message}</p>
        <div className="history-footnote text-dim font-mono">
          Continuous local pattern forensics requires a minimum of 5 sampled live observations.
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
        <div className="section-title-group">
          <svg className="panel-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h3 className="section-title">LOCAL INTRADAY SNAPSHOT RADAR</h3>
        </div>
        <span className="badge-sufficient font-mono">
          {observationCount} OBSERVATIONS ({timeRange.durationMinutes}m WINDOW)
        </span>
      </div>

      <div className="history-metrics-grid">
        <div className="history-metric-box">
          <span className="history-box-label">SAMPLED MIN</span>
          <span className="history-box-val font-mono">{formatCurrency(priceRange.min)}</span>
          <span className="history-box-delta text-muted font-mono">
            {formatPercent(priceRange.deltaFromMinPercent)} from min
          </span>
        </div>

        <div className="history-metric-box highlight-box">
          <span className="history-box-label">CURRENT OBSERVED</span>
          <span className="history-box-val font-mono font-bold highlight-value">
            {formatCurrency(priceRange.current)}
          </span>
          <span className="history-box-delta text-muted font-mono">
            {timeRange.durationMinutes} min interval window
          </span>
        </div>

        <div className="history-metric-box">
          <span className="history-box-label">SAMPLED MAX</span>
          <span className="history-box-val font-mono">{formatCurrency(priceRange.max)}</span>
          <span className="history-box-delta text-muted font-mono">
            {formatPercent(priceRange.deltaFromMaxPercent)} from max
          </span>
        </div>
      </div>

      {/* Financial SVG Range Oscillator */}
      <div className="svg-range-container">
        <div className="range-labels font-mono text-dim">
          <span>MIN: {formatCurrency(priceRange.min)}</span>
          <span className="range-center-label font-mono">SPREAD: {formatPercent(((priceSpread / (priceRange.min || 1)) * 100))}</span>
          <span>MAX: {formatCurrency(priceRange.max)}</span>
        </div>
        <svg
          viewBox="0 0 400 20"
          className="range-svg"
          aria-label="Price range relative position"
        >
          {/* Subtle baseline track */}
          <line x1="10" y1="10" x2="390" y2="10" stroke="#243340" strokeWidth="2" strokeLinecap="round" />
          {/* Ticks at 25%, 50%, 75% */}
          <line x1="105" y1="7" x2="105" y2="13" stroke="#1A2733" strokeWidth="1" />
          <line x1="200" y1="5" x2="200" y2="15" stroke="#243340" strokeWidth="1.5" />
          <line x1="295" y1="7" x2="295" y2="13" stroke="#1A2733" strokeWidth="1" />
          {/* Active filled range to current position */}
          <line
            x1="10"
            y1="10"
            x2={Math.round(10 + currentRatio * 380)}
            y2="10"
            stroke="#D6B779"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Current position marker */}
          <circle
            cx={Math.round(10 + currentRatio * 380)}
            cy="10"
            r="5"
            fill="#D6B779"
            stroke="#101820"
            strokeWidth="2"
          />
        </svg>
      </div>

      {volumeRange.min !== null && volumeRange.max !== null && (
        <div className="volume-summary text-dim font-mono">
          <span>OBSERVED VOLUME SPREAD: </span>
          <span className="text-silver">
            {formatCurrency(volumeRange.min)} — {formatCurrency(volumeRange.max)}
          </span>
          <span className="time-window">
            ({formatTimestamp(timeRange.start)} → {formatTimestamp(timeRange.end)})
          </span>
        </div>
      )}

      <p className="disclaimer-text text-dim font-mono">{disclaimer}</p>
    </div>
  )
}
