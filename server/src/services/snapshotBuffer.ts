import { config } from '../config/env.ts'
import type { MarketQuote, SnapshotRecord } from '../types/cmc.ts'

export class SnapshotBuffer {
  private readonly maxObservations: number
  private readonly maxAgeHours: number
  private buffers = new Map<string, SnapshotRecord[]>()
  private lastRecordTime = new Map<string, number>()
  private readonly minIntervalMs = 60000 // Sample at most once per 60 seconds

  constructor(
    maxObservations: number = config.snapshotPolicy.maxObservationsPerAsset,
    maxAgeHours: number = config.snapshotPolicy.maxAgeHours
  ) {
    this.maxObservations = maxObservations
    this.maxAgeHours = maxAgeHours
  }

  /**
   * Records a snapshot if at least 60 seconds have elapsed since the last observation for this asset.
   * Enforces strict mock isolation: only genuine 'live_cmc' observations are accepted.
   * Evicts entries exceeding maxObservations or older than maxAgeHours.
   */
  public record(
    symbol: string,
    quote: MarketQuote,
    source: 'live_cmc' | 'mock_fixture' = 'live_cmc'
  ): boolean {
    // Strictly prevent mock fixture data from entering the genuine historical buffer
    if (source !== 'live_cmc') {
      return false
    }

    const normalizedSymbol = symbol.toUpperCase().trim()
    const now = Date.now()
    const lastTime = this.lastRecordTime.get(normalizedSymbol) || 0

    // Throttle sampling: at most one sample per 60 seconds
    if (now - lastTime < this.minIntervalMs) {
      return false
    }

    const records = this.buffers.get(normalizedSymbol) || []
    const maxAgeMs = this.maxAgeHours * 60 * 60 * 1000

    // Prune records older than maxAgeHours
    const freshRecords = records.filter((r) => now - r.epochMs <= maxAgeMs)

    // Append new genuine snapshot record
    const newRecord: SnapshotRecord = {
      timestamp: new Date(now).toISOString(),
      epochMs: now,
      price: quote.price,
      volume24h: quote.volume24h,
      percentChange1h: quote.percentChange1h,
      source: 'live_cmc',
    }

    freshRecords.push(newRecord)

    // Enforce circular capacity limit (FIFO)
    while (freshRecords.length > this.maxObservations) {
      freshRecords.shift()
    }

    this.buffers.set(normalizedSymbol, freshRecords)
    this.lastRecordTime.set(normalizedSymbol, now)
    return true
  }

  /**
   * Returns snapshot records for an asset, ordered chronologically.
   */
  public getSnapshots(symbol: string): SnapshotRecord[] {
    const normalizedSymbol = symbol.toUpperCase().trim()
    const records = this.buffers.get(normalizedSymbol) || []
    const now = Date.now()
    const maxAgeMs = this.maxAgeHours * 60 * 60 * 1000

    // Filter out expired records upon retrieval
    return records.filter((r) => now - r.epochMs <= maxAgeMs)
  }

  /**
   * Returns observation count for a symbol.
   */
  public getObservationCount(symbol: string): number {
    return this.getSnapshots(symbol).length
  }

  /**
   * Returns buffer health and capacity statistics.
   */
  public getStats(): {
    trackedAssets: number
    totalSnapshots: number
    maxObservationsPerAsset: number
    maxAgeHours: number
    theoreticalOneMinuteWindowMinutes: number
  } {
    let totalSnapshots = 0
    let trackedAssets = 0
    const now = Date.now()
    const maxAgeMs = this.maxAgeHours * 60 * 60 * 1000

    for (const [, records] of this.buffers) {
      const active = records.filter((r) => now - r.epochMs <= maxAgeMs)
      if (active.length > 0) {
        trackedAssets++
        totalSnapshots += active.length
      }
    }

    return {
      trackedAssets,
      totalSnapshots,
      maxObservationsPerAsset: this.maxObservations,
      maxAgeHours: this.maxAgeHours,
      theoreticalOneMinuteWindowMinutes: this.maxObservations,
    }
  }

  /**
   * Clear all stored snapshots.
   */
  public clear(): void {
    this.buffers.clear()
    this.lastRecordTime.clear()
  }
}

// Global singleton instance for snapshot buffering
export const snapshotBuffer = new SnapshotBuffer()
