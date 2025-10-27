/**
 * Retry Configuration for GitHub API Calls
 *
 * This module provides retry logic with exponential backoff for GitHub API calls.
 * It uses p-retry to handle transient failures like rate limits, network errors, and server errors.
 */

import pRetry, { AbortError } from 'p-retry';
import type { RetryContext } from 'p-retry';

/**
 * GitHub API retry configuration
 */
export interface GitHubRetryConfig {
  /** Number of retry attempts (default: 3) */
  retries: number;
  /** Minimum timeout in milliseconds (default: 1000) */
  minTimeout: number;
  /** Maximum timeout in milliseconds (default: 4000) */
  maxTimeout: number;
  /** Exponential backoff factor (default: 2) */
  factor: number;
  /** Add randomized jitter to prevent thundering herd (default: true) */
  randomize: boolean;
  /** Callback for failed attempts */
  onFailedAttempt?: (error: RetryContext) => void;
}

/**
 * Default retry configuration
 * - 3 retries
 * - Exponential backoff: 1s, 2s, 4s
 * - Randomized jitter
 */
export const DEFAULT_RETRY_CONFIG: GitHubRetryConfig = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 4000,
  factor: 2,
  randomize: true,
};

/**
 * Retryable HTTP status codes
 */
export const RETRYABLE_ERROR_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (Rate Limit)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Non-retryable HTTP status codes (should abort immediately)
 */
export const NON_RETRYABLE_ERROR_CODES = [
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  422, // Unprocessable Entity
];

/**
 * Determine if an error should be retried
 *
 * @param error - The error to check
 * @returns true if the error is retryable, false otherwise
 */
export function shouldRetry(error: any): boolean {
  // Network errors (ECONNRESET, ETIMEDOUT, etc.)
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP status codes
  if (error.status && RETRYABLE_ERROR_CODES.includes(error.status)) {
    return true;
  }

  // Explicitly non-retryable status codes
  if (error.status && NON_RETRYABLE_ERROR_CODES.includes(error.status)) {
    return false;
  }

  // Octokit rate limit errors
  if (error.message?.includes('rate limit')) {
    return true;
  }

  // Octokit abuse detection
  if (error.message?.includes('abuse detection')) {
    return true;
  }

  // Octokit secondary rate limit
  if (error.message?.includes('secondary rate limit')) {
    return true;
  }

  // Fetch response errors
  if (error.response?.status && RETRYABLE_ERROR_CODES.includes(error.response.status)) {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Create p-retry options from config
 *
 * @param config - Partial retry configuration (merged with defaults)
 * @returns p-retry options
 */
export function createRetryOptions(
  config: Partial<GitHubRetryConfig> = {}
): Parameters<typeof pRetry>[1] {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return {
    retries: finalConfig.retries,
    minTimeout: finalConfig.minTimeout,
    maxTimeout: finalConfig.maxTimeout,
    factor: finalConfig.factor,
    randomize: finalConfig.randomize,
    onFailedAttempt: finalConfig.onFailedAttempt || ((context: RetryContext) => {
      console.warn(
        `[GitHubRetry] Attempt ${context.attemptNumber}/${context.attemptNumber + context.retriesLeft} failed: ${context.error.message}`
      );
      if (context.retriesLeft > 0) {
        console.warn(`[GitHubRetry] Retrying... (${context.retriesLeft} attempts left)`);
      }
    }),
  };
}

/**
 * Wrap a function with retry logic
 *
 * This is the main function to use for adding retry logic to GitHub API calls.
 * It will automatically retry on transient errors and abort on non-retryable errors.
 *
 * @example
 * ```typescript
 * import { withRetry } from '@miyabi/agent-sdk';
 *
 * // Wrap an API call with retry logic
 * const issue = await withRetry(async () => {
 *   return await octokit.issues.get({
 *     owner: 'myorg',
 *     repo: 'myrepo',
 *     issue_number: 123,
 *   });
 * });
 * ```
 *
 * @param fn - Async function to wrap with retry logic
 * @param config - Optional retry configuration (merged with defaults)
 * @returns Promise resolving to the function's return value
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<GitHubRetryConfig>
): Promise<T> {
  const options = createRetryOptions(config);

  return pRetry(async () => {
    try {
      return await fn();
    } catch (error: any) {
      // Check if error should be retried
      if (shouldRetry(error)) {
        // Throw error to trigger retry
        throw error;
      }

      // Non-retryable error - abort immediately
      throw new AbortError(error);
    }
  }, options);
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * This is useful for debugging or logging purposes.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  config: Partial<GitHubRetryConfig> = {}
): number {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const delay = Math.min(
    finalConfig.minTimeout * Math.pow(finalConfig.factor, attempt),
    finalConfig.maxTimeout
  );

  if (finalConfig.randomize) {
    // Add jitter: random value between 0.5x and 1.5x of the delay
    const jitter = delay * (0.5 + Math.random());
    return Math.round(jitter);
  }

  return delay;
}
