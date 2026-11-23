import { useMemo, useState } from 'react'
import type { MarketQuote } from '../types/market.ts'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../utils/formatters.ts'

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

  return (
    <div className="card market-table-card">
      <div className="card-header table-header">
        <div>
          <h2 className="card-title">
            <span className="card-icon">📊</span>
            Tracked Market Assets
          </h2>
          <p className="card-desc">
            Spot prices, rolling window deltas, and liquidity volumes from CoinMarketCap.
          </p>
        </div>

        <div className="table-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search symbol or name (e.g. BTC, Solana)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isLoading && quotes.length === 0 ? (
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Loading market listings...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <p>No cryptocurrency assets matched your search "{search}".</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="market-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-asset">Asset</th>
                <th className="col-price">Price</th>
                <th className="col-change">1h</th>
                <th className="col-change">24h</th>
                <th className="col-change">7d</th>
                <th className="col-volume">24h Volume</th>
                <th className="col-mcap">Market Cap</th>
                <th className="col-action">Action</th>
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
                    <td className="col-rank text-muted">{q.rank ?? '—'}</td>
                    <td className="col-asset">
                      <div className="asset-cell">
                        <strong className="asset-symbol">{q.symbol}</strong>
                        <span className="asset-name text-muted">{q.name}</span>
                      </div>
                    </td>
                    <td className="col-price font-mono font-medium">
                      {formatCurrency(q.price)}
                    </td>
                    <td
                      className={`col-change font-mono ${
                        c1h >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange1h)}
                    </td>
                    <td
                      className={`col-change font-mono font-semibold ${
                        c24h >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange24h)}
                    </td>
                    <td
                      className={`col-change font-mono ${
                        c7d >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatPercent(q.percentChange7d)}
                    </td>
                    <td className="col-volume font-mono text-muted">
                      {formatNumber(q.volume24h)}
                    </td>
                    <td className="col-mcap font-mono text-muted">
                      {formatCurrency(q.marketCap)}
                    </td>
                    <td className="col-action">
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectAsset(q.symbol)
                        }}
                      >
                        Investigate
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
