import type { DetectedIndicator } from '../types/forensics.ts'
import { formatTimestamp } from '../utils/formatters.ts'

interface IndicatorCardProps {
  indicator: DetectedIndicator
}

export function IndicatorCard({ indicator }: IndicatorCardProps) {
  const isSupporting = indicator.category === 'SUPPORTING'
  const isContradictory = indicator.category === 'CONTRADICTORY'

  return (
    <div
      className={`indicator-card ${
        isSupporting
          ? 'indicator-supporting'
          : isContradictory
            ? 'indicator-contradictory'
            : 'indicator-neutral'
      }`}
    >
      <div className="indicator-top-row">
        <div className="indicator-title-group">
          <span className="indicator-badge-category">
            {isSupporting ? '✓ SUPPORTING' : isContradictory ? '⚠ CONTRADICTORY' : '● NEUTRAL'}
          </span>
          <h4 className="indicator-name">{indicator.name}</h4>
        </div>
        <span
          className={`indicator-significance sig-${indicator.significance.toLowerCase()}`}
          title={`Indicator Significance: ${indicator.significance}`}
        >
          {indicator.significance} IMPACT
        </span>
      </div>

      <p className="indicator-explanation">{indicator.explanation}</p>

      {/* Traceable Threshold Condition */}
      <div className="indicator-threshold-box">
        <span className="threshold-label">RULE / THRESHOLD:</span>
        <code className="threshold-code">{indicator.threshold}</code>
      </div>

      {/* Measured Metrics */}
      {indicator.measuredMetrics.length > 0 && (
        <div className="indicator-metrics-grid">
          {indicator.measuredMetrics.map((m) => (
            <div key={m.field} className="metric-pill">
              <span className="metric-pill-label">{m.label}</span>
              <span className="metric-pill-value font-mono">{m.formatted}</span>
            </div>
          ))}
        </div>
      )}

      <div className="indicator-footer">
        <span className="indicator-timestamp">
          Observed: {formatTimestamp(indicator.evidenceTimestamp)}
        </span>
      </div>
    </div>
  )
}
