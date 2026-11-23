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
import { CryptoLogo } from './CryptoLogo.tsx'
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
      {/* Top Breadcrumb & Status Bar */}
      <div className="investigation-top-bar">
        <button type="button" className="btn-back" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>RETURN TO MARKET UNIVERSE</span>
        </button>

        <div className="investigation-badges">
          <span className={`badge-source font-mono ${isLive ? 'badge-live' : 'badge-mock'}`}>
            <span className="status-dot"></span>
            {isLive ? 'SOURCE: LIVE COINMARKETCAP' : 'SOURCE: MOCK FIXTURE'}
          </span>
          <span className="badge-timestamp font-mono text-dim">
            EVALUATED: {formatTimestamp(report.generatedAt)}
          </span>
        </div>
      </div>

      {/* Asset Command Dossier Hero Card */}
      <div className="card asset-hero-card">
        <div className="hero-main-row">
          <div className="hero-identity">
            <div className="hero-symbol-row">
              <CryptoLogo id={asset.id} symbol={asset.symbol} name={asset.name} size={28} />
              <span className="hero-rank font-mono">#{asset.rank ?? '—'}</span>
              <h2 className="hero-symbol">{asset.symbol}</h2>
              <span className="hero-name text-muted">{asset.name}</span>
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
                {formatPercent(quote.percentChange24h)} (24H)
              </span>
            </div>
          </div>

          {/* Rolling Window Multi-Period Grid */}
          <div className="rolling-windows-grid">
            <div className="window-box">
              <span className="window-label font-mono">1 HOUR</span>
              <span
                className={`window-value font-mono ${
                  (quote.percentChange1h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange1h)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label font-mono">24 HOURS</span>
              <span
                className={`window-value font-mono font-bold ${
                  (quote.percentChange24h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange24h)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label font-mono">7 DAYS</span>
              <span
                className={`window-value font-mono ${
                  (quote.percentChange7d ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPercent(quote.percentChange7d)}
              </span>
            </div>
            <div className="window-box">
              <span className="window-label font-mono">30 DAYS</span>
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

        {/* Fundamental Statistics & Valuation Metrics */}
        <div className="hero-stats-row">
          <div className="stat-item">
            <span className="stat-label font-mono">24H VOLUME</span>
            <span className="stat-value font-mono">{formatCurrency(quote.volume24h)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label font-mono">VOLUME DELTA (24H)</span>
            <span
              className={`stat-value font-mono ${
                (quote.volumeChange24h ?? 0) >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {formatPercent(quote.volumeChange24h)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label font-mono">MARKET CAP</span>
            <span className="stat-value font-mono">{formatCurrency(quote.marketCap)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label font-mono">FDV</span>
            <span className="stat-value font-mono">{formatCurrency(quote.fdv)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label font-mono">CIRCULATING SUPPLY</span>
            <span className="stat-value font-mono">
              {formatNumber(quote.circulatingSupply)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label font-mono">TOTAL SUPPLY</span>
            <span className="stat-value font-mono">{formatNumber(quote.totalSupply)}</span>
          </div>
        </div>

        {/* BTC Benchmark Alpha Strip */}
        <div className="benchmark-strip">
          <div className="benchmark-title-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="benchmark-title font-mono">BENCHMARK COMPARISON // BTC CORRELATION:</span>
          </div>
          <div className="benchmark-details font-mono">
            <span>
              BTC 24h Move: <strong className="text-silver">{formatPercent(benchmark.btcPercentChange24h)}</strong>
            </span>
            <span>
              Relative Alpha / Divergence:{' '}
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

      {/* Local Snapshot Intraday History Oscillator */}
      <LocalHistoryCard history={localHistory} />

      {/* Prominent Counterargument & Meta AI Synthesis */}
      <CounterargumentViewer
        aiExplanation={aiExplanation}
        assessment={assessment}
        isLoadingAi={isLoadingAi}
        onRunAiExplanation={onRunAiExplanation}
        symbol={asset.symbol}
      />

      {/* Deterministic Indicators & Evidence Matrix */}
      <div className="card indicators-section">
        <div className="indicators-header">
          <div>
            <div className="section-pill-row">
              <span className="pill-ground-truth font-mono">
                DETERMINISTIC GROUND TRUTH MATRIX
              </span>
              <span className="pill-rules font-mono">Mathematical Rules Verification</span>
            </div>
            <h3 className="section-title-large">
              Detected Forensic Indicators ({indicators.detected.length})
            </h3>
            <p className="section-subtitle">
              Calculated without heuristic speculation. Every indicator is fully traceable to exact formulas, thresholds, and market data.
            </p>
          </div>

          {/* Evidence Category Filter Tabs */}
          <div className="tab-group">
            <button
              type="button"
              className={`tab-btn font-mono ${activeEvidenceTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('all')}
            >
              ALL ({indicators.detected.length})
            </button>
            <button
              type="button"
              className={`tab-btn font-mono ${activeEvidenceTab === 'supporting' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('supporting')}
            >
              SUPPORTING ({indicators.supportingEvidence.length})
            </button>
            <button
              type="button"
              className={`tab-btn font-mono ${activeEvidenceTab === 'contradictory' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('contradictory')}
            >
              CONTRADICTORY ({indicators.contradictoryEvidence.length})
            </button>
            <button
              type="button"
              className={`tab-btn font-mono ${activeEvidenceTab === 'unavailable' ? 'active' : ''}`}
              onClick={() => setActiveEvidenceTab('unavailable')}
            >
              MISSING ({indicators.unavailableEvidence.length})
            </button>
          </div>
        </div>

        {/* Render Indicators or Empty/Missing State */}
        {activeEvidenceTab === 'unavailable' ? (
          <div className="unavailable-dimensions-list">
            {indicators.unavailableEvidence.length === 0 ? (
              <p className="empty-text font-mono">All forensic evidence dimensions are verified and fully present.</p>
            ) : (
              indicators.unavailableEvidence.map((unav, idx) => (
                <div key={idx} className="unavailable-card">
                  <div className="unav-header">
                    <svg className="unav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    <strong className="unav-dimension font-mono">{unav.dimension}</strong>
                  </div>
                  <p className="unav-reason text-muted">
                    <strong>Reason:</strong> {unav.reason}
                  </p>
                  <p className="unav-impact font-mono">
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
                    <p className="empty-text font-mono">No indicators match the selected evidence filter.</p>
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
