# SignalScope AI

**Real-Time Cryptocurrency Market Intelligence & Forensic Analysis Engine**

SignalScope AI is a production-grade cryptocurrency analytics platform combining deterministic market forensics, budget-guarded upstream CoinMarketCap data integration, local historical trend tracking, and grounded AI-assisted narrative explanations.

---

## Table of Contents

1. [Overview & Philosophy](#overview--philosophy)
2. [Architecture](#architecture)
3. [Forensics & Investigation Engine](#forensics--investigation-engine)
4. [Prerequisites & Requirements](#prerequisites--requirements)
5. [Environment Configuration](#environment-configuration)
6. [Security & Secrets Management](#security--secrets-management)
7. [Development Workflow](#development-workflow)
8. [Testing & Quality Assurance](#testing--quality-assurance)
9. [Production Build & Single-Service Deployment](#production-build--single-service-deployment)
10. [Single-Instance Architecture & Operational Limitations](#single-instance-architecture--operational-limitations)

---

## Overview & Philosophy

SignalScope AI prioritizes **deterministic truth before narrative synthesis**:

- **Math-First Forensics:** Every anomaly, divergence, and signal is computed using explicit, deterministic financial algorithms before any AI model is consulted.
- **Strict Evidence Grounding:** AI explanation models never perform unconstrained speculation. Prompts are strictly grounded with calculated metrics, and outputs are validated against strict JSON schemas.
- **Budget & Rate-Limit Safeguards:** Outgoing upstream requests to CoinMarketCap (CMC) are governed by an in-flight request coalescing mutex, multi-tier in-memory TTL caching, a sliding-window rate limiter, and a persistent monthly budget counter to prevent credit overruns on Basic/Free tiers.
- **Zero-Credit Mock Mode:** In the absence of an API key, the platform operates seamlessly using realistic mock fixtures tagged with `dataSource: "mock_fixture"`, ensuring safe offline development and automated testing without consuming external credits.
- **Single-Service Architecture:** The Node.js Express server can serve both the JSON API and the pre-built React/TypeScript single-page application (SPA) from a single deployment process.

---

## Architecture

```
[ Browser / Client SPA ]
       |
       |  (In Production: HTTP GET / & static assets)
       |  (In Development: Vite HMR proxy on port 5173)
       v
+-------------------------------------------------------------+
| Express Application Server (:3001)                          |
|                                                             |
|  +-----------------------+     +--------------------------+ |
|  | /api/market/*         |     | /api/forensics/*         | |
|  | - /global             |     | - /anomalies             | |
|  | - /listings           |     | - /investigate/:symbol   | |
|  | - /quotes             |     | - /explain/:symbol (AI)  | |
|  +-----------------------+     +--------------------------+ |
|                                                             |
|  +--------------------------------------------------------+ |
|  | /api/health (Decoupled System Health & Protection Stats)| |
|  +--------------------------------------------------------+ |
|                                                             |
|  +--------------------------------------------------------+ |
|  | Static Asset Serving & SPA Fallback (dist/index.html)   | |
|  | (Active only when NODE_ENV === 'production')           | |
|  +--------------------------------------------------------+ |
|                                                             |
|  Services Layer:                                            |
|  - CmcClient (Coalescing, In-Memory TTL Cache, Timeouts)   |
|  - RateLimiter (Sliding Window, Soft Monthly Budget)       |
|  - BudgetPersistence (.budget-state.json atomic storage)   |
|  - SnapshotBuffer (In-Memory Circular Buffer per Asset)    |
|  - ForensicsEngine (Deterministic Anomaly Detection)       |
|  - AiService (OpenAI-compatible structured synthesis)      |
+-------------------------------------------------------------+
       |                                      |
       v (When CMC_API_KEY set)               v (When AI_API_KEY set)
[ CoinMarketCap API ]                   [ OpenAI / LLM Provider ]
```

---

## Forensics & Investigation Engine

SignalScope AI analyzes cryptocurrency market data through five deterministic indicators:

1. **Volume-Price Divergence:** Detects price surges or breakdowns lacking volume confirmation (absolute price change >= 5% with volume delta <= -15%).
2. **Volume Expansion:** Detects institutional participation or capitulation (absolute price change >= 5% with volume expansion >= +75%).
3. **Benchmark Divergence:** Evaluates relative performance against Bitcoin (asset moves >= 3% in opposite direction of BTC, or diverges by >= 5%).
4. **Supply/Valuation Disparity:** Evaluates overhang risk between circulating market cap and Fully Diluted Valuation (FDV) alongside low circulating supply (< 40%).
5. **Momentum Deceleration:** Identifies velocity exhaustion where 1-hour momentum conflicts with 24-hour directional trend.

### Synthesis & Counterargument Engine
- **Evidence Completeness:** Scores data reliability from 0% to 100% based on observed dimensions. Completeness below 50% forces an `INCONCLUSIVE` rating.
- **Signal Conflict Score:** Quantifies contradictions between bullish and bearish indicators. High conflict downgrades confidence to `TENTATIVE`.
- **Confidence Classification:** Rated as `HIGH`, `MODERATE`, `TENTATIVE`, or `INCONCLUSIVE`.
- **Deterministic Counterargument:** Synthesizes an adversarial thesis challenging prevailing market sentiment to highlight risks or capitulation opportunities.

---

## Prerequisites & Requirements

- **Runtime:** Node.js v20.x or v24.x LTS
- **Package Manager:** npm v10.x or higher
- **Supported Operating Systems:** Linux, macOS, Windows

---

## Environment Configuration

Configuration is loaded from the root `.env` file via `dotenv`. A template is provided in `.env.example`.

To set up your local configuration:
```bash
cp .env.example .env
```

### Configuration Variables

| Variable | Required | Default | Bounds / Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | No | `3001` | `1024` – `65535` | Local HTTP port for the Express application server. |
| `NODE_ENV` | No | `development` | `development`, `production`, `test` | Controls static file serving, logging, and error output. |
| `CMC_API_KEY` | No | *(empty)* | String | Upstream CoinMarketCap API key. When blank, system runs in mock mode. |
| `CMC_RATE_LIMIT_PER_MINUTE` | No | `25` | `1` – `50` | Outgoing HTTP request limit per minute (sliding window). |
| `CMC_MONTHLY_REQUEST_BUDGET`| No | `10000` | `1` – `100000` | Application-level soft monthly cap on outgoing CMC requests. |
| `CMC_REQUEST_TIMEOUT_MS` | No | `10000` | `1000` – `30000` | Upstream CMC timeout in milliseconds. |
| `CACHE_TTL_GLOBAL_METRICS_SEC` | No | `120` | `5` – `86400` | TTL cache duration for global market data (in seconds). |
| `CACHE_TTL_LISTINGS_SEC` | No | `60` | `5` – `86400` | TTL cache duration for top asset listings (in seconds). |
| `CACHE_TTL_QUOTES_SEC` | No | `30` | `5` – `86400` | TTL cache duration for asset quotes (in seconds). |
| `SNAPSHOT_MAX_OBSERVATIONS_PER_ASSET` | No | `120` | `1` – `1440` | Maximum observations kept in the circular in-memory buffer per asset. |
| `SNAPSHOT_MAX_AGE_HOURS` | No | `24` | `1` – `168` | Eviction threshold for stale historical observations (in hours). |
| `AI_API_KEY` | No | *(empty)* | String | API key for OpenAI or any OpenAI-compatible LLM endpoint. |
| `AI_BASE_URL` | No | `https://api.openai.com/v1` | URL | Upstream LLM base URL. |
| `AI_MODEL` | No | `gpt-4o-mini` | String | Model identifier for AI narrative generation. |
| `AI_TIMEOUT_MS` | No | `15000` | `1000` – `60000` | Timeout for AI synthesis requests in milliseconds. |

---

## Security & Secrets Management

> [!IMPORTANT]
> **API Key Protection:**
> - `CMC_API_KEY` and `AI_API_KEY` must **never** be committed to version control.
> - `.env` and `.budget-state.json` are permanently excluded via `.gitignore`.
> - In hosted production environments (e.g., Render, Railway, Fly.io, AWS, Heroku, Docker), configure `CMC_API_KEY` and `AI_API_KEY` exclusively as **private host environment variables** in your hosting control panel.

### Backend-Only Credential Isolation
- The browser client never receives, sees, or handles API keys.
- All CoinMarketCap and LLM requests are dispatched strictly server-side.
- Error handling sanitize upstream headers and response bodies, ensuring no upstream keys or raw tokens leak to the client or console logs.

---

## Development Workflow

In development, the frontend and backend run as independent, co-operating processes.

### 1. Start the Backend API
```bash
npm run dev:server
```
Runs the Express server with auto-reload (`tsx watch`) on `http://localhost:3001`.

### 2. Start the Frontend Vite Server
In a separate terminal:
```bash
npm run dev:client
```
Runs Vite on `http://localhost:5173` with Hot Module Replacement (HMR). Any call to `/api/*` is automatically proxied to `http://localhost:3001`.

### Mock vs. Live Verification
- **Mock Mode (Default):** When `CMC_API_KEY` is not defined in `.env`, the server uses built-in fixtures. Responses include `"dataSource": "mock_fixture"`, and the UI displays a noticeable `MOCK DATA` badge.
- **Live Mode:** When a valid `CMC_API_KEY` is supplied, live data is fetched from CoinMarketCap. Responses include `"dataSource": "live_cmc"`, and the badge indicates `LIVE CMC`.

---

## Testing & Quality Assurance

SignalScope AI includes an automated test suite, strict TypeScript typing across client and server, and ESLint coverage:

```bash
# Run unit and integration tests (Node.js test runner via tsx)
npm test

# Run ESLint across all TypeScript and React files
npm run lint

# Type-check server code
npm run build:server

# Type-check client and verify production Vite build
npm run build
```

---

## Production Build & Single-Service Deployment

In production, SignalScope AI operates as a unified single service: Express serves both the backend API and the static frontend build.

### Step 1: Build the Client
Compile the TypeScript code and generate the optimized production bundle in `dist/`:
```bash
npm run build
```

### Step 2: Start the Production Server
Start the Express server using the existing dependencies (`tsx`):
```bash
# Linux / macOS / Cloud container
NODE_ENV=production PORT=3001 npm start

# Windows PowerShell
$env:NODE_ENV="production"; npm start
```

### How Single-Service Serving Works:
1. When `NODE_ENV === 'production'`, Express detects the `dist/` directory at the project root.
2. `express.static(distPath)` serves static assets (`/assets/*`, `favicon.svg`, `icons.svg`).
3. Active API routes (`/api/market/*`, `/api/forensics/*`, `/api/health`) take priority and return JSON.
4. Unhandled `/api/*` routes return a structured `404 Not Found` JSON payload.
5. All non-API routes (e.g., `/`, `/anomalies`, `/investigate/:symbol`) fall back to `dist/index.html` to support client-side React SPA routing.

---

## Single-Instance Architecture & Operational Limitations

> [!NOTE]
> Please review these architectural design decisions when sizing or architecting a multi-container deployment:

### 1. In-Memory Snapshot Buffer Resets on Process Restart
- Historical asset quotes are recorded in an in-memory circular buffer (`SnapshotBuffer`).
- **Restart Reset:** If the server process restarts, crashes, or is redeployed, the in-memory buffer resets to zero observations.
- **Threshold Requirement:** The forensics engine requires at least **5 genuine live observations** to perform local intraday trend comparisons. Until 5 observations are captured at the scheduled sampling interval, the API will report:
  ```json
  "history": {
    "status": "INSUFFICIENT_OBSERVATIONS",
    "observationCount": 0,
    "requiredObservations": 5
  }
  ```
- **Clustering:** In multi-container, serverless, or horizontally scaled environments, each instance maintains its own separate in-memory buffer. A shared external time-series database or Redis cache would be required for clustered state sharing.

### 2. Local Filesystem Budget Persistence
- The monthly CMC request counter and timestamp are persisted to `.budget-state.json` in the project root.
- In stateless container platforms (e.g., standard ephemeral containers or serverless functions without persistent volumes), container recycles may reset the local budget file unless a persistent volume is mounted.
- For single-container production hosts (e.g., a VPS, Railway persistent volume, or Docker container with a mounted volume), persistence functions across normal process restarts and preserves monthly usage and UTC month rollover.
