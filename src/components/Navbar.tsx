import type { SystemHealthResponse } from '../types/market.ts'

interface NavbarProps {
  health: SystemHealthResponse | null
  dataSource: 'live_cmc' | 'mock_fixture' | null
  onRefresh: () => void
  isLoading: boolean
}

export function Navbar({ health, dataSource, onRefresh, isLoading }: NavbarProps) {
  const isCmcLive = dataSource === 'live_cmc'
  const isAiConfigured = health?.upstream.ai?.configured ?? false
  const limiter = health?.service.rateLimiter
  const budgetPercent =
    limiter && limiter.monthlyRequestBudget > 0
      ? Math.min(100, Math.round((limiter.monthlyRequestsUsed / limiter.monthlyRequestBudget) * 100))
      : 0

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.4" />
          </svg>
        </div>
        <div className="brand-text-block">
          <div className="brand-title-row">
            <h1 className="brand-title">SIGNALSCOPE<span className="brand-title-accent"> // AI</span></h1>
            <span className="brand-version">v0.2.0</span>
          </div>
          <p className="brand-subtitle">MARKET MOVE FORENSICS &amp; ADVERSARIAL COUNTERARGUMENTS</p>
        </div>
      </div>

      <div className="navbar-status">
        <div className="status-pill-group">
          {/* Data Pipeline Source Badge */}
          <span
            className={`status-pill ${
              isCmcLive ? 'pill-live' : 'pill-mock'
            }`}
            title={
              isCmcLive
                ? 'Connected to live CoinMarketCap API'
                : 'Using simulated CoinMarketCap mock fixtures (Upstream calls disabled)'
            }
          >
            <span className="status-dot"></span>
            <span className="status-pill-text">{isCmcLive ? 'CMC: LIVE FEED' : 'CMC: MOCK FIXTURE'}</span>
          </span>

          {/* AI Model Synthesis Badge */}
          <span
            className={`status-pill ${
              isAiConfigured ? 'pill-ai-active' : 'pill-ai-offline'
            }`}
            title={
              isAiConfigured
                ? `AI synthesis active via ${health?.upstream.ai?.model}`
                : 'AI synthesis unconfigured. Deterministic forensics active.'
            }
          >
            <svg className="pill-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="status-pill-text">
              {isAiConfigured
                ? `AI: ${health?.upstream.ai?.model}`
                : 'AI: DETERMINISTIC ONLY'}
            </span>
          </span>

          {/* Monthly Request Budget Telemetry */}
          {limiter && (
            <div
              className="budget-pill"
              title={`Monthly Budget: ${limiter.monthlyRequestsUsed} requests used of ${limiter.monthlyRequestBudget} soft cap`}
            >
              <div className="budget-label">
                <span className="budget-tag">BUDGET</span>
                <span className="budget-count font-mono">{limiter.monthlyRequestsUsed}</span>
                <span className="budget-max font-mono">/{limiter.monthlyRequestBudget}</span>
              </div>
              <div className="budget-bar-bg">
                <div
                  className="budget-bar-fill"
                  style={{ width: `${budgetPercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh market universe and anomaly feed"
        >
          <svg
            className={`btn-refresh-icon ${isLoading ? 'animate-spin' : ''}`}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>{isLoading ? 'SYNCING...' : 'SYNC'}</span>
        </button>
      </div>
    </header>
  )
}
