/**
 * Hook System Types
 *
 * Provides extensible prehook/posthook mechanism for Agent lifecycle
 */

import { Task, AgentResult, AgentConfig } from './index';

/**
 * Hook execution context
 */
export interface HookContext {
  /** Agent type executing the hook */
  agentType: string;

  /** Current task being executed */
  task: Task;

  /** Agent configuration */
  config: AgentConfig;

  /** Timestamp when agent execution started */
  startTime: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * PreHook - Executed before agent execution
 */
export interface PreHook {
  /** Unique hook identifier */
  name: string;

  /** Hook description */
  description: string;

  /** Hook priority (lower = earlier execution) */
  priority: number;

  /**
   * Execute the prehook
   * @param context - Hook execution context
   * @throws Error if prehook fails (blocks agent execution)
   */
  execute(context: HookContext): Promise<void>;
}

/**
 * PostHook - Executed after agent execution
 */
export interface PostHook {
  /** Unique hook identifier */
  name: string;

  /** Hook description */
  description: string;

  /** Hook priority (lower = earlier execution) */
  priority: number;

  /**
   * Execute the posthook
   * @param context - Hook execution context
   * @param result - Agent execution result
   * @throws Error if posthook fails (does not rollback agent execution)
   */
  execute(context: HookContext, result: AgentResult): Promise<void>;
}

/**
 * ErrorHook - Executed when agent encounters an error
 */
export interface ErrorHook {
  /** Unique hook identifier */
  name: string;

  /** Hook description */
  description: string;

  /** Hook priority (lower = earlier execution) */
  priority: number;

  /**
   * Execute the error hook
   * @param context - Hook execution context
   * @param error - Error that occurred
   */
  execute(context: HookContext, error: Error): Promise<void>;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  /** Hook name */
  hookName: string;

  /** Execution status */
  status: 'success' | 'failed' | 'skipped';

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Error if hook failed */
  error?: string;

  /** Additional notes */
  notes?: string;
}

/**
 * Hook configuration options
 */
export interface HookOptions {
  /** Whether to continue execution if hook fails */
  continueOnFailure?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to run in background (non-blocking) */
  runInBackground?: boolean;
}

/**
 * Hook registry entry
 */
export interface HookRegistryEntry<T extends PreHook | PostHook | ErrorHook> {
  hook: T;
  options: HookOptions;
}
