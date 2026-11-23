import type {
  AnomaliesResponse,
  InvestigationAndExplanationResponse,
  InvestigationReport,
} from '../types/forensics.ts'
import type {
  MarketOverviewResponse,
  MarketQuote,
  SystemHealthResponse,
} from '../types/market.ts'

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed: HTTP ${res.status}`
    try {
      const errJson = (await res.json()) as ApiError
      if (errJson && errJson.error) {
        errMsg = errJson.error
      }
    } catch {
      // Fallback to res.statusText
      if (res.statusText) {
        errMsg = `${errMsg} (${res.statusText})`
      }
    }
    throw new Error(errMsg)
  }
  return res.json() as Promise<T>
}

export const api = {
  async getHealth(): Promise<SystemHealthResponse> {
    const res = await fetch('/api/health')
    return handleResponse<SystemHealthResponse>(res)
  },

  async getOverview(): Promise<MarketOverviewResponse> {
    const res = await fetch('/api/market/overview')
    return handleResponse<MarketOverviewResponse>(res)
  },

  async getListings(limit = 50): Promise<{
    dataSource: 'live_cmc' | 'mock_fixture'
    cached: boolean
    quotes: MarketQuote[]
  }> {
    const res = await fetch(`/api/market/listings?limit=${limit}`)
    return handleResponse<{
      dataSource: 'live_cmc' | 'mock_fixture'
      cached: boolean
      quotes: MarketQuote[]
    }>(res)
  },

  async getQuote(symbol: string): Promise<{
    dataSource: 'live_cmc' | 'mock_fixture'
    cached: boolean
    quote: MarketQuote
  }> {
    const res = await fetch(`/api/market/quote/${encodeURIComponent(symbol)}`)
    return handleResponse<{
      dataSource: 'live_cmc' | 'mock_fixture'
      cached: boolean
      quote: MarketQuote
    }>(res)
  },

  async getAnomalies(limit = 50): Promise<AnomaliesResponse> {
    const res = await fetch(`/api/forensics/anomalies?limit=${limit}`)
    return handleResponse<AnomaliesResponse>(res)
  },

  async getInvestigation(symbol: string): Promise<InvestigationReport> {
    const res = await fetch(`/api/forensics/investigate/${encodeURIComponent(symbol)}`)
    return handleResponse<InvestigationReport>(res)
  },

  async getExplanation(symbol: string): Promise<InvestigationAndExplanationResponse> {
    const res = await fetch(`/api/forensics/explain/${encodeURIComponent(symbol)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return handleResponse<InvestigationAndExplanationResponse>(res)
  },
}
