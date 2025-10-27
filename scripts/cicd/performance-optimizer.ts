/**
 * Performance Optimizer - Scalability & Performance Enhancement System
 *
 * Features:
 * - Parallel task execution management
 * - Rate limiting and throttling
 * - Caching layer for API calls
 * - Batch processing for bulk operations
 * - Performance profiling and metrics
 * - Load balancing across agents
 * - Queue management for high-volume tasks
 *
 * Phase I: Issue #5 - Scalability & Performance Optimization
 */

import type { Octokit } from '@octokit/rest';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  cacheHit: boolean;
  throttled: boolean;
  timestamp: string;
}

export interface BatchOperation<T, R> {
  id: string;
  items: T[];
  batchSize: number;
  processor: (batch: T[]) => Promise<R[]>;
  delayMs: number;
}

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-loaded' | 'weighted' | 'random';
  agents: string[];
  weights?: Map<string, number>;
}

export interface QueueTask<T> {
  id: string;
  priority: number;
  data: T;
  retries: number;
  maxRetries: number;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface OptimizerConfig {
  cacheTTLMs: number;
  maxCacheSize: number;
  rateLimitBuffer: number;
  batchSize: number;
  batchDelayMs: number;
  maxConcurrency: number;
  queueMaxSize: number;
  metricsEnabled: boolean;
}

// ============================================================================
// Performance Optimizer Class
// ============================================================================

export class PerformanceOptimizer {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private activeOperations: Map<string, Promise<any>> = new Map();
  private queue: Array<QueueTask<any>> = [];
  private loadBalancerState: Map<string, number> = new Map();

  constructor(
    private config: OptimizerConfig,
    private octokit?: Octokit,
  ) {
    this.startCacheCleanup();
  }

  // ============================================================================
  // Caching Layer
  // ============================================================================

  /**
   * Get cached data or execute function and cache result
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.getFromCache<T>(key);

    if (cached) {
      this.recordMetric('cache-hit', true);
      return cached;
    }

    const result = await fn();
    this.setInCache(key, result, ttlMs);
    this.recordMetric('cache-miss', false);

    return result;
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  private setInCache<T>(key: string, data: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs || this.config.cacheTTLMs;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      hits: 0,
    });
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now >= entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  // ============================================================================
  // Rate Limiting & Throttling
  // ============================================================================

  /**
   * Execute with rate limiting
   */
  async withRateLimit<T>(
    resource: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.waitForRateLimit(resource);

    const result = await fn();
    await this.updateRateLimit(resource);

    return result;
  }

  /**
   * Wait if rate limit is exceeded
   */
  private async waitForRateLimit(resource: string): Promise<void> {
    const limit = this.rateLimits.get(resource);

    if (!limit) {
      return;
    }

    const now = Date.now() / 1000;

    if (limit.remaining <= this.config.rateLimitBuffer) {
      const waitTime = Math.max(0, limit.reset - now);

      if (waitTime > 0) {
        console.log(`[PerformanceOptimizer] Rate limit reached for ${resource}, waiting ${waitTime.toFixed(1)}s...`);
        this.recordMetric('rate-limit-wait', false, true);
        await this.sleep(waitTime * 1000);
      }
    }
  }

