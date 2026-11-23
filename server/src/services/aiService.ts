import { config as appConfig } from '../config/env.ts'
import type {
  AiExplanationData,
  AiExplanationResult,
  InvestigationReport,
} from '../types/forensics.ts'

export interface AiServiceConfig {
  apiKey: string | null
  baseUrl: string
  model: string
  timeoutMs: number
}

const SYSTEM_PROMPT = `You are SignalScope AI's Counterargument & Forensic Investigation Engine.
Your role is to perform rigorous, balanced, adversarial financial analysis on cryptocurrency market moves.

GROUNDING RULES:
1. Strict Ground Truth: You MUST base your analysis exclusively on the provided deterministic forensics report and CoinMarketCap quote data.
2. No Inventions: Never invent unprovided prices, volumes, market dates, order books, news events, or metrics.
3. No Contradictions: Never contradict the deterministic indicators, measured thresholds, or confidence ratings evaluated by the engine.
4. No Financial Advice or Predictions: Never predict future prices, give buy/sell recommendations, or provide financial advice.
5. Counterargument Focus: Act as a skeptical market forensic analyst. Actively challenge the obvious narrative. For every bullish or bearish thesis, formulate a rigorous counterargument, alternative structural explanations (e.g., thin liquidity whipsaw, wash trading artifacts, derivative liquidation cascade, market maker rebalancing), and pinpoint missing evidence required for definitive confirmation.

You must respond ONLY with a valid JSON object matching this schema:
{
  "mainInterpretation": "A concise, objective thesis explaining what the deterministic indicators show about this asset's current price and volume action.",
  "supportingCase": [
    "Specific observation or indicator directly supporting this thesis",
    "Another supporting metric from the report"
  ],
  "counterargument": "A skeptical, adversarial counter-thesis challenging the primary narrative. Explain why this move might be a false signal, structural artifact, or misleading anomaly.",
  "alternativeExplanations": [
    "Alternative hypothesis 1 (e.g. liquidity mismatch or low float impact)",
    "Alternative hypothesis 2 (e.g. broader market correlation or liquidation cascade)"
  ],
  "missingEvidence": [
    "Key unobserved data point that would confirm or refute the thesis (e.g., spot order book depth, exchange netflows)",
    "Another missing data dimension"
  ],
  "uncertainty": {
    "rating": "HIGH" | "MODERATE" | "TENTATIVE" | "INCONCLUSIVE",
    "reasons": [
      "Key factor contributing to analytical uncertainty"
    ]
  }
}`

export class AiService {
  private config: AiServiceConfig
  private customFetch?: typeof fetch

  constructor(cfg: AiServiceConfig = appConfig.ai, customFetch?: typeof fetch) {
    this.config = cfg
    this.customFetch = customFetch
  }

  /**
   * Builds the structured ground-truth user prompt from the deterministic investigation report.
   */
  public buildGroundingPrompt(report: InvestigationReport): string {
    const { asset, quote, benchmark, indicators, assessment, localHistory } = report

    return JSON.stringify(
      {
        asset: {
          symbol: asset.symbol,
          name: asset.name,
          rank: asset.rank,
        },
        marketQuote: {
          price: quote.price,
          percentChange1h: quote.percentChange1h,
          percentChange24h: quote.percentChange24h,
          percentChange7d: quote.percentChange7d,
          percentChange30d: quote.percentChange30d,
          volume24h: quote.volume24h,
          volumeChange24h: quote.volumeChange24h,
          marketCap: quote.marketCap,
          fullyDilutedValuation: quote.fdv,
          circulatingSupply: quote.circulatingSupply,
          totalSupply: quote.totalSupply,
        },
        benchmarkComparison: {
          benchmarkSymbol: benchmark.symbol,
          btc24hChange: benchmark.btcPercentChange24h,
          relative24hDelta: benchmark.relative24hDelta,
        },
        deterministicIndicators: {
          detectedCount: indicators.detected.length,
          detected: indicators.detected.map((ind) => ({
            id: ind.id,
            name: ind.name,
            category: ind.category,
            significance: ind.significance,
            explanation: ind.explanation,
            threshold: ind.threshold,
            metrics: ind.measuredMetrics,
          })),
          contradictoryEvidenceCount: indicators.contradictoryEvidence.length,
          contradictoryEvidence: indicators.contradictoryEvidence.map((ind) => ({
            id: ind.id,
            name: ind.name,
            explanation: ind.explanation,
          })),
          unavailableEvidenceCount: indicators.unavailableEvidence.length,
          unavailableEvidence: indicators.unavailableEvidence,
        },
        engineAssessment: {
          dataCompletenessPercent: assessment.dataCompletenessPercent,
          evidenceConflictPercent: assessment.evidenceConflictPercent,
          confidenceRating: assessment.confidenceRating,
          explanation: assessment.explanation,
        },
        localSnapshotHistory: {
          status: localHistory.status,
          observationCount: localHistory.observationCount,
        },
      },
      null,
      2
    )
  }

