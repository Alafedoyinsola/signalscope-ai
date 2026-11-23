import { useState } from 'react'
import type {
  AiExplanationResult,
  InvestigationReport,
} from '../types/forensics.ts'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatTimestamp,
} from '../utils/formatters.ts'
import { CounterargumentViewer } from './CounterargumentViewer.tsx'
import { IndicatorCard } from './IndicatorCard.tsx'
import { LocalHistoryCard } from './LocalHistoryCard.tsx'

interface InvestigationViewProps {
  report: InvestigationReport
  aiExplanation: AiExplanationResult | null
  isLoadingAi: boolean
  onRunAiExplanation: () => void
  onClose: () => void
}

export function InvestigationView({
  report,
  aiExplanation,
  isLoadingAi,
  onRunAiExplanation,
  onClose,
}: InvestigationViewProps) {
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<
    'all' | 'supporting' | 'contradictory' | 'unavailable'
  >('all')

  const { asset, quote, benchmark, indicators, assessment, localHistory, dataSource } =
    report

  const isLive = dataSource === 'live_cmc'
  const c24h = quote.percentChange24h ?? 0
  const isBullish = c24h >= 0

  return (
    <div className="investigation-container">
      {/* Top Navigation & Close Bar */}
      <div className="investigation-top-bar">
        <button type="button" className="btn-back" onClick={onClose}>
          ← Back to Market Table
        </button>
        <div className="investigation-badges">
          <span className={`badge-source ${isLive ? 'badge-live' : 'badge-mock'}`}>
            ● {isLive ? 'LIVE COINMARKETCAP' : 'MOCK FIXTURE'}
          </span>
          <span className="badge-timestamp text-muted">
            Generated: {formatTimestamp(report.generatedAt)}
          </span>
        </div>
      </div>

      {/* Hero Asset Card */}
      <div className="card asset-hero-card">
        <div className="hero-main-row">
          <div className="hero-identity">
            <div className="hero-symbol-row">
              <span className="hero-rank">#{asset.rank ?? '—'}</span>
              <h2 className="hero-symbol">{asset.symbol}</h2>
              <span className="hero-name">{asset.name}</span>
            </div>
            <div className="hero-price-row">
              <span className="hero-price font-mono font-bold">
                {formatCurrency(quote.price)}
              </span>
              <span
                className={`hero-change-pill font-mono ${
                  isBullish ? 'pill-positive' : 'pill-negative'
                }`}
              >
                {formatPercent(quote.percentChange24h)} (24h)
              </span>
            </div>
          </div>

          {/* Rolling Window Matrix */}
          <div className="rolling-windows-grid">
            <div className="window-box">
              <span className="window-label">1 HOUR</span>
              <span
                className={`window-value font-mono ${
                  (quote.percentChange1h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange1h)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label">24 HOURS</span>
              <span
                className={`window-value font-mono font-bold ${
                  (quote.percentChange24h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange24h)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label">7 DAYS</span>
              <span
                className={`window-value font-mono ${
                  (quote.percentChange7d ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange7d)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label">30 DAYS</span>
              <span
                className={`window-value font-mono ${
                  (quote.percentChange30d ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange30d)}
              </span>
            </div>
          </div>
        </div>

        {/* Fundamental & Liquidity Stats */}
        <div className="hero-stats-row">
          <div className="stat-item">
            <span className="stat-label">24H VOLUME</span>
            <span className="stat-value font-mono">{formatCurrency(quote.volume24h)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">VOLUME DELTA (24H)</span>
            <span
              className={`stat-value font-mono ${
                (quote.volumeChange24h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {formatPercent(quote.volumeChange24h)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">MARKET CAP</span>
            <span className="stat-value font-mono">{formatCurrency(quote.marketCap)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">FDV</span>
            <span className="stat-value font-mono">{formatCurrency(quote.fdv)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">CIRCULATING SUPPLY</span>
            <span className="stat-value font-mono">
              {formatNumber(quote.circulatingSupply)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">TOTAL SUPPLY</span>
            <span className="stat-value font-mono">{formatNumber(quote.totalSupply)}</span>
          </div>
        </div>

        {/* BTC Benchmark Comparison Strip */}
        <div className="benchmark-strip">
          <span className="benchmark-title">⚡ BENCHMARK COMPARISON (BTC):</span>
          <div className="benchmark-details">
            <span>
              BTC 24h Change: <strong>{formatPercent(benchmark.btcPercentChange24h)}</strong>
            </span>
            <span>
              Relative Alpha / Delta:{' '}
              <strong
                className={
                  (benchmark.relative24hDelta ?? 0) >= 0
                    ? 'text-positive'
                    : 'text-negative'
                }
              >
                {formatPercent(benchmark.relative24hDelta)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Local Snapshot History Component */}
      <LocalHistoryCard history={localHistory} />

      {/* Prominent Counterargument & AI Synthesis Section */}
      <CounterargumentViewer
        aiExplanation={aiExplanation}
        assessment={assessment}
        isLoadingAi={isLoadingAi}
        onRunAiExplanation={onRunAiExplanation}
        symbol={asset.symbol}
      />

      {/* Deterministic Indicators & Evidence Breakdown */}
      <div className="card indicators-section">
        <div className="indicators-header">
          <div>
            <div className="section-pill-row">
              <span className="pill-ground-truth">
                🛡 DETERMINISTIC FORENSIC GROUND TRUTH
              </span>
              <span className="pill-rules">Rule-Engine Evaluated</span>
            </div>
            <h3 className="section-title-large">
              Detected Indicators & Evidence Matrix ({indicators.detected.length})
            </h3>
            <p className="section-subtitle">
              Calculated without probabilistic estimation. All indicators traceable to exact formulas, thresholds, and market data.
            </p>
          </div>

          {/* Evidence Category Filter Tabs */}
          <div className="tab-group">
            <button
              type="button"
              className={`tab-btn ${activeEvidenceTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('all')}
            >
              All Detected ({indicators.detected.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeEvidenceTab === 'supporting' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('supporting')}
            >
              Supporting ({indicators.supportingEvidence.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeEvidenceTab === 'contradictory' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('contradictory')}
            >
              Contradictory ({indicators.contradictoryEvidence.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeEvidenceTab === 'unavailable' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('unavailable')}
            >
              Missing Dimensions ({indicators.unavailableEvidence.length})
            </button>
          </div>
        </div>

        {/* Render Indicators or Empty State */}
        {activeEvidenceTab === 'unavailable' ? (
          <div className="unavailable-dimensions-list">
            {indicators.unavailableEvidence.length === 0 ? (
              <p className="text-muted">All forensic evidence dimensions are fully available.</p>
            ) : (
              indicators.unavailableEvidence.map((unav, idx) => (
                <div key={idx} className="unavailable-card">
                  <div className="unav-header">
                    <span className="unav-icon">∅</span>
                    <strong className="unav-dimension">{unav.dimension}</strong>
                  </div>
                  <p className="unav-reason text-muted">
                    <strong>Reason:</strong> {unav.reason}
                  </p>
                  <p className="unav-impact">
                    <strong>Forensic Impact:</strong> {unav.impact}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="indicators-grid">
            {(() => {
              const listToRender =
                activeEvidenceTab === 'supporting'
                  ? indicators.supportingEvidence
                  : activeEvidenceTab === 'contradictory'
                    ? indicators.contradictoryEvidence
                    : indicators.detected

              if (listToRender.length === 0) {
                return (
                  <div className="empty-state">
                    <p>No indicators match the selected evidence filter.</p>
                  </div>
                )
              }

              return listToRender.map((ind) => (
                <IndicatorCard key={ind.id} indicator={ind} />
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