  /**
   * Update rate limit information from GitHub API
   */
  private async updateRateLimit(resource: string): Promise<void> {
    if (!this.octokit) {
      return;
    }

    try {
      const { data } = await this.octokit.rateLimit.get();
      const rate = resource === 'core' ? data.resources.core : data.resources.search;

      this.rateLimits.set(resource, {
        limit: rate.limit,
        remaining: rate.remaining,
        reset: rate.reset,
        used: rate.used,
      });
    } catch (error) {
      console.error(`[PerformanceOptimizer] Failed to update rate limit:`, error);
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(resource: string = 'core'): RateLimitInfo | null {
    return this.rateLimits.get(resource) || null;
  }

  // ============================================================================
  // Batch Processing
  // ============================================================================

  /**
   * Process items in batches with rate limiting
   */
  async batchProcess<T, R>(
    operation: BatchOperation<T, R>,
  ): Promise<R[]> {
    const results: R[] = [];
    const batches = this.createBatches(operation.items, operation.batchSize);

    console.log(`[PerformanceOptimizer] Processing ${operation.items.length} items in ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const startTime = Date.now();

      try {
        const batchResults = await operation.processor(batch);
        results.push(...batchResults);

        const duration = Date.now() - startTime;
        console.log(`[PerformanceOptimizer] Batch ${i + 1}/${batches.length} completed in ${duration}ms`);

        // Delay between batches to avoid rate limits
        if (i < batches.length - 1 && operation.delayMs > 0) {
          await this.sleep(operation.delayMs);
        }
      } catch (error) {
        console.error(`[PerformanceOptimizer] Batch ${i + 1} failed:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Create batches from items
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Batch GitHub API operations
   */
  async batchGitHubOperations<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 10,
    delayMs: number = 1000,
  ): Promise<T[]> {
    return this.batchProcess({
      id: `github-batch-${Date.now()}`,
      items: operations,
      batchSize,
      processor: async (batch) => Promise.all(batch.map(op => op())),
      delayMs,
    });
  }

  // ============================================================================
  // Parallel Execution
  // ============================================================================

  /**
   * Execute tasks in parallel with concurrency limit
   */
  async parallelExecute<T>(
    tasks: Array<() => Promise<T>>,
    concurrency?: number,
  ): Promise<T[]> {
    const limit = concurrency || this.config.maxConcurrency;
    const results: T[] = [];
    const executing: Array<Promise<void>> = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1,
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Execute with deduplication (prevent duplicate concurrent operations)
   */
  async withDeduplication<T>(
    key: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const existing = this.activeOperations.get(key);

    if (existing) {
      console.log(`[PerformanceOptimizer] Deduplicating operation: ${key}`);
      return existing as Promise<T>;
    }

    const promise = fn();
    this.activeOperations.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.activeOperations.delete(key);
    }
  }

  // ============================================================================
  // Load Balancing
  // ============================================================================

  /**
   * Select agent using load balancing strategy
   */
  selectAgent(config: LoadBalancingConfig): string {
    switch (config.strategy) {
      case 'round-robin':
        return this.roundRobinSelect(config.agents);

      case 'least-loaded':
        return this.leastLoadedSelect(config.agents);

      case 'weighted':
        return this.weightedSelect(config.agents, config.weights!);

      case 'random':
        return this.randomSelect(config.agents);

      default:
        return config.agents[0];
    }
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelect(agents: string[]): string {
    const key = 'round-robin';
    const current = this.loadBalancerState.get(key) || 0;
    const selected = agents[current % agents.length];

    this.loadBalancerState.set(key, current + 1);
    return selected;
  }

  /**
   * Least-loaded selection
   */
  private leastLoadedSelect(agents: string[]): string {
    let minLoad = Infinity;
    let selected = agents[0];

    for (const agent of agents) {
      const load = this.loadBalancerState.get(agent) || 0;
      if (load < minLoad) {
        minLoad = load;
        selected = agent;
      }
    }

    return selected;
  }

  /**
   * Weighted random selection
   */
  private weightedSelect(agents: string[], weights: Map<string, number>): string {
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const agent of agents) {
      const weight = weights.get(agent) || 1;
      random -= weight;

      if (random <= 0) {
        return agent;
      }
    }

    return agents[0];
  }

  /**
   * Random selection
   */
  private randomSelect(agents: string[]): string {
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Update agent load
   */
  updateAgentLoad(agent: string, delta: number): void {
    const current = this.loadBalancerState.get(agent) || 0;
    this.loadBalancerState.set(agent, current + delta);
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Add task to queue
   */
  enqueue<T>(
    id: string,
    data: T,
    priority: number = 5,
    maxRetries: number = 3,
  ): void {
    if (this.queue.length >= this.config.queueMaxSize) {
      throw new Error('Queue is full');
    }

    this.queue.push({
      id,
      priority,
      data,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
      status: 'pending',
    });

    this.sortQueue();
  }

  /**
   * Dequeue task
   */
  dequeue<T>(): QueueTask<T> | null {
    const task = this.queue.find(t => t.status === 'pending');

    if (task) {
      task.status = 'processing';
    }

    return (task as QueueTask<T>) || null;
  }

  /**
   * Complete task
   */
  completeTask(id: string): void {
    const index = this.queue.findIndex(t => t.id === id);

    if (index !== -1) {
      this.queue[index].status = 'completed';
    }
  }

  /**
   * Fail task and retry if possible
   */
  failTask(id: string): boolean {
    const task = this.queue.find(t => t.id === id);

    if (!task) {
      return false;
    }

    task.retries++;

    if (task.retries >= task.maxRetries) {
      task.status = 'failed';
      return false;
    }

    task.status = 'pending';
    return true;
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(t => t.status === 'pending').length,
      processing: this.queue.filter(t => t.status === 'processing').length,
      completed: this.queue.filter(t => t.status === 'completed').length,
      failed: this.queue.filter(t => t.status === 'failed').length,
    };
  }

  // ============================================================================
  // Performance Profiling
  // ============================================================================

  /**
   * Profile operation execution
   */
  async profile<T>(
    operationName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      this.recordMetric(operationName, false, false, startTime);
      return result;
    } catch (error) {
      this.recordMetric(operationName, false, false, startTime);
      throw error;
    }
  }

  /**
   * Record performance metric
   */
  private recordMetric(
    operationName: string,
    cacheHit: boolean,
    throttled: boolean = false,
    startTime?: number,
  ): void {
    if (!this.config.metricsEnabled) {
      return;
    }

    const now = Date.now();
    const start = startTime || now;

    this.metrics.push({
      operationName,
      startTime: start,
      endTime: now,
      durationMs: now - start,
      cacheHit,
      throttled,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(operationName?: string): PerformanceMetrics[] {
    if (operationName) {
      return this.metrics.filter(m => m.operationName === operationName);
    }
    return [...this.metrics];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary: Record<string, {
      count: number;
      totalMs: number;
      avgMs: number;
      minMs: number;
      maxMs: number;
      cacheHitRate: number;
    }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.operationName]) {
        summary[metric.operationName] = {
          count: 0,
          totalMs: 0,
          avgMs: 0,
          minMs: Infinity,
          maxMs: 0,
          cacheHitRate: 0,
        };
      }

      const stats = summary[metric.operationName];
      stats.count++;
      stats.totalMs += metric.durationMs;
      stats.minMs = Math.min(stats.minMs, metric.durationMs);
      stats.maxMs = Math.max(stats.maxMs, metric.durationMs);

      if (metric.cacheHit) {
        stats.cacheHitRate++;
      }
    }

    // Calculate averages and rates
    for (const stats of Object.values(summary)) {
      stats.avgMs = stats.totalMs / stats.count;
      stats.cacheHitRate = (stats.cacheHitRate / stats.count) * 100;
    }

    return summary;
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      totalHits,
      avgHitsPerEntry: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }

  /**
   * Export optimizer state for debugging
   */
  exportState() {
    return {
      cache: {
        size: this.cache.size,
        entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
          key,
          hits: entry.hits,
          age: Date.now() - entry.timestamp,
          ttl: entry.expiresAt - Date.now(),
        })),
      },
      rateLimits: Object.fromEntries(this.rateLimits),
      queue: this.getQueueStats(),
      metrics: this.getPerformanceSummary(),
      loadBalancer: Object.fromEntries(this.loadBalancerState),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a performance optimizer instance
 */
export function createPerformanceOptimizer(
  config?: Partial<OptimizerConfig>,
  octokit?: Octokit,
): PerformanceOptimizer {
  const defaultConfig: OptimizerConfig = {
    cacheTTLMs: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 1000,
    rateLimitBuffer: 100,
    batchSize: 10,
    batchDelayMs: 1000,
    maxConcurrency: 5,
    queueMaxSize: 10000,
    metricsEnabled: true,
  };

  return new PerformanceOptimizer(
    { ...defaultConfig, ...config },
    octokit,
  );
}