  /**
   * Generates AI forensic synthesis grounded strictly in the deterministic report.
   * If AI is unconfigured or fails, returns a safe fallback result without throwing.
   */
  public async generateExplanation(
    report: InvestigationReport
  ): Promise<AiExplanationResult> {
    if (!this.config.apiKey || this.config.apiKey.trim().length === 0) {
      return {
        status: 'unavailable',
        reason:
          'AI synthesis is unconfigured (AI_API_KEY is not set). Deterministic forensic analysis remains fully available.',
      }
    }

    const endpoint = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const userPrompt = this.buildGroundingPrompt(report)

    const requestBody = {
      model: this.config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this forensic market investigation for ${report.asset.symbol} strictly according to your grounding rules:\n\n${userPrompt}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }

    const fetchFn = this.customFetch ?? globalThis.fetch

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })

      if (!response.ok) {
        let errMessage = `HTTP ${response.status} ${response.statusText}`
        try {
          const errBody = (await response.json()) as { error?: { message?: string } }
          if (errBody?.error?.message) {
            errMessage = errBody.error.message
          }
        } catch {
          // Non-JSON error body handled gracefully
        }

        return {
          status: 'error',
          reason: `Upstream AI provider error: ${errMessage}`,
        }
      }

      const responseData = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const rawContent = responseData.choices?.[0]?.message?.content
      if (!rawContent || typeof rawContent !== 'string') {
        return {
          status: 'error',
          reason: 'Upstream AI provider returned an empty or invalid completion response.',
        }
      }

      const parsedData = this.parseAndValidateCompletion(rawContent, report)
      return {
        status: 'available',
        model: this.config.model,
        provider: this.config.baseUrl.includes('openai.com')
          ? 'OpenAI'
          : this.config.baseUrl.includes('groq.com')
            ? 'Groq'
            : this.config.baseUrl.includes('openrouter.ai')
              ? 'OpenRouter'
              : 'OpenAI-Compatible Provider',
        explanation: parsedData,
        generatedAt: new Date().toISOString(),
      }
    } catch (err) {
      const isTimeout =
        (err instanceof Error && err.name === 'TimeoutError') ||
        (err instanceof Error && err.name === 'AbortError')

      return {
        status: 'error',
        reason: isTimeout
          ? `AI synthesis request timed out after ${this.config.timeoutMs}ms.`
          : `Failed to contact AI provider: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  /**
   * Safely parses JSON from completion content, handling markdown code fences and schema validation.
   */
  public parseAndValidateCompletion(
    content: string,
    report: InvestigationReport
  ): AiExplanationData {
    // Strip markdown code fences if present (e.g. ```json ... ```)
    let cleaned = content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      throw new Error('AI completion could not be parsed as valid JSON.')
    }

    const mainInterpretation =
      typeof parsed.mainInterpretation === 'string' && parsed.mainInterpretation.trim().length > 0
        ? parsed.mainInterpretation.trim()
        : `Forensic indicators for ${report.asset.symbol} reflect active market move conditions.`

    const supportingCase = Array.isArray(parsed.supportingCase)
      ? parsed.supportingCase.filter((item): item is string => typeof item === 'string')
      : []

    const counterargument =
      typeof parsed.counterargument === 'string' && parsed.counterargument.trim().length > 0
        ? parsed.counterargument.trim()
        : 'Counterargument analysis indicates unconfirmed volume or liquidity conditions require skepticism.'

    const alternativeExplanations = Array.isArray(parsed.alternativeExplanations)
      ? parsed.alternativeExplanations.filter((item): item is string => typeof item === 'string')
      : []

    const missingEvidence = Array.isArray(parsed.missingEvidence)
      ? parsed.missingEvidence.filter((item): item is string => typeof item === 'string')
      : []

    const uncertaintyObj =
      parsed.uncertainty && typeof parsed.uncertainty === 'object'
        ? (parsed.uncertainty as Record<string, unknown>)
        : {}

    const validRatings = ['HIGH', 'MODERATE', 'TENTATIVE', 'INCONCLUSIVE'] as const
    const ratingCandidate = String(uncertaintyObj.rating || '').toUpperCase()
    const rating = validRatings.includes(ratingCandidate as (typeof validRatings)[number])
      ? (ratingCandidate as (typeof validRatings)[number])
      : report.assessment.confidenceRating

    const reasons = Array.isArray(uncertaintyObj.reasons)
      ? uncertaintyObj.reasons.filter((item): item is string => typeof item === 'string')
      : [report.assessment.explanation]

    return {
      mainInterpretation,
      supportingCase:
        supportingCase.length > 0
          ? supportingCase
          : report.indicators.detected.map((i) => `${i.name}: ${i.explanation}`),
      counterargument,
      alternativeExplanations:
        alternativeExplanations.length > 0
          ? alternativeExplanations
          : ['Broader market correlation or liquidity fluctuations may explain part of the movement.'],
      missingEvidence:
        missingEvidence.length > 0
          ? missingEvidence
          : report.indicators.unavailableEvidence.map((u) => `${u.dimension}: ${u.impact}`),
      uncertainty: {
        rating,
        reasons,
      },
    }
  }
}

export const aiService = new AiService()
