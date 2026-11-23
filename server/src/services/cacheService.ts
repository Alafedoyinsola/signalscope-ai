interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export interface CacheStats {
  size: number
  hits: number
  misses: number
  coalescedHits: number
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>()
  private inFlight = new Map<string, Promise<unknown>>()
  private hits = 0
  private misses = 0
  private coalescedHits = 0

  /**
   * Retrieves data from cache or executes the fetcher function.
   * If an identical request is already in-flight, coalesces and shares the pending Promise.
   */
  public async getOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now()

    // 1. Check cached entry
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > now) {
      this.hits++
      return cached.data as T
    }

    // 2. Check if identical request is already in-flight (Promise Coalescing)
    const pending = this.inFlight.get(key)
    if (pending) {
      this.coalescedHits++
      return pending as Promise<T>
    }

    // 3. Cache miss: initiate fetch and track Promise
    this.misses++
    const promise = fetcher()
      .then((data) => {
        // Cache successful response
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
        })
        return data
      })
      .finally(() => {
        // Clean up in-flight reference once settled
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * Invalidate a specific cache entry.
   */
  public invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear entire cache.
   */
  public clear(): void {
    this.cache.clear()
    this.inFlight.clear()
  }

  /**
   * Return cache performance statistics.
   */
  public getStats(): CacheStats {
    // Prune expired entries during stats check
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      coalescedHits: this.coalescedHits,
    }
  }
}

// Global singleton instance for backend caching
export const cacheService = new CacheService()
