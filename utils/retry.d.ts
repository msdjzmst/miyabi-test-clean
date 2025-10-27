/**
 * Retry utility with exponential backoff
 *
 * Issue #41: Retry logic for GitHub API calls
 */
export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
}
/**
 * Execute a function with automatic retry on transient failures
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map