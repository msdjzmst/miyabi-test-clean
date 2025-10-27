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

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'rate limit'],
};

/**
 * Execute a function with automatic retry on transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();

      // Check if error is retryable
      const isRetryable = opts.retryableErrors.some((retryableError) =>
        errorMessage.includes(retryableError.toLowerCase()),
      );

      // Don't retry on last attempt or non-retryable errors
      if (attempt === opts.maxAttempts || !isRetryable) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
