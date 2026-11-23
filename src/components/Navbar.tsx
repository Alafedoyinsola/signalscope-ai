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
        <div className="brand-badge">🔬 SIGNAL</div>
        <div>
          <h1 className="brand-title">SignalScope AI</h1>
          <p className="brand-subtitle">Crypto Market Move Forensics & Adversarial Counterarguments</p>
        </div>
      </div>

      <div className="navbar-status">
        <div className="status-pill-group">
          {/* Data Source Badge */}
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
            {isCmcLive ? 'LIVE CMC' : 'MOCK FIXTURE'}
          </span>

          {/* AI Status Badge */}
          <span
            className={`status-pill ${
              isAiConfigured ? 'pill-ai-active' : 'pill-ai-offline'
            }`}
            title={
              isAiConfigured
                ? `AI Counterargument synthesis available via ${health?.upstream.ai?.model}`
                : 'AI synthesis unconfigured. Deterministic forensics active.'
            }
          >
            <span className="status-dot"></span>
            {isAiConfigured
              ? `AI: ${health?.upstream.ai?.model}`
              : 'AI: DETERMINISTIC ONLY'}
          </span>

          {/* Monthly Budget Tracker */}
          {limiter && (
            <div
              className="budget-pill"
              title={`Monthly Budget: ${limiter.monthlyRequestsUsed} used of ${limiter.monthlyRequestBudget} request soft cap`}
            >
              <div className="budget-label">
                <span>Budget:</span>
                <strong>{limiter.monthlyRequestsUsed}</strong>
                <span className="budget-max">/{limiter.monthlyRequestBudget}</span>
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
          title="Refresh market data and anomaly feed"
        >
          {isLoading ? '⟳ Refreshing...' : '↻ Refresh'}
        </button>
      </div>
    </header>
  )
}
