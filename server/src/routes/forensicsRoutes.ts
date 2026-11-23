import { Router, type Request, type Response } from 'express'
import { aiService } from '../services/aiService.ts'
import { cmcClient } from '../services/cmcClient.ts'
import { forensicsEngine } from '../services/forensicsEngine.ts'
import type { MarketQuote } from '../types/cmc.ts'
import type {
  AnomaliesResponse,
  AnomalySummary,
  InvestigationAndExplanationResponse,
} from '../types/forensics.ts'
import { handleRouteError, parseLimitParam, sanitizeSymbol } from './marketRoutes.ts'

const router = Router()

/**
 * GET /api/forensics/investigate/:symbol
 * Comprehensive forensic market-move investigation report for an asset.
 */
router.get('/investigate/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = sanitizeSymbol(req.params.symbol)

    // Fetch target asset quote
    const targetRes = await cmcClient.getQuote(symbol)
    const targetQuote = targetRes.quote

    // Fetch BTC benchmark quote (if target is not already BTC)
    let btcQuote: MarketQuote | null = null
    if (symbol === 'BTC') {
      btcQuote = targetQuote
    } else {
      try {
        const btcRes = await cmcClient.getQuote('BTC')
        btcQuote = btcRes.quote
      } catch {
        // BTC benchmark unavailable: forensics engine handles gracefully
        btcQuote = null
      }
    }

    const report = forensicsEngine.generateReport(
      targetQuote,
      btcQuote,
      targetRes.dataSource
    )

    res.json(report)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * POST /api/forensics/explain/:symbol
 * Retrieves the deterministic investigation report and enriches it with
 * adversarial AI counterargument synthesis.
 */
router.post('/explain/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = sanitizeSymbol(req.params.symbol)

    // Fetch target asset quote
    const targetRes = await cmcClient.getQuote(symbol)
    const targetQuote = targetRes.quote

    // Fetch BTC benchmark quote (if target is not already BTC)
    let btcQuote: MarketQuote | null = null
    if (symbol === 'BTC') {
      btcQuote = targetQuote
    } else {
      try {
        const btcRes = await cmcClient.getQuote('BTC')
        btcQuote = btcRes.quote
      } catch {
        btcQuote = null
      }
    }

    const report = forensicsEngine.generateReport(
      targetQuote,
      btcQuote,
      targetRes.dataSource
    )

    // Run AI synthesis (gracefully handles unconfigured / errors without throwing)
    const aiExplanation = await aiService.generateExplanation(report)

    const responsePayload: InvestigationAndExplanationResponse = {
      report,
      aiExplanation,
    }

    res.json(responsePayload)
  } catch (err) {
    handleRouteError(err, res)
  }
})

/**
 * GET /api/forensics/anomalies
 * Scans top market listings for active forensic indicators.
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const limit = parseLimitParam(req.query.limit, 50)
    const listingsRes = await cmcClient.getListings(limit)
    const quotes = listingsRes.quotes

    // Extract or find BTC benchmark quote from the listing set
    const btcQuote = quotes.find((q) => q.symbol === 'BTC') || null

    const anomalies: AnomalySummary[] = []
    const now = new Date().toISOString()

    for (const quote of quotes) {
      const { detected } = forensicsEngine.evaluateIndicators(quote, btcQuote, now)

      if (detected.length > 0) {
        anomalies.push({
          symbol: quote.symbol,
          name: quote.name,
          price: quote.price,
          percentChange24h: quote.percentChange24h,
          volume24h: quote.volume24h,
          detectedIndicatorCount: detected.length,
          indicators: detected.map((ind) => ({
            id: ind.id,
            name: ind.name,
            explanation: ind.explanation,
            threshold: ind.threshold,
          })),
          dataSource: listingsRes.dataSource,
        })
      }
    }

    // Rank anomalies by detected indicator count (descending)
    anomalies.sort((a, b) => b.detectedIndicatorCount - a.detectedIndicatorCount)

    const responsePayload: AnomaliesResponse = {
      dataSource: listingsRes.dataSource,
      evaluatedAssetCount: quotes.length,
      anomalyCount: anomalies.length,
      timestamp: now,
      anomalies,
    }

    res.json(responsePayload)
  } catch (err) {
    handleRouteError(err, res)
  }
})

export default router
