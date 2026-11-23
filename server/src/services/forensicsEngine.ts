import type { MarketQuote } from '../types/cmc.ts'
import type {
  AssessmentResult,
  DetectedIndicator,
  HistoricalComparisonResult,
  InvestigationReport,
  MeasuredMetric,
  UnavailableEvidence,
} from '../types/forensics.ts'
import { snapshotBuffer } from './snapshotBuffer.ts'

/**
 * Centralized, documented indicator thresholds.
 * Strictly immutable configuration.
 */
export const FORENSIC_THRESHOLDS = {
  // 1. Volume-price divergence: price change of at least +5% or -5%, combined with volume change of -15% or lower.
  VOLUME_PRICE_DIVERGENCE: {
    MIN_ABS_PRICE_CHANGE_24H: 5.0,
    MAX_VOLUME_CHANGE_24H: -15.0,
  },
  // 2. Volume expansion: absolute price change of at least 5% and volume change of at least +75%.
  VOLUME_EXPANSION: {
    MIN_ABS_PRICE_CHANGE_24H: 5.0,
    MIN_VOLUME_CHANGE_24H: 75.0,
  },
  // 3. Benchmark divergence: asset absolute 24-hour change of at least 8%, while BTC absolute 24-hour change is at most 1.5%.
  BENCHMARK_DIVERGENCE: {
    MIN_ABS_ASSET_CHANGE_24H: 8.0,
    MAX_ABS_BTC_CHANGE_24H: 1.5,
  },
  // 4. Supply/valuation disparity: circulating supply / total supply <= 0.30 OR market cap / FDV <= 0.35
  SUPPLY_VALUATION_DISPARITY: {
    MAX_CIRCULATING_RATIO: 0.30,
    MAX_MCAP_FDV_RATIO: 0.35,
  },
  // 5. Momentum deceleration: 24-hour price increase >= 12% combined with 1-hour change <= -2.5%
  MOMENTUM_DECELERATION: {
    MIN_PRICE_CHANGE_24H: 12.0,
    MAX_PRICE_CHANGE_1H: -2.5,
  },
} as const

