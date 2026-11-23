import { useMemo } from 'react'
import type { SnapshotRecord } from '../types/market.ts'
import { formatCurrency, formatPercent } from '../utils/formatters.ts'

interface SparklineProps {
  symbol: string
  snapshots?: SnapshotRecord[]
  isLoading?: boolean
  width?: number
  height?: number
  className?: string
}

export function Sparkline({
  symbol,
  snapshots,
  isLoading = false,
  width = 110,
  height = 24,
  className = '',
}: SparklineProps) {
  // Filter for genuine, numeric, strictly positive price points ordered chronologically
  const validObservations = useMemo(() => {
    if (!snapshots || !Array.isArray(snapshots)) return []
    return snapshots
      .filter(
        (s): s is SnapshotRecord =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.price === 'number' &&
          Number.isFinite(s.price) &&
          s.price > 0 &&
          typeof s.epochMs === 'number' &&
          Number.isFinite(s.epochMs)
      )
      .sort((a, b) => a.epochMs - b.epochMs)
  }, [snapshots])

  const observationCount = validObservations.length

  // Requirement 5: Where fewer than five valid historical observations exist,
  // show a restrained "Collecting history" state instead of a misleading chart.
  if (isLoading || observationCount < 5) {
    const tooltipText =
      observationCount > 0
        ? `${symbol}: ${observationCount}/5 required observations collected. Continuous intraday sparkline activates after 5 samples.`
        : `${symbol}: Awaiting local snapshot observations (0/5). Intraday sparkline activates after 5 samples.`

    return (
      <div
        className={`sparkline-container sparkline-empty ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        title={tooltipText}
        aria-label={`${symbol}: Collecting history`}
      >
        <span className="sparkline-collecting font-mono">
          <span className="collecting-indicator" aria-hidden="true">
            ┄
          </span>
          <span>Collecting history</span>
        </span>
      </div>
    )
  }

  // 5 or more genuine observations exist: render precision SVG sparkline
  const prices = validObservations.map((s) => s.price)
  const firstPrice = prices[0]
  const lastPrice = prices[prices.length - 1]
  const priceDiff = lastPrice - firstPrice
  const percentDelta = (priceDiff / (firstPrice || 1)) * 100
  const isPositive = priceDiff >= 0

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice

  const startTime = validObservations[0].epochMs
  const endTime = validObservations[observationCount - 1].epochMs
  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000))

  const paddingX = 4
  const paddingTop = 4
  const paddingBottom = 4
  const drawWidth = width - paddingX * 2
  const drawHeight = height - paddingTop - paddingBottom

  // Generate SVG path coordinates
  const points = validObservations.map((obs, idx) => {
    const x = paddingX + (idx / (observationCount - 1)) * drawWidth
    const y =
      priceRange > 0
        ? paddingTop + drawHeight - ((obs.price - minPrice) / priceRange) * drawHeight
        : paddingTop + drawHeight / 2
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const lastPoint = points[points.length - 1]

  // Subtle filled area polygon under line
  const areaD = `${pathD} L ${lastPoint.x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`

  const strokeColor = isPositive ? 'var(--emerald)' : 'var(--crimson)'
  const fillColor = isPositive ? 'var(--emerald-subtle)' : 'var(--crimson-subtle)'

  const tooltip = `${symbol} Intraday Trend (${observationCount} observations across ${durationMinutes}m window)\nStart: ${formatCurrency(firstPrice)} → Current: ${formatCurrency(lastPrice)}\nDelta: ${formatPercent(percentDelta)} (Low: ${formatCurrency(minPrice)} | High: ${formatCurrency(maxPrice)})`

  return (
    <div
      className={`sparkline-container ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      title={tooltip}
      aria-label={`${symbol} ${isPositive ? 'upward' : 'downward'} trend: ${formatPercent(percentDelta)} over ${durationMinutes} minutes`}
      role="img"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
      >
        {/* Subtle filled area */}
        <path d={areaD} fill={fillColor} />
        {/* Active trendline */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End beacon reticle */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={strokeColor} />
      </svg>
    </div>
  )
}
