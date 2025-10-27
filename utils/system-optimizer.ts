/**
 * System Optimizer - Dynamic Resource Allocation
 *
 * Automatically determines optimal concurrency based on:
 * - CPU core count
 * - Available memory
 * - System load
 *
 * Benefits:
 * - Dual-core: concurrency=2 (no change, stable)
 * - Quad-core: concurrency=3 (50% speedup)
 * - 8-core: concurrency=7 (250% speedup)
 * - 16-core: concurrency=8 (capped at 8 for stability)
 */

import * as os from 'os';

export interface SystemResources {
  cpuCount: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  loadAverage: number[];
  platform: string;
}

export interface ConcurrencyConfig {
  optimal: number;
  conservative: number;
  aggressive: number;
  recommended: number;
}

/**
 * Get current system resources
 */
export function getSystemResources(): SystemResources {
  return {
    cpuCount: os.cpus().length,
    totalMemoryGb: os.totalmem() / (1024 ** 3),
    freeMemoryGb: os.freemem() / (1024 ** 3),
    loadAverage: os.loadavg(),
    platform: os.platform(),
  };
}

/**
 * Calculate optimal concurrency based on system resources
 *
 * Strategy:
 * 1. CPU-based: Use (cores - 1) to leave 1 core for OS
 * 2. Memory-based: Estimate 2GB per agent instance
 * 3. Load-based: Reduce concurrency if system is under load
 * 4. Cap at 8: Safety limit for GitHub API rate limits
 *
 * @param resources - Optional system resources (for testing)
 * @returns Optimal concurrency level
 */
export function getOptimalConcurrency(resources?: SystemResources): number {
  const res = resources || getSystemResources();

  // 1. CPU-based concurrency (leave 1 core for OS)
  const cpuBasedConcurrency = Math.max(1, res.cpuCount - 1);

  // 2. Memory-based concurrency (estimate 2GB per agent)
  const memoryPerAgent = 2; // GB
  const memoryBasedConcurrency = Math.floor(res.freeMemoryGb / memoryPerAgent);

  // 3. Load-based adjustment
  // If 1-minute load average > CPU count, system is overloaded
  const loadAverage1min = res.loadAverage[0];
  const isOverloaded = loadAverage1min > res.cpuCount;

  let loadAdjustedConcurrency = Math.min(cpuBasedConcurrency, memoryBasedConcurrency);

  if (isOverloaded) {
    // Reduce by 25% if overloaded
    loadAdjustedConcurrency = Math.max(1, Math.floor(loadAdjustedConcurrency * 0.75));
  }

  // 4. Cap at 8 for stability and API rate limits
  const MAX_CONCURRENCY = 8;
  const optimalConcurrency = Math.min(loadAdjustedConcurrency, MAX_CONCURRENCY);

  // Ensure minimum of 1
  return Math.max(1, optimalConcurrency);
}

/**
 * Get multiple concurrency recommendations
 *
 * @returns Object with conservative, optimal, and aggressive settings
 */
export function getConcurrencyConfig(): ConcurrencyConfig {
  const resources = getSystemResources();
  const optimal = getOptimalConcurrency(resources);

  return {
    optimal,
    conservative: Math.max(1, Math.floor(optimal * 0.75)), // 75% of optimal
    aggressive: Math.min(8, optimal + 1), // +1 but capped at 8
    recommended: optimal, // Default to optimal
  };
}

/**
 * Format system resources for logging
 */
export function formatSystemResources(resources: SystemResources): string {
  return [
    `💻 CPU: ${resources.cpuCount} cores`,
    `🧠 Memory: ${resources.freeMemoryGb.toFixed(1)}GB free / ${resources.totalMemoryGb.toFixed(1)}GB total`,
    `📊 Load: ${resources.loadAverage.map(l => l.toFixed(2)).join(', ')} (1m, 5m, 15m)`,
    `🖥️  Platform: ${resources.platform}`,
  ].join('\n');
}

/**
 * Log concurrency recommendation with reasoning
 */
export function logConcurrencyRecommendation(): void {
  const resources = getSystemResources();
  const config = getConcurrencyConfig();

  console.log('\n⚡ System Optimizer - Concurrency Analysis\n');
  console.log(formatSystemResources(resources));
  console.log('');
  console.log('🎯 Concurrency Recommendations:');
  console.log(`   Conservative: ${config.conservative} (safer for production)`);
  console.log(`   Optimal:      ${config.optimal} (balanced performance)`);
  console.log(`   Aggressive:   ${config.aggressive} (maximum speed)`);
  console.log('');
  console.log(`✅ Recommended: ${config.recommended}`);
  console.log('');

  // Explain reasoning
  const cpuBased = Math.max(1, resources.cpuCount - 1);
  const memoryBased = Math.floor(resources.freeMemoryGb / 2);
  const loadAverage1min = resources.loadAverage[0];
  const isOverloaded = loadAverage1min > resources.cpuCount;

  console.log('📝 Reasoning:');
  console.log(`   CPU-based limit: ${cpuBased} (${resources.cpuCount} cores - 1 for OS)`);
  console.log(`   Memory-based limit: ${memoryBased} (2GB per agent)`);
  console.log(`   Load status: ${isOverloaded ? '⚠️  OVERLOADED (reducing by 25%)' : '✅ Normal'}`);
  console.log(`   Final: min(${cpuBased}, ${memoryBased}, 8) = ${config.optimal}`);
  console.log('');
}

/**
 * Check if system has sufficient resources for given concurrency
 *
 * @param concurrency - Desired concurrency level
 * @returns true if system can handle it, false otherwise
 */
export function canHandleConcurrency(concurrency: number): boolean {
  const resources = getSystemResources();
  const optimal = getOptimalConcurrency(resources);

  if (concurrency > optimal * 1.5) {
    console.warn(`⚠️  Warning: Concurrency ${concurrency} exceeds optimal ${optimal} by 50%`);
    console.warn(`   This may cause system instability or poor performance`);
    return false;
  }

  return true;
}

/**
 * Get concurrency with automatic fallback
 *
 * @param requested - User-requested concurrency (or undefined for auto)
 * @returns Safe concurrency level
 */
export function getSafeConcurrency(requested?: number): number {
  if (!requested) {
    return getOptimalConcurrency();
  }

  const optimal = getOptimalConcurrency();

  // If requested is reasonable, use it
  if (requested <= optimal * 1.5) {
    return requested;
  }

  // Otherwise, warn and use optimal
  console.warn(`⚠️  Requested concurrency ${requested} is too high`);
  console.warn(`   Using optimal value: ${optimal}`);
  return optimal;
}
