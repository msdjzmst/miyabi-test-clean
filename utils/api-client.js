/**
 * API Client Singleton with Connection Pooling + LRU Cache
 *
 * Performance optimizations:
 * 1. Connection Pooling: Reuse TCP connections (25-50% improvement, up to 10x)
 * 2. LRU Cache: Cache API responses (lru-cache: 40M+ weekly downloads)
 *
 * Benefits:
 * - Eliminates TCP handshake overhead (3-way handshake)
 * - Reduces SSL/TLS negotiation overhead
 * - Caches frequently accessed data (issues, PRs)
 * - Reduces API rate limit consumption
 * - Improves throughput for multiple API calls
 */
import { Octokit } from '@octokit/rest';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { LRUCache } from 'lru-cache';
// ============================================================================
// HTTP Agent Configuration (Connection Pooling)
// ============================================================================
/**
 * Create HTTP/HTTPS agents with connection pooling
 *
 * Configuration based on research:
 * - keepAlive: true - Reuse TCP connections
 * - maxSockets: 50 - Max concurrent connections per host
 * - maxFreeSockets: 10 - Keep 10 idle connections ready
 * - timeout: 30000 - 30 second socket timeout
 */
const httpAgent = new HttpAgent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
});
const httpsAgent = new HttpsAgent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
});
// ============================================================================
// LRU Cache Configuration
// ============================================================================
/**
 * GitHub API Response Cache
 *
 * Configuration:
 * - max: 500 entries (sufficient for typical workloads)
 * - ttl: 5 minutes (300,000ms) - balance freshness vs cache hits
 * - updateAgeOnGet: true - refresh TTL on cache hits
 */
const githubCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 5, // 5 minutes
    updateAgeOnGet: true,
});
// ============================================================================
// GitHub API Client (Singleton with Cache)
// ============================================================================
let githubClientInstance = null;
/**
 * Get or create GitHub API client singleton
 *
 * @param token - GitHub personal access token
 * @returns Singleton Octokit instance with connection pooling
 */
export function getGitHubClient(token) {
    if (!githubClientInstance) {
        if (!token) {
            throw new Error('GitHub token is required for first initialization');
        }
        githubClientInstance = new Octokit({
            auth: token,
            request: {
                agent: httpsAgent, // Use connection pooling agent
            },
        });
    }
    return githubClientInstance;
}
/**
 * Reset GitHub client (for testing or token rotation)
 */
export function resetGitHubClient() {
    githubClientInstance = null;
    githubCache.clear();
}
/**
 * Get cached GitHub API response or fetch if not cached
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch data if not cached
 * @returns Cached or fresh data
 */
export async function withGitHubCache(key, fetcher) {
    // Check cache
    const cached = githubCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    // Fetch and cache
    const data = await fetcher();
    githubCache.set(key, data);
    return data;
}
/**
 * Clear GitHub cache
 */
export function clearGitHubCache() {
    githubCache.clear();
}
// ============================================================================
// Connection Pool Statistics
// ============================================================================
/**
 * Get connection pool and cache statistics for monitoring
 */
export function getConnectionPoolStats() {
    return {
        http: {
            maxSockets: httpAgent.maxSockets,
            maxFreeSockets: httpAgent.maxFreeSockets,
            // @ts-ignore - accessing private properties for monitoring
            sockets: Object.keys(httpAgent.sockets || {}).length,
            // @ts-ignore
            freeSockets: Object.keys(httpAgent.freeSockets || {}).length,
        },
        https: {
            maxSockets: httpsAgent.maxSockets,
            maxFreeSockets: httpsAgent.maxFreeSockets,
            // @ts-ignore - accessing private properties for monitoring
            sockets: Object.keys(httpsAgent.sockets || {}).length,
            // @ts-ignore
            freeSockets: Object.keys(httpsAgent.freeSockets || {}).length,
        },
        cache: {
            github: {
                size: githubCache.size,
                max: githubCache.max,
                ttl: '5 minutes',
            },
        },
    };
}
/**
 * Destroy all connections (for graceful shutdown)
 */
export function destroyAllConnections() {
    httpAgent.destroy();
    httpsAgent.destroy();
    resetGitHubClient();
}
//# sourceMappingURL=api-client.js.map