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
/**
 * Get or create GitHub API client singleton
 *
 * @param token - GitHub personal access token
 * @returns Singleton Octokit instance with connection pooling
 */
export declare function getGitHubClient(token?: string): Octokit;
/**
 * Reset GitHub client (for testing or token rotation)
 */
export declare function resetGitHubClient(): void;
/**
 * Get cached GitHub API response or fetch if not cached
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch data if not cached
 * @returns Cached or fresh data
 */
export declare function withGitHubCache<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
/**
 * Clear GitHub cache
 */
export declare function clearGitHubCache(): void;
/**
 * Get connection pool and cache statistics for monitoring
 */
export declare function getConnectionPoolStats(): {
    http: {
        maxSockets: number;
        maxFreeSockets: number;
        sockets: number;
        freeSockets: number;
    };
    https: {
        maxSockets: number;
        maxFreeSockets: number;
        sockets: number;
        freeSockets: number;
    };
    cache: {
        github: {
            size: number;
            max: number;
            ttl: string;
        };
    };
};
/**
 * Destroy all connections (for graceful shutdown)
 */
export declare function destroyAllConnections(): void;
//# sourceMappingURL=api-client.d.ts.map