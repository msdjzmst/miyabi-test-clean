/**
 * Miyabi Agent SDK - Base Agent Class
 *
 * This module provides the base class for all Miyabi agents.
 */

import type {
  AgentContext,
  AgentConfig,
  AgentResult,
  AgentMetrics,
} from './types';

/**
 * Base class for all Miyabi agents
 */
export abstract class AgentBase {
  protected context: AgentContext;
  protected config: AgentConfig;
  protected startTime: number;

  constructor(context: AgentContext) {
    this.context = context;
    this.config = context.config;
    this.startTime = Date.now();
  }

  /**
   * Execute the agent
   * Must be implemented by subclasses
   */
  abstract execute(): Promise<AgentResult>;

  /**
   * Validate agent context and configuration
   */
  protected validate(): void {
    if (!this.context.owner || !this.context.repo) {
      throw new Error('Agent context must include owner and repo');
    }
    if (!this.context.token) {
      throw new Error('Agent context must include GitHub token');
    }
    if (!this.config.name) {
      throw new Error('Agent config must include name');
    }
  }

  /**
   * Create execution metrics
   */
  protected createMetrics(operationCount: number, apiCallCount: number): AgentMetrics {
    const now = Date.now();
    return {
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date(now).toISOString(),
      durationMs: now - this.startTime,
      operationCount,
      apiCallCount,
    };
  }

  /**
   * Create success result
   */
  protected success(
    message: string,
    operationCount: number,
    apiCallCount: number
  ): AgentResult {
    return {
      status: 'success',
      message,
      metrics: this.createMetrics(operationCount, apiCallCount),
    };
  }

  /**
   * Create failure result
   */
  protected failure(
    message: string,
    error: Error,
    operationCount: number,
    apiCallCount: number
  ): AgentResult {
    return {
      status: 'failure',
      message,
      metrics: this.createMetrics(operationCount, apiCallCount),
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        retryable: this.isRetryableError(error),
      },
    };
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    // Network errors, rate limits, and temporary failures are retryable
    const retryablePatterns = [
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /rate limit/i,
      /503/,
      /502/,
      /timeout/i,
    ];
    return retryablePatterns.some((pattern) =>
      pattern.test(error.message)
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts && this.isRetryableError(lastError)) {
          const backoffDelay = delayMs * Math.pow(2, attempt - 1);
          console.warn(
            `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${backoffDelay}ms...`
          );
          await this.sleep(backoffDelay);
        } else {
          break;
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Log message with agent name prefix
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.config.name}]`;

    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
}
