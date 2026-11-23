import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { AnomalyFeed } from './components/AnomalyFeed.tsx'
import { GlobalMarketBanner } from './components/GlobalMarketBanner.tsx'
import { InvestigationView } from './components/InvestigationView.tsx'
import { MarketTable } from './components/MarketTable.tsx'
import { Navbar } from './components/Navbar.tsx'
import { api } from './services/api.ts'
import type {
  AiExplanationResult,
  AnomalySummary,
  InvestigationReport,
} from './types/forensics.ts'
import type {
  MarketOverviewResponse,
  MarketQuote,
  SystemHealthResponse,
} from './types/market.ts'

export function App() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null)
  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null)
  const [quotes, setQuotes] = useState<MarketQuote[]>([])
  const [anomalies, setAnomalies] = useState<AnomalySummary[]>([])

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [investigationReport, setInvestigationReport] =
    useState<InvestigationReport | null>(null)
  const [aiExplanation, setAiExplanation] =
    useState<AiExplanationResult | null>(null)

  const [isLoadingMarket, setIsLoadingMarket] = useState(true)
  const [isLoadingInvestigation, setIsLoadingInvestigation] = useState(false)
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [appError, setAppError] = useState<string | null>(null)

  // Fetch initial market overview, listings, and anomaly feed
  useEffect(() => {
    let ignore = false

    async function fetchInitial() {
      try {
        const [healthData, overviewData, listingsData, anomaliesData] =
          await Promise.allSettled([
            api.getHealth(),
            api.getOverview(),
            api.getListings(50),
            api.getAnomalies(50),
          ])

        if (ignore) return
        if (healthData.status === 'fulfilled') {
          setHealth(healthData.value)
        }
        if (overviewData.status === 'fulfilled') {
          setOverview(overviewData.value)
        }
        if (listingsData.status === 'fulfilled') {
          setQuotes(listingsData.value.quotes)
        }
        if (anomaliesData.status === 'fulfilled') {
          setAnomalies(anomaliesData.value.anomalies)
        }
      } catch (err) {
        if (!ignore) {
          setAppError(
            err instanceof Error ? err.message : 'Failed to fetch market data.'
          )
        }
      } finally {
        if (!ignore) {
          setIsLoadingMarket(false)
        }
      }
    }

    void fetchInitial()
    return () => {
      ignore = true
    }
  }, [])

  // Manual refresh callback
  const handleRefresh = useCallback(async () => {
    setIsLoadingMarket(true)
    setAppError(null)
    try {
      const [healthData, overviewData, listingsData, anomaliesData] =
        await Promise.allSettled([
          api.getHealth(),
          api.getOverview(),
          api.getListings(50),
          api.getAnomalies(50),
        ])

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value)
      }
      if (overviewData.status === 'fulfilled') {
        setOverview(overviewData.value)
      }
      if (listingsData.status === 'fulfilled') {
        setQuotes(listingsData.value.quotes)
      }
      if (anomaliesData.status === 'fulfilled') {
        setAnomalies(anomaliesData.value.anomalies)
      }
    } catch (err) {
      setAppError(
        err instanceof Error ? err.message : 'Failed to fetch market data.'
      )
    } finally {
      setIsLoadingMarket(false)
    }
  }, [])

  // Asset selection and investigation trigger
  const handleSelectAsset = async (symbol: string) => {
    setSelectedSymbol(symbol)
    setIsLoadingInvestigation(true)
    setInvestigationReport(null)
    setAiExplanation(null)
    setAppError(null)

    try {
      const report = await api.getInvestigation(symbol)
      setInvestigationReport(report)
    } catch (err) {
      setAppError(
        `Failed to run forensic investigation on ${symbol}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    } finally {
      setIsLoadingInvestigation(false)
    }
  }

  // Trigger server-side AI counterargument synthesis
  const handleRunAiExplanation = async () => {
    if (!selectedSymbol) return
    setIsLoadingAi(true)
    setAppError(null)

    try {
      const res = await api.getExplanation(selectedSymbol)
      setInvestigationReport(res.report)
      setAiExplanation(res.aiExplanation)
    } catch (err) {
      setAppError(
        `Failed to generate AI synthesis: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    } finally {
      setIsLoadingAi(false)
    }
  }

  const handleCloseInvestigation = () => {
    setSelectedSymbol(null)
    setInvestigationReport(null)
    setAiExplanation(null)
  }

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <Navbar
        health={health}
        dataSource={overview?.dataSource ?? null}
        onRefresh={handleRefresh}
        isLoading={isLoadingMarket}
      />

      {/* Global Market Banner */}
      <GlobalMarketBanner
        metrics={overview?.globalMetrics ?? null}
        dataSource={overview?.dataSource}
      />

      {/* Global Application Alert / Error Notification */}
      {appError && (
        <div className="error-banner">
          <div className="error-icon">⚠️</div>
          <div className="error-text">
            <strong>Application Notice: </strong>
            {appError}
          </div>
          <button
            type="button"
            className="btn-dismiss"
            onClick={() => setAppError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Terminal Body */}
      <main className="main-content">
        {isLoadingInvestigation && (
          <div className="loading-overlay-card">
            <div className="spinner-large"></div>
            <h3>Conducting Forensic Analysis on {selectedSymbol}...</h3>
            <p className="text-muted">
              Evaluating volume-price divergence, volume expansion, benchmark correlation,
              supply disparities, and local snapshot history.
            </p>
          </div>
        )}

        {investigationReport && !isLoadingInvestigation ? (
          <InvestigationView
            report={investigationReport}
            aiExplanation={aiExplanation}
            isLoadingAi={isLoadingAi}
            onRunAiExplanation={handleRunAiExplanation}
            onClose={handleCloseInvestigation}
          />
        ) : (
          !isLoadingInvestigation && (
            <div className="dashboard-grid">
              {/* Left Column: Live Anomaly Feed */}
              <div className="col-anomalies">
                <AnomalyFeed
                  anomalies={anomalies}
                  isLoading={isLoadingMarket}
                  onSelectAsset={handleSelectAsset}
                  selectedSymbol={selectedSymbol}
                />
              </div>

              {/* Right Column: Searchable Market Listings Table */}
              <div className="col-market">
                <MarketTable
                  quotes={quotes}
                  isLoading={isLoadingMarket}
                  onSelectAsset={handleSelectAsset}
                  selectedSymbol={selectedSymbol}
                />
              </div>
            </div>
          )
        )}
      </main>

      {/* Terminal Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <span>SignalScope AI v0.2.0 • Build with CMC API Hackathon</span>
          <span className="footer-disclaimer text-muted">
            Forensic indicators and counterarguments are for research purposes only. Not financial advice.
          </span>
          <span className="footer-status">
            {health?.status === 'healthy' ? '● Engine Operational' : '○ Engine Idle'}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