export class ForensicsEngine {
  /**
   * Evaluates all 5 deterministic market move indicators for a given asset.
   */
  public evaluateIndicators(
    quote: MarketQuote,
    btcQuote: MarketQuote | null,
    timestamp: string = new Date().toISOString()
  ): {
    detected: DetectedIndicator[]
    supporting: DetectedIndicator[]
    contradictory: DetectedIndicator[]
    unavailable: UnavailableEvidence[]
  } {
    const detected: DetectedIndicator[] = []
    const supporting: DetectedIndicator[] = []
    const contradictory: DetectedIndicator[] = []
    const unavailable: UnavailableEvidence[] = []

    const isPositiveMomentum = (quote.percentChange24h ?? 0) >= 0

    // 1. Volume-Price Divergence
    if (quote.percentChange24h !== null && quote.volumeChange24h !== null) {
      const absPriceChange = Math.abs(quote.percentChange24h)
      const t = FORENSIC_THRESHOLDS.VOLUME_PRICE_DIVERGENCE

      if (absPriceChange >= t.MIN_ABS_PRICE_CHANGE_24H && quote.volumeChange24h <= t.MAX_VOLUME_CHANGE_24H) {
        const metrics: MeasuredMetric[] = [
          {
            field: 'percentChange24h',
            label: '24h Price Change',
            value: quote.percentChange24h,
            formatted: `${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}%`,
          },
          {
            field: 'volumeChange24h',
            label: '24h Volume Change',
            value: quote.volumeChange24h,
            formatted: `${quote.volumeChange24h >= 0 ? '+' : ''}${quote.volumeChange24h.toFixed(2)}%`,
          },
        ]

        const indicator: DetectedIndicator = {
          id: 'VOLUME_PRICE_DIVERGENCE',
          name: 'Volume-Price Divergence',
          category: 'CONTRADICTORY', // Diverging volume contradicts the sustainability of price movement
          significance: 'HIGH',
          explanation: `Price moved by ${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}% while 24h trading volume contracted by ${quote.volumeChange24h.toFixed(2)}%, indicating weaker volume participation during the move.`,
          measuredMetrics: metrics,
          threshold: `|ΔP 24h| >= ${t.MIN_ABS_PRICE_CHANGE_24H}% AND ΔV 24h <= ${t.MAX_VOLUME_CHANGE_24H}%`,
          evidenceTimestamp: timestamp,
        }

        detected.push(indicator)
        contradictory.push(indicator)
      }
    } else {
      if (quote.volumeChange24h === null) {
        unavailable.push({
          dimension: '24h Volume Delta',
          reason: 'Volume change percentage not provided by upstream quote for this asset.',
          impact: 'Volume-price divergence and volume expansion indicators cannot be evaluated.',
        })
      }
    }

    // 2. Volume Expansion
    if (quote.percentChange24h !== null && quote.volumeChange24h !== null) {
      const absPriceChange = Math.abs(quote.percentChange24h)
      const t = FORENSIC_THRESHOLDS.VOLUME_EXPANSION

      if (absPriceChange >= t.MIN_ABS_PRICE_CHANGE_24H && quote.volumeChange24h >= t.MIN_VOLUME_CHANGE_24H) {
        const metrics: MeasuredMetric[] = [
          {
            field: 'percentChange24h',
            label: '24h Price Change',
            value: quote.percentChange24h,
            formatted: `${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}%`,
          },
          {
            field: 'volumeChange24h',
            label: '24h Volume Change',
            value: quote.volumeChange24h,
            formatted: `+${quote.volumeChange24h.toFixed(2)}%`,
          },
        ]

        const indicator: DetectedIndicator = {
          id: 'VOLUME_EXPANSION',
          name: 'Volume-Backed Expansion',
          category: 'SUPPORTING', // Expanding volume supports the conviction of the move
          significance: 'HIGH',
          explanation: `Price moved by ${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}% alongside a +${quote.volumeChange24h.toFixed(2)}% surge in 24h volume, confirming heightened market turnover.`,
          measuredMetrics: metrics,
          threshold: `|ΔP 24h| >= ${t.MIN_ABS_PRICE_CHANGE_24H}% AND ΔV 24h >= +${t.MIN_VOLUME_CHANGE_24H}%`,
          evidenceTimestamp: timestamp,
        }

        detected.push(indicator)
        supporting.push(indicator)
      }
    }

    // 3. Benchmark Divergence
    if (quote.percentChange24h !== null) {
      if (btcQuote && btcQuote.percentChange24h !== null) {
        const absAssetChange = Math.abs(quote.percentChange24h)
        const absBtcChange = Math.abs(btcQuote.percentChange24h)
        const t = FORENSIC_THRESHOLDS.BENCHMARK_DIVERGENCE

        if (absAssetChange >= t.MIN_ABS_ASSET_CHANGE_24H && absBtcChange <= t.MAX_ABS_BTC_CHANGE_24H) {
          const metrics: MeasuredMetric[] = [
            {
              field: 'assetPercentChange24h',
              label: `${quote.symbol} 24h Change`,
              value: quote.percentChange24h,
              formatted: `${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}%`,
            },
            {
              field: 'btcPercentChange24h',
              label: 'BTC Benchmark 24h Change',
              value: btcQuote.percentChange24h,
              formatted: `${btcQuote.percentChange24h >= 0 ? '+' : ''}${btcQuote.percentChange24h.toFixed(2)}%`,
            },
          ]

          const category: 'SUPPORTING' | 'CONTRADICTORY' = isPositiveMomentum ? 'SUPPORTING' : 'CONTRADICTORY'

          const indicator: DetectedIndicator = {
            id: 'BENCHMARK_DIVERGENCE',
            name: 'Benchmark Decoupling',
            category,
            significance: 'MEDIUM',
            explanation: `${quote.symbol} moved by ${quote.percentChange24h >= 0 ? '+' : ''}${quote.percentChange24h.toFixed(2)}% while benchmark BTC remained subdued (${btcQuote.percentChange24h >= 0 ? '+' : ''}${btcQuote.percentChange24h.toFixed(2)}%), indicating asset-specific dispersion rather than broad market drift.`,
            measuredMetrics: metrics,
            threshold: `|ΔP Asset 24h| >= ${t.MIN_ABS_ASSET_CHANGE_24H}% AND |ΔP BTC 24h| <= ${t.MAX_ABS_BTC_CHANGE_24H}%`,
            evidenceTimestamp: timestamp,
          }

          detected.push(indicator)
          if (category === 'SUPPORTING') {
            supporting.push(indicator)
          } else {
            contradictory.push(indicator)
          }
        }
      } else {
        unavailable.push({
          dimension: 'BTC Benchmark Comparison',
          reason: 'BTC benchmark quote unavailable or lacking 24h delta.',
          impact: 'Benchmark divergence indicator cannot be evaluated.',
        })
      }
    } else {
      unavailable.push({
        dimension: '24h Price Delta',
        reason: 'Asset 24h price change is missing.',
        impact: 'Core price momentum and divergence indicators cannot be evaluated.',
      })
    }

    // 4. Supply / Valuation Disparity
    const tSupply = FORENSIC_THRESHOLDS.SUPPLY_VALUATION_DISPARITY
    let supplyRatio: number | null = null
    let mcapFdvRatio: number | null = null

    if (quote.circulatingSupply !== null && quote.totalSupply !== null && quote.totalSupply > 0) {
      supplyRatio = quote.circulatingSupply / quote.totalSupply
    }

    if (quote.marketCap !== null && quote.fdv !== null && quote.fdv > 0) {
      mcapFdvRatio = quote.marketCap / quote.fdv
    }

    const hasSupplyDisparity = supplyRatio !== null && supplyRatio <= tSupply.MAX_CIRCULATING_RATIO
    const hasMcapDisparity = mcapFdvRatio !== null && mcapFdvRatio <= tSupply.MAX_MCAP_FDV_RATIO

    if (hasSupplyDisparity || hasMcapDisparity) {
      const metrics: MeasuredMetric[] = []
      if (supplyRatio !== null) {
        metrics.push({
          field: 'circulatingRatio',
          label: 'Circulating / Total Supply Ratio',
          value: Math.round(supplyRatio * 1000) / 1000,
          formatted: `${(supplyRatio * 100).toFixed(1)}%`,
        })
      }
      if (mcapFdvRatio !== null) {
        metrics.push({
          field: 'mcapFdvRatio',
          label: 'Market Cap / FDV Ratio',
          value: Math.round(mcapFdvRatio * 1000) / 1000,
          formatted: `${(mcapFdvRatio * 100).toFixed(1)}%`,
        })
      }

      // Supply overhang acts as contradictory headwind against upward rallies,
      // or supporting evidence of structural dilution pressure during selloffs
      const category: 'SUPPORTING' | 'CONTRADICTORY' = isPositiveMomentum ? 'CONTRADICTORY' : 'SUPPORTING'

      const indicator: DetectedIndicator = {
        id: 'SUPPLY_VALUATION_DISPARITY',
        name: 'Supply/Valuation Disparity',
        category,
        significance: 'MEDIUM',
        explanation: `Circulating supply represents a low proportion of total/fully-diluted issuance (${supplyRatio !== null ? `${(supplyRatio * 100).toFixed(1)}% circulating` : ''}${supplyRatio !== null && mcapFdvRatio !== null ? ', ' : ''}${mcapFdvRatio !== null ? `${(mcapFdvRatio * 100).toFixed(1)}% Mcap/FDV` : ''}), highlighting potential exposure to token unlocks or supply overhang.`,
        measuredMetrics: metrics,
        threshold: `Circulating/Total <= ${(tSupply.MAX_CIRCULATING_RATIO * 100).toFixed(0)}% OR Mcap/FDV <= ${(tSupply.MAX_MCAP_FDV_RATIO * 100).toFixed(0)}%`,
        evidenceTimestamp: timestamp,
      }

      detected.push(indicator)
      if (category === 'SUPPORTING') {
        supporting.push(indicator)
      } else {
        contradictory.push(indicator)
      }
    } else if (supplyRatio === null && mcapFdvRatio === null) {
      unavailable.push({
        dimension: 'Total Supply / FDV',
        reason: 'Asset lacks total supply and fully diluted valuation data.',
        impact: 'Supply overhang and dilution disparity cannot be computed.',
      })
    }

    // 5. Momentum Deceleration
    if (quote.percentChange24h !== null && quote.percentChange1h !== null) {
      const t = FORENSIC_THRESHOLDS.MOMENTUM_DECELERATION
      if (quote.percentChange24h >= t.MIN_PRICE_CHANGE_24H && quote.percentChange1h <= t.MAX_PRICE_CHANGE_1H) {
        const metrics: MeasuredMetric[] = [
          {
            field: 'percentChange24h',
            label: '24h Price Change',
            value: quote.percentChange24h,
            formatted: `+${quote.percentChange24h.toFixed(2)}%`,
          },
          {
            field: 'percentChange1h',
            label: '1h Price Change',
            value: quote.percentChange1h,
            formatted: `${quote.percentChange1h.toFixed(2)}%`,
          },
        ]

        const indicator: DetectedIndicator = {
          id: 'MOMENTUM_DECELERATION',
          name: 'Short-Term Momentum Deceleration',
          category: 'CONTRADICTORY', // Intraday pullback contradicts 24h strength
          significance: 'HIGH',
          explanation: `24-hour price expanded by +${quote.percentChange24h.toFixed(2)}%, but the 1-hour delta pulled back by ${quote.percentChange1h.toFixed(2)}%, indicating short-term momentum deceleration.`,
          measuredMetrics: metrics,
          threshold: `ΔP 24h >= +${t.MIN_PRICE_CHANGE_24H}% AND ΔP 1h <= ${t.MAX_PRICE_CHANGE_1H}%`,
          evidenceTimestamp: timestamp,
        }

        detected.push(indicator)
        contradictory.push(indicator)
      }
    } else if (quote.percentChange1h === null) {
      unavailable.push({
        dimension: '1h Price Delta',
        reason: '1-hour price change percentage missing from quote.',
        impact: 'Intraday momentum deceleration cannot be evaluated.',
      })
    }

    return { detected, supporting, contradictory, unavailable }
  }

