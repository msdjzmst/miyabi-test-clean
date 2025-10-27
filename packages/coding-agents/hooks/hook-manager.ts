/**
 * Hook Manager - Manages agent lifecycle hooks
 *
 * Provides registration and execution of prehooks, posthooks, and error hooks
 */

import {
  PreHook,
  PostHook,
  ErrorHook,
  HookContext,
  HookExecutionResult,
  HookOptions,
  HookRegistryEntry,
} from '../types/hooks';
import { AgentResult } from '../types/index';
import { logger } from '../ui/index';

export class HookManager {
  private preHooks: Map<string, HookRegistryEntry<PreHook>> = new Map();
  private postHooks: Map<string, HookRegistryEntry<PostHook>> = new Map();
  private errorHooks: Map<string, HookRegistryEntry<ErrorHook>> = new Map();

  /**
   * Register a prehook
   */
  registerPreHook(
    hook: PreHook,
    options: HookOptions = {}
  ): void {
    if (this.preHooks.has(hook.name)) {
      logger.warning(`PreHook "${hook.name}" already registered, overwriting`);
    }

    this.preHooks.set(hook.name, { hook, options });
    logger.info(`PreHook registered: ${hook.name} (priority: ${hook.priority})`);
  }

  /**
   * Register a posthook
   */
  registerPostHook(
    hook: PostHook,
    options: HookOptions = {}
  ): void {
    if (this.postHooks.has(hook.name)) {
      logger.warning(`PostHook "${hook.name}" already registered, overwriting`);
    }

    this.postHooks.set(hook.name, { hook, options });
    logger.info(`PostHook registered: ${hook.name} (priority: ${hook.priority})`);
  }

  /**
   * Register an error hook
   */
  registerErrorHook(
    hook: ErrorHook,
    options: HookOptions = {}
  ): void {
    if (this.errorHooks.has(hook.name)) {
      logger.warning(`ErrorHook "${hook.name}" already registered, overwriting`);
    }

    this.errorHooks.set(hook.name, { hook, options });
    logger.info(`ErrorHook registered: ${hook.name} (priority: ${hook.priority})`);
  }

  /**
   * Unregister a hook by name
   */
  unregisterHook(hookName: string): boolean {
    const deleted =
      this.preHooks.delete(hookName) ||
      this.postHooks.delete(hookName) ||
      this.errorHooks.delete(hookName);

    if (deleted) {
      logger.info(`Hook unregistered: ${hookName}`);
    }

    return deleted;
  }

  /**
   * Execute all prehooks
   */
  async executePreHooks(context: HookContext): Promise<HookExecutionResult[]> {
    const sortedHooks = this.getSortedHooks(this.preHooks);
    const results: HookExecutionResult[] = [];

    logger.info(`Executing ${sortedHooks.length} prehooks...`);

    for (const { hook, options } of sortedHooks) {
      const result = await this.executeHook(
        hook.name,
        () => hook.execute(context),
        options
      );

      results.push(result);

      // Stop execution if hook failed and continueOnFailure is false
      if (result.status === 'failed' && !options.continueOnFailure) {
        throw new Error(`PreHook "${hook.name}" failed: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Execute all posthooks
   */
  async executePostHooks(
    context: HookContext,
    result: AgentResult
  ): Promise<HookExecutionResult[]> {
    const sortedHooks = this.getSortedHooks(this.postHooks);
    const results: HookExecutionResult[] = [];

    logger.info(`Executing ${sortedHooks.length} posthooks...`);

    for (const { hook, options } of sortedHooks) {
      const hookResult = await this.executeHook(
        hook.name,
        () => hook.execute(context, result),
        options
      );

      results.push(hookResult);

      // PostHooks continue even on failure (by default)
      if (hookResult.status === 'failed' && !options.continueOnFailure) {
        logger.warning(`PostHook "${hook.name}" failed but continuing: ${hookResult.error}`);
      }
    }

    return results;
  }

  /**
   * Execute all error hooks
   */
  async executeErrorHooks(
    context: HookContext,
    error: Error
  ): Promise<HookExecutionResult[]> {
    const sortedHooks = this.getSortedHooks(this.errorHooks);
    const results: HookExecutionResult[] = [];

    logger.info(`Executing ${sortedHooks.length} error hooks...`);

    for (const { hook, options } of sortedHooks) {
      const hookResult = await this.executeHook(
        hook.name,
        () => hook.execute(context, error),
        options
      );

      results.push(hookResult);

      // Error hooks never block (always continue on failure)
      if (hookResult.status === 'failed') {
        logger.warning(`ErrorHook "${hook.name}" failed: ${hookResult.error}`);
      }
    }

    return results;
  }

  /**
   * Execute a single hook with timeout and error handling
   */
  private async executeHook(
    hookName: string,
    executor: () => Promise<void>,
    options: HookOptions
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();

    try {
      // Execute with optional timeout
      if (options.timeout) {
        await this.withTimeout(executor(), options.timeout);
      } else {
        await executor();
      }

      const durationMs = Date.now() - startTime;

      logger.success(`✓ Hook "${hookName}" completed in ${durationMs}ms`);

      return {
        hookName,
        status: 'success',
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      logger.error(`✗ Hook "${hookName}" failed: ${errorMessage}`);

      return {
        hookName,
        status: 'failed',
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Get hooks sorted by priority
   */
  private getSortedHooks<T extends PreHook | PostHook | ErrorHook>(
    hookMap: Map<string, HookRegistryEntry<T>>
  ): HookRegistryEntry<T>[] {
    return Array.from(hookMap.values()).sort(
      (a, b) => a.hook.priority - b.hook.priority
    );
  }

  /**
   * Get all registered hook names
   */
  getRegisteredHooks(): {
    preHooks: string[];
    postHooks: string[];
    errorHooks: string[];
  } {
    return {
      preHooks: Array.from(this.preHooks.keys()),
      postHooks: Array.from(this.postHooks.keys()),
      errorHooks: Array.from(this.errorHooks.keys()),
    };
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.preHooks.clear();
    this.postHooks.clear();
    this.errorHooks.clear();
    logger.info('All hooks cleared');
  }

  /**
   * Get hook count
   */
  getHookCount(): number {
    return this.preHooks.size + this.postHooks.size + this.errorHooks.size;
  }
}
