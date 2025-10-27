/**
 * Unit tests for retry-config module
 *
 * Tests retry logic with exponential backoff for GitHub API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  shouldRetry,
  calculateBackoff,
  RETRYABLE_ERROR_CODES,
  NON_RETRYABLE_ERROR_CODES,
  DEFAULT_RETRY_CONFIG,
  type GitHubRetryConfig,
} from '../retry-config';

describe('retry-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // shouldRetry Tests
  // ==========================================================================

  describe('shouldRetry', () => {
    describe('retryable errors', () => {
      it('should retry on 429 rate limit', () => {
        expect(shouldRetry({ status: 429 })).toBe(true);
      });

      it('should retry on 500 server error', () => {
        expect(shouldRetry({ status: 500 })).toBe(true);
      });

      it('should retry on 502 bad gateway', () => {
        expect(shouldRetry({ status: 502 })).toBe(true);
      });

      it('should retry on 503 service unavailable', () => {
        expect(shouldRetry({ status: 503 })).toBe(true);
      });

      it('should retry on 504 gateway timeout', () => {
        expect(shouldRetry({ status: 504 })).toBe(true);
      });

      it('should retry on ECONNRESET', () => {
        expect(shouldRetry({ code: 'ECONNRESET' })).toBe(true);
      });

      it('should retry on ETIMEDOUT', () => {
        expect(shouldRetry({ code: 'ETIMEDOUT' })).toBe(true);
      });

      it('should retry on ENOTFOUND', () => {
        expect(shouldRetry({ code: 'ENOTFOUND' })).toBe(true);
      });

      it('should retry on rate limit message', () => {
        expect(shouldRetry({ message: 'rate limit exceeded' })).toBe(true);
      });

      it('should retry on abuse detection message', () => {
        expect(shouldRetry({ message: 'abuse detection mechanism' })).toBe(true);
      });

      it('should retry on secondary rate limit message', () => {
        expect(shouldRetry({ message: 'secondary rate limit' })).toBe(true);
      });

      it('should retry on retryable status in response object', () => {
        expect(shouldRetry({ response: { status: 429 } })).toBe(true);
        expect(shouldRetry({ response: { status: 500 } })).toBe(true);
      });
    });

    describe('non-retryable errors', () => {
      it('should NOT retry on 400 bad request', () => {
        expect(shouldRetry({ status: 400 })).toBe(false);
      });

      it('should NOT retry on 401 unauthorized', () => {
        expect(shouldRetry({ status: 401 })).toBe(false);
      });

      it('should NOT retry on 403 forbidden', () => {
        expect(shouldRetry({ status: 403 })).toBe(false);
      });

      it('should NOT retry on 404 not found', () => {
        expect(shouldRetry({ status: 404 })).toBe(false);
      });

      it('should NOT retry on 422 unprocessable entity', () => {
        expect(shouldRetry({ status: 422 })).toBe(false);
      });

      it('should NOT retry on unknown errors', () => {
        expect(shouldRetry({ message: 'Unknown error' })).toBe(false);
      });

      it('should NOT retry on empty error object', () => {
        expect(shouldRetry({})).toBe(false);
      });
    });
  });

  // ==========================================================================
  // withRetry Tests
  // ==========================================================================

  describe('withRetry', () => {
    describe('successful execution', () => {
      it('should succeed on first attempt', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should return complex data structures', async () => {
        const data = { id: 123, title: 'Test', labels: ['bug', 'high-priority'] };
        const fn = vi.fn().mockResolvedValue(data);
        const result = await withRetry(fn);

        expect(result).toEqual(data);
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe('retry on retryable errors', () => {
      it('should retry on rate limit error (429)', async () => {
        const error = Object.assign(new Error('rate limit'), { status: 429 });
        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue('success');

        const result = await withRetry(fn, { retries: 3, minTimeout: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should retry on multiple 5xx errors', async () => {
        const error1 = Object.assign(new Error('Server error'), { status: 500 });
        const error2 = Object.assign(new Error('Bad gateway'), { status: 502 });
        const fn = vi.fn()
          .mockRejectedValueOnce(error1)
          .mockRejectedValueOnce(error2)
          .mockResolvedValue('success');

        const result = await withRetry(fn, { retries: 3, minTimeout: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should retry on network errors', async () => {
        const error1 = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
        const error2 = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
        const fn = vi.fn()
          .mockRejectedValueOnce(error1)
          .mockRejectedValueOnce(error2)
          .mockResolvedValue('success');

        const result = await withRetry(fn, { retries: 3, minTimeout: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should exhaust retries and throw final error', async () => {
        const error = Object.assign(new Error('rate limit'), { status: 429 });
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { retries: 2, minTimeout: 10 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      });
    });

    describe('abort on non-retryable errors', () => {
      it('should abort immediately on 401 unauthorized', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { retries: 3 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1); // No retries
      });

      it('should abort immediately on 404 not found', async () => {
        const error = { status: 404, message: 'Not found' };
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { retries: 3 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1); // No retries
      });

      it('should abort immediately on 422 validation error', async () => {
        const error = { status: 422, message: 'Validation failed' };
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { retries: 3 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1); // No retries
      });
    });

    describe('configuration options', () => {
      it('should use default config when not specified', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should respect custom retry count', async () => {
        const error = Object.assign(new Error('rate limit'), { status: 429 });
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { retries: 1, minTimeout: 10 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
      });

      it('should call onFailedAttempt callback', async () => {
        const onFailedAttempt = vi.fn();
        const error = Object.assign(new Error('rate limit'), { status: 429 });
        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue('success');

        await withRetry(fn, {
          retries: 3,
          minTimeout: 10,
          onFailedAttempt,
        });

        expect(onFailedAttempt).toHaveBeenCalledTimes(1);
        expect(onFailedAttempt).toHaveBeenCalledWith(
          expect.objectContaining({
            attemptNumber: expect.any(Number),
            retriesLeft: expect.any(Number),
          })
        );
      });
    });
  });

  // ==========================================================================
  // calculateBackoff Tests
  // ==========================================================================

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const backoff0 = calculateBackoff(0, { randomize: false });
      const backoff1 = calculateBackoff(1, { randomize: false });
      const backoff2 = calculateBackoff(2, { randomize: false });

      expect(backoff0).toBe(1000); // minTimeout * 2^0
      expect(backoff1).toBe(2000); // minTimeout * 2^1
      expect(backoff2).toBe(4000); // minTimeout * 2^2
    });

    it('should respect maxTimeout cap', () => {
      const backoff = calculateBackoff(10, {
        randomize: false,
        minTimeout: 1000,
        maxTimeout: 4000,
      });

      expect(backoff).toBe(4000); // capped at maxTimeout
    });

    it('should add jitter when randomize is true', () => {
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        results.push(calculateBackoff(1, { randomize: true }));
      }

      // With randomization, results should vary
      const allSame = results.every((val) => val === results[0]);
      expect(allSame).toBe(false);

      // All values should be within jitter range (0.5x to 1.5x of base delay)
      const baseDelay = 2000; // minTimeout * 2^1
      results.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(baseDelay * 0.5);
        expect(val).toBeLessThanOrEqual(baseDelay * 1.5);
      });
    });

    it('should use default config when not specified', () => {
      const backoff = calculateBackoff(0, { randomize: false });
      expect(backoff).toBe(DEFAULT_RETRY_CONFIG.minTimeout);
    });
  });

  // ==========================================================================
  // Configuration Constants Tests
  // ==========================================================================

  describe('configuration constants', () => {
    it('should have correct retryable error codes', () => {
      expect(RETRYABLE_ERROR_CODES).toContain(408); // Request Timeout
      expect(RETRYABLE_ERROR_CODES).toContain(429); // Too Many Requests
      expect(RETRYABLE_ERROR_CODES).toContain(500); // Internal Server Error
      expect(RETRYABLE_ERROR_CODES).toContain(502); // Bad Gateway
      expect(RETRYABLE_ERROR_CODES).toContain(503); // Service Unavailable
      expect(RETRYABLE_ERROR_CODES).toContain(504); // Gateway Timeout
    });

    it('should have correct non-retryable error codes', () => {
      expect(NON_RETRYABLE_ERROR_CODES).toContain(400); // Bad Request
      expect(NON_RETRYABLE_ERROR_CODES).toContain(401); // Unauthorized
      expect(NON_RETRYABLE_ERROR_CODES).toContain(403); // Forbidden
      expect(NON_RETRYABLE_ERROR_CODES).toContain(404); // Not Found
      expect(NON_RETRYABLE_ERROR_CODES).toContain(422); // Unprocessable Entity
    });

    it('should have correct default config', () => {
      expect(DEFAULT_RETRY_CONFIG.retries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.minTimeout).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxTimeout).toBe(4000);
      expect(DEFAULT_RETRY_CONFIG.factor).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.randomize).toBe(true);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should handle GitHub rate limit scenario', async () => {
      const onFailedAttempt = vi.fn();

      // Simulate GitHub rate limit error followed by success
      const error = Object.assign(new Error('API rate limit exceeded'), { status: 429 });
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ data: 'success' });

      const result = await withRetry(fn, {
        retries: 3,
        minTimeout: 10,
        onFailedAttempt,
      });

      expect(result).toEqual({ data: 'success' });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onFailedAttempt).toHaveBeenCalledTimes(1);
    });

    it('should handle transient network errors', async () => {
      // Simulate transient network issues
      const error1 = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
      const error2 = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
      const fn = vi.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('recovered');

      const result = await withRetry(fn, { retries: 3, minTimeout: 10 });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail fast on authentication errors', async () => {
      // Simulate authentication failure (should not retry)
      const fn = vi.fn().mockRejectedValue({
        status: 401,
        message: 'Bad credentials',
      });

      const start = Date.now();
      await expect(withRetry(fn, { retries: 3, minTimeout: 1000 })).rejects.toThrow();
      const duration = Date.now() - start;

      expect(fn).toHaveBeenCalledTimes(1); // No retries
      expect(duration).toBeLessThan(100); // Should fail immediately
    });

    it('should handle mixed success and failure across retries', async () => {
      const results: string[] = [];

      const error1 = Object.assign(new Error('Server error'), { status: 500 });

      // First call: fails once, succeeds on retry
      const fn1 = vi.fn()
        .mockRejectedValueOnce(error1)
        .mockResolvedValueOnce('first success');

      const result1 = await withRetry(fn1, { retries: 2, minTimeout: 10 });
      results.push(result1);

      // Second call: uses fresh mock with different behavior
      const error2 = Object.assign(new Error('Bad gateway'), { status: 502 });
      const fn2 = vi.fn()
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('second success');

      const result2 = await withRetry(fn2, { retries: 2, minTimeout: 10 });
      results.push(result2);

      expect(results).toEqual(['first success', 'second success']);
      expect(fn1).toHaveBeenCalledTimes(2); // 1 failure + 1 success
      expect(fn2).toHaveBeenCalledTimes(2); // 1 failure + 1 success
    });
  });
});