  /**
   * Calculates data completeness percentage across 10 standard dimensions.
   */
  public calculateCompleteness(quote: MarketQuote, btcQuote: MarketQuote | null): number {
    const dimensions = [
      quote.price !== null && typeof quote.price === 'number',
      quote.percentChange24h !== null && typeof quote.percentChange24h === 'number',
      quote.percentChange1h !== null && typeof quote.percentChange1h === 'number',
      quote.percentChange7d !== null && typeof quote.percentChange7d === 'number',
      quote.volume24h !== null && typeof quote.volume24h === 'number',
      quote.volumeChange24h !== null && typeof quote.volumeChange24h === 'number',
      quote.marketCap !== null && typeof quote.marketCap === 'number',
      quote.circulatingSupply !== null && typeof quote.circulatingSupply === 'number',
      (quote.totalSupply !== null || quote.maxSupply !== null),
      btcQuote !== null && btcQuote.percentChange24h !== null,
    ]

    const presentCount = dimensions.filter(Boolean).length
    return Math.round((presentCount / dimensions.length) * 100)
  }

  /**
   * Computes evidence conflict percentage and analytical assessment rating.
   */
  public computeAssessment(
    completenessPercent: number,
    supportingCount: number,
    contradictoryCount: number
  ): AssessmentResult {
    const totalActiveIndicators = supportingCount + contradictoryCount

    // Compute conflict percent where directional signals exist
    let evidenceConflictPercent: number | null = null
    if (totalActiveIndicators > 0) {
      evidenceConflictPercent = Math.round((contradictoryCount / totalActiveIndicators) * 100)
    }

    // Determine Analytical Assessment rating
    let confidenceRating: AssessmentResult['confidenceRating']
    let explanation: string

    if (completenessPercent < 50) {
      confidenceRating = 'INCONCLUSIVE'
      explanation = 'Data completeness is below 50%. Insufficient market metrics exist to establish analytical confidence.'
    } else if (completenessPercent >= 80 && (evidenceConflictPercent === null || evidenceConflictPercent <= 20)) {
      confidenceRating = 'HIGH'
      explanation = 'High data completeness with minimal signal contradiction across observed market indicators.'
    } else if (completenessPercent >= 60 && (evidenceConflictPercent === null || evidenceConflictPercent <= 40)) {
      confidenceRating = 'MODERATE'
      explanation = 'Adequate data completeness with moderate directional alignment among observed indicators.'
    } else {
      confidenceRating = 'TENTATIVE'
      explanation = evidenceConflictPercent !== null && evidenceConflictPercent > 40
        ? `Observed indicators exhibit high signal conflict (${evidenceConflictPercent}% contradictory evidence), indicating market ambiguity.`
        : 'Data completeness is marginal (50-60%), resulting in tentative analytical confidence.'
    }

    return {
      dataCompletenessPercent: completenessPercent,
      evidenceConflictPercent,
      confidenceRating,
      explanation,
    }
  }

