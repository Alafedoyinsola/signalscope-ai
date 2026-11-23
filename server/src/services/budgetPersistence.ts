import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BudgetState {
  utcMonth: string // "YYYY-MM"
  attemptedRequestsCount: number
  cumulativeActualCredits: number
  lastUpdated: string
}

export class BudgetPersistenceError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'BudgetPersistenceError'
    this.cause = cause
  }
}

/**
 * Returns current UTC month formatted as "YYYY-MM".
 */
export function getCurrentUtcMonth(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Default state file location in project root.
 */
function getDefaultStatePath(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '../../../.budget-state.json')
}

/**
 * Validates budget state shape and field values.
 */
function validateStateShape(data: unknown): data is BudgetState {
  if (!data || typeof data !== 'object') {
    return false
  }
  const obj = data as Record<string, unknown>
  if (typeof obj.utcMonth !== 'string' || !/^\d{4}-\d{2}$/.test(obj.utcMonth)) {
    return false
  }
  if (
    typeof obj.attemptedRequestsCount !== 'number' ||
    !Number.isSafeInteger(obj.attemptedRequestsCount) ||
    obj.attemptedRequestsCount < 0
  ) {
    return false
  }
  if (
    typeof obj.cumulativeActualCredits !== 'number' ||
    !Number.isSafeInteger(obj.cumulativeActualCredits) ||
    obj.cumulativeActualCredits < 0
  ) {
    return false
  }
  if (typeof obj.lastUpdated !== 'string' || obj.lastUpdated.trim() === '') {
    return false
  }
  return true
}

/**
 * Dedicated persistence manager for monthly budget accounting.
 * Supports a single backend process.
 */
export class BudgetPersistence {
  readonly filePath: string
  private cachedState: BudgetState | null = null

  constructor(filePath?: string) {
    this.filePath = filePath || getDefaultStatePath()
  }

  /**
   * Reads or initializes the persistent budget state.
   * If the file is missing, creates a fresh record for the current UTC month.
   * If the file exists and is corrupted/invalid, throws BudgetPersistenceError.
   * If the file exists and the UTC month has changed, resets the monthly counters.
   */
  public loadState(): BudgetState {
    const currentMonth = getCurrentUtcMonth()

    if (!fs.existsSync(this.filePath)) {
      const freshState: BudgetState = {
        utcMonth: currentMonth,
        attemptedRequestsCount: 0,
        cumulativeActualCredits: 0,
        lastUpdated: new Date().toISOString(),
      }
      this.saveState(freshState)
      this.cachedState = freshState
      return freshState
    }

    let parsed: unknown
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      parsed = JSON.parse(raw)
    } catch (readErr) {
      throw new BudgetPersistenceError(
        `Failed to read budget state file at ${this.filePath}. File may be corrupted or unreadable. Refusing to silently reset budget.`,
        readErr
      )
    }

    if (!validateStateShape(parsed)) {
      throw new BudgetPersistenceError(
        `Budget state file at ${this.filePath} contains malformed or invalid data structure. Refusing to silently reset budget.`
      )
    }

    // Check for UTC month boundary rollover
    if (parsed.utcMonth !== currentMonth) {
      const rolledState: BudgetState = {
        utcMonth: currentMonth,
        attemptedRequestsCount: 0,
        cumulativeActualCredits: 0,
        lastUpdated: new Date().toISOString(),
      }
      this.saveState(rolledState)
      this.cachedState = rolledState
      return rolledState
    }

    this.cachedState = parsed
    return parsed
  }

  /**
   * Safely writes state to disk using a temporary file followed by rename.
   */
  public saveState(state: BudgetState): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
    const serialized = JSON.stringify(state, null, 2)

    try {
      fs.writeFileSync(tempPath, serialized, 'utf-8')
      try {
        fs.renameSync(tempPath, this.filePath)
      } catch {
        // Fallback for Windows filesystem locks
        fs.copyFileSync(tempPath, this.filePath)
        try {
          fs.unlinkSync(tempPath)
        } catch {
          // Ignore temp cleanup errors
        }
      }
      this.cachedState = state
    } catch (writeErr) {
      // Ensure temp file cleanup on failure
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath)
        }
      } catch {
        // Ignore cleanup error
      }
      throw new BudgetPersistenceError(
        `Failed to persist budget state to ${this.filePath}. Blocking upstream dispatch.`,
        writeErr
      )
    }
  }

  /**
   * Returns current state, loading it from disk if not yet loaded.
   */
  public getState(): BudgetState {
    if (!this.cachedState) {
      return this.loadState()
    }
    // Re-verify month hasn't rolled over during long runtime
    const currentMonth = getCurrentUtcMonth()
    if (this.cachedState.utcMonth !== currentMonth) {
      return this.loadState()
    }
    return this.cachedState
  }
}
