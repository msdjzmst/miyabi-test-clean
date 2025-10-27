/**
 * Retry Utilities with Exponential Backoff
 *
 * Provides intelligent retry logic for transient failures
 */

import { ErrorUtils } from '../types/errors';
import { logger } from '../ui/index';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Initial delay in milliseconds */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds */
  maxDelayMs?: number;

  /** Backoff multiplier */
  backoffMultiplier?: number;

  /** Jitter factor (0-1) to randomize delays */
  jitterFactor?: number;

  /** Timeout for each attempt in milliseconds */
  attemptTimeoutMs?: number;

  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;

  /** Callback on retry attempt */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** Whether operation succeeded */
  success: boolean;

  /** Result value (if successful) */
  value?: T;

  /** Error (if failed) */
  error?: Error;

  /** Number of attempts made */
  attempts: number;

  /** Total time elapsed (ms) */
  totalDurationMs: number;

  /** Whether max retries was reached */
  maxRetriesReached: boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  attemptTimeoutMs: 60000,
  isRetryable: (error: Error) => ErrorUtils.isRecoverable(error),
  onRetry: () => {},
};

/**
 * Execute operation with exponential backoff retry
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    attempts++;

    try {
      // Execute with timeout
      const result = await executeWithTimeout(operation, opts.attemptTimeoutMs);

      return {
        success: true,
        value: result,
        attempts,
        totalDurationMs: Date.now() - startTime,
        maxRetriesReached: false,
      };
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const isLastAttempt = attempt === opts.maxRetries;
      const isRetryable = opts.isRetryable(lastError);

      if (!isRetryable || isLastAttempt) {
        return {
          success: false,
          error: lastError,
          attempts,
          totalDurationMs: Date.now() - startTime,
          maxRetriesReached: isLastAttempt && isRetryable,
        };
      }

      // Calculate delay with exponential backoff and jitter
      const delayMs = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitterFactor
      );

      // Call retry callback
      opts.onRetry(attempt + 1, lastError, delayMs);

      logger.warning(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delayMs}ms: ${lastError.message}`
      );

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here
  return {
    success: false,
    error: lastError,
    attempts,
    totalDurationMs: Date.now() - startTime,
    maxRetriesReached: true,
  };
}

/**
 * Calculate backoff delay with exponential growth and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
  jitterFactor: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: random value between [delay * (1 - jitter), delay * (1 + jitter)]
  const jitterRange = cappedDelay * jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between [-jitterRange, +jitterRange]

  return Math.round(cappedDelay + jitter);
}

/**
 * Execute operation with timeout
 */
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with custom predicate
 */
export async function retryUntil<T>(
  operation: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();

  let attempts = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    attempts++;

    try {
      const result = await executeWithTimeout(operation, opts.attemptTimeoutMs);

      // Check predicate
      if (predicate(result)) {
        return {
          success: true,
          value: result,
          attempts,
          totalDurationMs: Date.now() - startTime,
          maxRetriesReached: false,
        };
      }

      // Predicate failed
      const isLastAttempt = attempt === opts.maxRetries;
      if (isLastAttempt) {
        return {
          success: false,
          error: new Error('Predicate not satisfied after max retries'),
          attempts,
          totalDurationMs: Date.now() - startTime,
          maxRetriesReached: true,
        };
      }

      // Calculate delay and retry
      const delayMs = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitterFactor
      );

      logger.warning(`Retry attempt ${attempt + 1}/${opts.maxRetries} (predicate not satisfied)`);

      await sleep(delayMs);
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts,
        totalDurationMs: Date.now() - startTime,
        maxRetriesReached: false,
      };
    }
  }

  // Should never reach here
  return {
    success: false,
    error: new Error('Max retries reached'),
    attempts,
    totalDurationMs: Date.now() - startTime,
    maxRetriesReached: true,
  };
}

/**
 * Batch retry - retry multiple operations with shared backoff
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results: Array<RetryResult<T>> = [];

  for (const operation of operations) {
    const result = await retryWithBackoff(operation, options);
    results.push(result);

    // If one fails and is not retryable, stop batch
    if (!result.success && result.error && !options.isRetryable?.(result.error)) {
      break;
    }
  }

  return results;
}