  /**
   * Evaluates local temporal comparison using ONLY genuine live_cmc snapshots.
   */
  public evaluateHistoricalComparison(symbol: string): HistoricalComparisonResult {
    const snapshots = snapshotBuffer.getSnapshots(symbol)

    // Require at least 5 observations
    if (snapshots.length < 5) {
      return {
        status: 'INSUFFICIENT_OBSERVATIONS',
        source: 'live_cmc',
        observationCount: snapshots.length,
        requiredObservations: 5,
        message: 'Local historical comparison requires at least 5 live observations. Local history is currently accumulating.',
      }
    }

    const prices = snapshots.map((s) => s.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const currentPrice = snapshots[snapshots.length - 1].price

    const volumes = snapshots.map((s) => s.volume24h).filter((v): v is number => v !== null)
    const minVolume = volumes.length > 0 ? Math.min(...volumes) : null
    const maxVolume = volumes.length > 0 ? Math.max(...volumes) : null
    const currentVolume = snapshots[snapshots.length - 1].volume24h

    const startEpoch = snapshots[0].epochMs
    const endEpoch = snapshots[snapshots.length - 1].epochMs
    const durationMinutes = Math.max(1, Math.round((endEpoch - startEpoch) / 60000))

    const deltaFromMinPercent = minPrice > 0 ? Math.round(((currentPrice - minPrice) / minPrice) * 10000) / 100 : 0
    const deltaFromMaxPercent = maxPrice > 0 ? Math.round(((currentPrice - maxPrice) / maxPrice) * 10000) / 100 : 0

    return {
      status: 'SUFFICIENT_OBSERVATIONS',
      source: 'live_cmc',
      observationCount: snapshots.length,
      timeRange: {
        start: snapshots[0].timestamp,
        end: snapshots[snapshots.length - 1].timestamp,
        durationMinutes,
      },
      priceRange: {
        min: minPrice,
        max: maxPrice,
        current: currentPrice,
        deltaFromMinPercent,
        deltaFromMaxPercent,
      },
      volumeRange: {
        min: minVolume,
        max: maxVolume,
        current: currentVolume,
      },
      disclaimer: 'Locally collected runtime history. Past local price and volume movement does not predict future market outcomes.',
    }
  }

  /**
   * Generates a complete forensic investigation report for an asset.
   */
  public generateReport(
    quote: MarketQuote,
    btcQuote: MarketQuote | null,
    dataSource: 'live_cmc' | 'mock_fixture'
  ): InvestigationReport {
    const timestamp = new Date().toISOString()
    const { detected, supporting, contradictory, unavailable } = this.evaluateIndicators(
      quote,
      btcQuote,
      timestamp
    )

    const completeness = this.calculateCompleteness(quote, btcQuote)
    const assessment = this.computeAssessment(completeness, supporting.length, contradictory.length)
    const localHistory = this.evaluateHistoricalComparison(quote.symbol)

    let relative24hDelta: number | null = null
    if (quote.percentChange24h !== null && btcQuote && btcQuote.percentChange24h !== null) {
      relative24hDelta = Math.round((quote.percentChange24h - btcQuote.percentChange24h) * 100) / 100
    }

    return {
      asset: {
        id: quote.id,
        name: quote.name,
        symbol: quote.symbol,
        slug: quote.slug,
        rank: quote.rank,
      },
      quote,
      dataSource,
      benchmark: {
        symbol: 'BTC',
        btcPrice: btcQuote?.price ?? null,
        btcPercentChange24h: btcQuote?.percentChange24h ?? null,
        relative24hDelta,
      },
      indicators: {
        detected,
        supportingEvidence: supporting,
        contradictoryEvidence: contradictory,
        unavailableEvidence: unavailable,
      },
      assessment,
      localHistory,
      generatedAt: timestamp,
    }
  }
}

// Global singleton instance for forensics engine
export const forensicsEngine = new ForensicsEngine()
