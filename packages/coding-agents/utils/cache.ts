/**
 * TTL-based LRU Cache with Automatic Cleanup
 *
 * Prevents memory leaks and provides efficient caching
 */

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  expiresAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  oldestEntryAge: number;
  newestEntryAge: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Maximum number of entries */
  maxSize?: number;

  /** Time to live in milliseconds */
  ttlMs?: number;

  /** Cleanup interval in milliseconds */
  cleanupIntervalMs?: number;

  /** Enable automatic cleanup */
  autoCleanup?: boolean;

  /** Callback when entry is evicted */
  onEvict?: (key: string, value: any) => void;
}

/**
 * TTL-based LRU Cache
 */
export class TTLCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly autoCleanup: boolean;
  private readonly onEvict?: (key: string, value: T) => void;

  private cleanupTimer?: NodeJS.Timeout;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000; // 15 minutes default
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 1000; // 1 minute default
    this.autoCleanup = options.autoCleanup ?? true;
    this.onEvict = options.onEvict;

    if (this.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Set cache entry
   */
  set(key: string, value: T, customTTL?: number): void {
    const now = Date.now();
    const ttl = customTTL ?? this.ttlMs;

    // If cache is full, evict LRU entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cache entry
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();

    // Check if expired
    if (now > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access stats
    entry.lastAccessedAt = now;
    entry.accessCount++;
    this.hits++;

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();

    // Check if expired
    if (now > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (entry && this.onEvict) {
      this.onEvict(key, entry.value);
    }

    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.onEvict(key, entry.value);
      }
    }

    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): T[] {
    return Array.from(this.cache.values()).map((entry) => entry.value);
  }

  /**
   * Get all entries
   */
  entries(): Array<[string, T]> {
    return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value]);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruTime: number = Infinity;

    // Find LRU entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.evictions++;
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const expired = this.cleanup();
      if (expired > 0) {
        console.log(`[TTLCache] Cleaned up ${expired} expired entries`);
      }
    }, this.cleanupIntervalMs);

    // Don't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let oldestAge = 0;
    let newestAge = Infinity;

    for (const entry of this.cache.values()) {
      const age = now - entry.createdAt;
      if (age > oldestAge) oldestAge = age;
      if (age < newestAge) newestAge = age;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge === Infinity ? 0 : newestAge,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get entry metadata
   */
  getMetadata(key: string): Omit<CacheEntry<T>, 'value'> | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const { value, ...metadata } = entry;
    return metadata;
  }

  /**
   * Refresh entry TTL
   */
  refresh(key: string, customTTL?: number): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const ttl = customTTL ?? this.ttlMs;
    entry.expiresAt = Date.now() + ttl;

    return true;
  }

  /**
   * Get or set (lazy initialization)
   */
  async getOrSet(key: string, factory: () => Promise<T>, customTTL?: number): Promise<T> {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, customTTL);

    return value;
  }

  /**
   * Dispose cache (cleanup and stop timers)
   */
  dispose(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

/**
 * Create a TTL cache with default options
 */
export function createCache<T>(options?: CacheOptions): TTLCache<T> {
  return new TTLCache<T>(options);
}

/**
 * Memoize function with TTL cache
 */
export function memoize<Args extends any[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: CacheOptions & {
    keyGenerator?: (...args: Args) => string;
  } = {}
): (...args: Args) => Promise<Result> {
  const cache = new TTLCache<Result>(options);
  const keyGenerator = options.keyGenerator ?? ((...args: Args) => JSON.stringify(args));

  return async (...args: Args): Promise<Result> => {
    const key = keyGenerator(...args);
    return cache.getOrSet(key, () => fn(...args));
  };
}
