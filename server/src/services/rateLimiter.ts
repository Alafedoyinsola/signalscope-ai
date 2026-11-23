import { config } from '../config/env.ts'
import {
  BudgetPersistence,
  BudgetPersistenceError,
  type BudgetState,
} from './budgetPersistence.ts'

export interface RateLimiterStats {
  requestsInLastMinute: number
  rateLimitPerMinute: number
  monthlyRequestsUsed: number
  monthlyRequestBudget: number
  actualCreditsReported: number
  budgetExceeded: boolean
  utcMonth: string
}

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number

  constructor(message: string, retryAfterSeconds: number) {
    super(message)
    this.name = 'RateLimitExceededError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class RequestBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestBudgetExceededError'
  }
}

export class RateLimiter {
  readonly maxRequestsPerMinute: number
  readonly monthlyBudget: number
  readonly persistence: BudgetPersistence
  private requestTimestamps: number[] = []
  private readonly windowDurationMs = 60000 // 1 minute sliding window

  constructor(
    maxRequestsPerMinute: number = config.rateLimitPerMinute,
    monthlyBudget: number = config.monthlyRequestBudget,
    persistence?: BudgetPersistence
  ) {
    this.maxRequestsPerMinute = maxRequestsPerMinute
    this.monthlyBudget = monthlyBudget
    this.persistence = persistence || new BudgetPersistence()
  }

  /**
   * Checks whether an outgoing upstream request is permitted under
   * both the per-minute rate limit and the persistent monthly request budget.
   *
   * Increments and persists the attempted request counter BEFORE returning,
   * guaranteeing that a process restart cannot erase an already-authorized request.
   * If persistence fails, throws BudgetPersistenceError, blocking dispatch.
   */
  public checkAndAcquire(): void {
    const now = Date.now()

    // 1. Prune timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowDurationMs
    )

    // 2. Load current persistent budget state
    const state = this.persistence.getState()

    // 3. Check monthly request budget
    if (state.attemptedRequestsCount >= this.monthlyBudget) {
      throw new RequestBudgetExceededError(
        `[RateLimiter] Monthly upstream request budget reached (${state.attemptedRequestsCount}/${this.monthlyBudget} requests for ${state.utcMonth}). Further upstream calls blocked.`
      )
    }

    // 4. Check per-minute rate limit
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0]
      const retryAfterMs = oldestTimestamp + this.windowDurationMs - now
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

      throw new RateLimitExceededError(
        `[RateLimiter] Application rate limit reached (${this.requestTimestamps.length}/${this.maxRequestsPerMinute} req/min). Retry after ${retryAfterSeconds}s.`,
        retryAfterSeconds
      )
    }

    // 5. Pre-persist the incremented request count BEFORE allowing dispatch.
    // If saving fails, this throws BudgetPersistenceError and blocks dispatch.
    const updatedState: BudgetState = {
      ...state,
      attemptedRequestsCount: state.attemptedRequestsCount + 1,
      lastUpdated: new Date().toISOString(),
    }
    this.persistence.saveState(updatedState)

    // 6. Record rate-limit sliding window timestamp
    this.requestTimestamps.push(now)
  }

  /**
   * Records the actual credit count returned by the live CMC API response status,
   * without assuming batching cost or credit pricing.
   */
  public recordActualCredits(creditCount: number): void {
    if (Number.isSafeInteger(creditCount) && creditCount >= 0) {
      const state = this.persistence.getState()
      const updatedState: BudgetState = {
        ...state,
        cumulativeActualCredits: state.cumulativeActualCredits + creditCount,
        lastUpdated: new Date().toISOString(),
      }
      this.persistence.saveState(updatedState)
    }
  }

  /**
   * Returns current limiter and persistent budget statistics.
   */
  public getStats(): RateLimiterStats {
    const now = Date.now()
    const activeRecent = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowDurationMs
    ).length

    const state = this.persistence.getState()

    return {
      requestsInLastMinute: activeRecent,
      rateLimitPerMinute: this.maxRequestsPerMinute,
      monthlyRequestsUsed: state.attemptedRequestsCount,
      monthlyRequestBudget: this.monthlyBudget,
      actualCreditsReported: state.cumulativeActualCredits,
      budgetExceeded: state.attemptedRequestsCount >= this.monthlyBudget,
      utcMonth: state.utcMonth,
    }
  }

  /**
   * Resets in-memory sliding window timestamps (for testing).
   */
  public resetWindow(): void {
    this.requestTimestamps = []
  }
}

// Global singleton instance for backend services
export const rateLimiter = new RateLimiter()
export { BudgetPersistenceError }
