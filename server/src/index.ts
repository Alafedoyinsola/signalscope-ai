import express, { type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config/env.ts'
import forensicsRoutes from './routes/forensicsRoutes.ts'
import marketRoutes from './routes/marketRoutes.ts'
import { cacheService } from './services/cacheService.ts'
import { cmcClient } from './services/cmcClient.ts'
import { rateLimiter } from './services/rateLimiter.ts'
import { snapshotBuffer } from './services/snapshotBuffer.ts'

const app = express()

// JSON middleware
app.use(express.json())

// Mount API routes
app.use('/api/market', marketRoutes)
app.use('/api/forensics', forensicsRoutes)

// Decoupled Health Endpoint
// Separates local application health and internal protection stats from upstream CMC API status
app.get('/api/health', (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage()
  const upstreamStatus = cmcClient.getUpstreamStatus()
  const limiterStats = rateLimiter.getStats()
  const cacheStats = cacheService.getStats()
  const snapshotStats = snapshotBuffer.getStats()

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: {
      name: 'signalscope-backend',
      version: '0.2.0',
      memoryUsageMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      cache: cacheStats,
      rateLimiter: {
        requestsInLastMinute: limiterStats.requestsInLastMinute,
        rateLimitPerMinute: limiterStats.rateLimitPerMinute,
        monthlyRequestsUsed: limiterStats.monthlyRequestsUsed,
        monthlyRequestBudget: limiterStats.monthlyRequestBudget,
        actualCreditsReported: limiterStats.actualCreditsReported,
      },
      snapshotPolicy: {
        collectionActive: true,
        trackedAssets: snapshotStats.trackedAssets,
        totalSnapshots: snapshotStats.totalSnapshots,
        maxObservationsPerAsset: snapshotStats.maxObservationsPerAsset,
        maxAgeHours: snapshotStats.maxAgeHours,
        theoreticalOneMinuteWindowMinutes: snapshotStats.theoreticalOneMinuteWindowMinutes,
        note: `A capacity of ${snapshotStats.maxObservationsPerAsset} observations yields at most ${snapshotStats.maxObservationsPerAsset} minutes of continuous history only if sampled at 1-minute intervals.`,
      },
    },
    upstream: {
      coinMarketCap: {
        configured: upstreamStatus.configured,
        connectivityStatus: upstreamStatus.connectivityStatus,
        lastPingTimestamp: upstreamStatus.lastPingTimestamp,
        lastHttpResponseCode: upstreamStatus.lastHttpResponseCode,
        entitlements: {
          latestListings: upstreamStatus.configured ? 'available' : 'disabled',
          latestQuotes: upstreamStatus.configured ? 'available' : 'disabled',
          globalMetrics: upstreamStatus.configured ? 'available' : 'disabled',
          historicalSeries: 'untested', // Subject to verification test, not assumed
        },
      },
      ai: {
        configured: config.ai.apiKey !== null,
        model: config.ai.model,
        baseUrl: config.ai.baseUrl,
      },
    },
  })
})

// Production Static File Serving & Single-Service SPA Routing
if (config.nodeEnv === 'production') {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const distPath = path.resolve(__dirname, '../../dist')

  if (fs.existsSync(distPath)) {
    // Serve pre-built static client assets
    app.use(express.static(distPath))

    // Fall back non-API routes to dist/index.html for client-side routing
    app.get('{*splat}', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api')) {
        return next()
      }
      res.sendFile(path.join(distPath, 'index.html'))
    })
  } else {
    console.warn(
      `[SignalScope Backend] NODE_ENV is production but dist directory was not found at: ${distPath}. Run "npm run build" first.`
    )
  }
}

// Fallback 404 handler for unhandled API endpoints
app.all('/api/{*splat}', (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    statusCode: 404,
  })
})

// Start server
const server = app.listen(config.port, () => {
  console.log(`[SignalScope Backend] Listening on port ${config.port} (Environment: ${config.nodeEnv})`)
  console.log(
    `[SignalScope Backend] CMC API Key configured: ${
      config.cmcApiKey !== null ? 'Yes' : 'No (Upstream CMC calls disabled)'
    }`
  )
  console.log(
    `[SignalScope Backend] AI Explanation configured: ${
      config.ai.apiKey !== null ? `Yes (${config.ai.model} via ${config.ai.baseUrl})` : 'No (Deterministic analysis only)'
    }`
  )
})

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[SignalScope Backend] SIGTERM received. Shutting down gracefully...')
  server.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[SignalScope Backend] SIGINT received. Shutting down gracefully...')
  server.close(() => {
    process.exit(0)
  })
})

export default app
