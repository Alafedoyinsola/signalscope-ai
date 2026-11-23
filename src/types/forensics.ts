import type { MarketQuote } from './market.ts'

export type IndicatorType =
  | 'VOLUME_PRICE_DIVERGENCE'
  | 'VOLUME_EXPANSION'
  | 'BENCHMARK_DIVERGENCE'
  | 'SUPPLY_VALUATION_DISPARITY'
  | 'MOMENTUM_DECELERATION'

export type EvidenceCategory = 'SUPPORTING' | 'CONTRADICTORY' | 'UNAVAILABLE'

export interface MeasuredMetric {
  field: string
  label: string
  value: number | string | null
  formatted: string
}

export interface DetectedIndicator {
  id: IndicatorType
  name: string
  category: EvidenceCategory
  significance: 'HIGH' | 'MEDIUM' | 'LOW'
  explanation: string
  measuredMetrics: MeasuredMetric[]
  threshold: string
  evidenceTimestamp: string
}

export interface UnavailableEvidence {
  dimension: string
  reason: string
  impact: string
}

export type AnalyticalAssessment = 'HIGH' | 'MODERATE' | 'TENTATIVE' | 'INCONCLUSIVE'

export interface AssessmentResult {
  dataCompletenessPercent: number
  evidenceConflictPercent: number | null
  confidenceRating: AnalyticalAssessment
  explanation: string
}

export interface InsufficientHistoricalComparison {
  status: 'INSUFFICIENT_OBSERVATIONS'
  source: 'live_cmc'
  observationCount: number
  requiredObservations: number
  message: string
}

export interface SufficientHistoricalComparison {
  status: 'SUFFICIENT_OBSERVATIONS'
  source: 'live_cmc'
  observationCount: number
  timeRange: {
    start: string
    end: string
    durationMinutes: number
  }
  priceRange: {
    min: number
    max: number
    current: number
    deltaFromMinPercent: number
    deltaFromMaxPercent: number
  }
  volumeRange: {
    min: number | null
    max: number | null
    current: number | null
  }
  disclaimer: string
}

export type HistoricalComparisonResult =
  | InsufficientHistoricalComparison
  | SufficientHistoricalComparison

export interface InvestigationReport {
  asset: {
    id: number
    name: string
    symbol: string
    slug: string
    rank: number | null
  }
  quote: MarketQuote
  dataSource: 'live_cmc' | 'mock_fixture'
  benchmark: {
    symbol: 'BTC'
    btcPrice: number | null
    btcPercentChange24h: number | null
    relative24hDelta: number | null
  }
  indicators: {
    detected: DetectedIndicator[]
    supportingEvidence: DetectedIndicator[]
    contradictoryEvidence: DetectedIndicator[]
    unavailableEvidence: UnavailableEvidence[]
  }
  assessment: AssessmentResult
  localHistory: HistoricalComparisonResult
  generatedAt: string
}

export interface AnomalySummary {
  symbol: string
  name: string
  price: number
  percentChange24h: number | null
  volume24h: number | null
  detectedIndicatorCount: number
  indicators: Array<{
    id: IndicatorType
    name: string
    explanation: string
    threshold: string
  }>
  dataSource: 'live_cmc' | 'mock_fixture'
}

export interface AnomaliesResponse {
  dataSource: 'live_cmc' | 'mock_fixture'
  evaluatedAssetCount: number
  anomalyCount: number
  timestamp: string
  anomalies: AnomalySummary[]
}

export interface AiUncertainty {
  rating: AnalyticalAssessment
  reasons: string[]
}

export interface AiExplanationData {
  mainInterpretation: string
  supportingCase: string[]
  counterargument: string
  alternativeExplanations: string[]
  missingEvidence: string[]
  uncertainty: AiUncertainty
}

export interface AiExplanationSuccess {
  status: 'available'
  model: string
  provider: string
  explanation: AiExplanationData
  generatedAt: string
}

export interface AiExplanationUnavailable {
  status: 'unavailable'
  reason: string
}

export interface AiExplanationError {
  status: 'error'
  reason: string
  details?: string
}

export type AiExplanationResult =
  | AiExplanationSuccess
  | AiExplanationUnavailable
  | AiExplanationError

export interface InvestigationAndExplanationResponse {
  report: InvestigationReport
  aiExplanation: AiExplanationResult
}
