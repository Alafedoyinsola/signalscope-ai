import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.ts'
import type { MarketQuote, SnapshotRecord } from '../types/market.ts'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../utils/formatters.ts'
import { CryptoLogo } from './CryptoLogo.tsx'
import { Sparkline } from './Sparkline.tsx'

interface MarketTableProps {
  quotes: MarketQuote[]
  isLoading: boolean
  onSelectAsset: (symbol: string) => void
  selectedSymbol: string | null
}

export function MarketTable({
  quotes,
  isLoading,
  onSelectAsset,
  selectedSymbol,
}: MarketTableProps) {
  const [search, setSearch] = useState('')

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes
    const query = search.trim().toLowerCase()
    return quotes.filter(
      (q) =>
        q.symbol.toLowerCase().includes(query) ||
        q.name.toLowerCase().includes(query)
    )
  }, [quotes, search])

  const [snapshotsMap, setSnapshotsMap] = useState<Record<string, SnapshotRecord[]>>({})
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false)

  // Fetch local snapshots for quotes to power genuine intraday sparklines
  useEffect(() => {
    if (quotes.length === 0) return
    let ignore = false

    async function loadSnapshots() {
      setIsLoadingSnapshots(true)
      const fetched: Record<string, SnapshotRecord[]> = {}

      await Promise.allSettled(
        quotes.map(async (q) => {
          try {
            const res = await api.getSnapshots(q.symbol)
            if (!ignore) {
              fetched[q.symbol] = res.snapshots || []
            }
          } catch {
            if (!ignore) {
              fetched[q.symbol] = []
            }
          }
        })
      )

      if (!ignore) {
        setSnapshotsMap((prev) => ({ ...prev, ...fetched }))
        setIsLoadingSnapshots(false)
      }
    }

    void loadSnapshots()

    return () => {
      ignore = true
    }
  }, [quotes])

  return (
    <div className="card market-table-card">
      <div className="table-toolbar">
        <div className="table-title-group">
          <svg className="panel-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <div>
            <h2 className="panel-title">GLOBAL MARKET UNIVERSE</h2>
            <p className="panel-subtitle">Real-time spot quotes, multi-period deltas &amp; liquidity depth</p>
          </div>
        </div>

        <div className="table-controls">
          <div className="search-wrapper">
            <svg className="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Filter universe (e.g. BTC, ETH, Solana)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearch('')}
                title="Clear search query"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading && quotes.length === 0 ? (
        <div className="empty-state">
          <div className="spinner"></div>
          <p className="empty-text">Loading market listings from CoinMarketCap...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-text">No cryptocurrency assets matched your search query "{search}".</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="market-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-asset">ASSET</th>
                <th className="col-trend">INTRADAY TREND</th>
                <th className="col-price text-right">SPOT PRICE</th>
                <th className="col-change text-right">1H</th>
                <th className="col-change text-right">24H</th>
                <th className="col-change text-right">7D</th>
                <th className="col-volume text-right">24H VOLUME</th>
                <th className="col-mcap text-right">MARKET CAP</th>
                <th className="col-action text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const isSelected = selectedSymbol === q.symbol
                const c1h = q.percentChange1h ?? 0
                const c24h = q.percentChange24h ?? 0
                const c7d = q.percentChange7d ?? 0

                return (
                  <tr
                    key={q.symbol}
                    className={`table-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectAsset(q.symbol)}
                  >
                    <td className="col-rank font-mono text-muted">{q.rank ?? '—'}</td>
                    <td className="col-asset">
                      <div className="asset-cell">
                        <CryptoLogo id={q.id} symbol={q.symbol} name={q.name} size={24} />
                        <div className="asset-info">
                          <strong className="asset-symbol">{q.symbol}</strong>
                          <span className="asset-name text-muted">{q.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="col-trend">
                      <Sparkline
                        symbol={q.symbol}
                        snapshots={snapshotsMap[q.symbol]}
                        isLoading={isLoadingSnapshots && !snapshotsMap[q.symbol]}
                      />
                    </td>
                    <td className="col-price font-mono font-medium text-right">
                      {formatCurrency(q.price)}
                    </td>
                    <td
                      className={`col-change font-mono text-right ${
                        c1h >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange1h)}
                    </td>
                    <td
                      className={`col-change font-mono font-semibold text-right ${
                        c24h >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange24h)}
                    </td>
                    <td
                      className={`col-change font-mono text-right ${
                        c7d >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange7d)}
                    </td>
                    <td className="col-volume font-mono text-silver text-right">
                      {formatNumber(q.volume24h)}
                    </td>
                    <td className="col-mcap font-mono text-silver text-right">
                      {formatCurrency(q.marketCap)}
                    </td>
                    <td className="col-action text-right">
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectAsset(q.symbol)
                        }}
                      >
                        <span>DOSSIER</span>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="7" y1="17" x2="17" y2="7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
