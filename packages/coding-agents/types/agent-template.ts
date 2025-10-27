/**
 * Agent Template Types
 *
 * Defines structures for dynamic agent creation and assignment
 */

import { Task, AgentResult, AgentConfig } from './index';
import { HookManager } from '../hooks/hook-manager';
import type { IToolCreator } from './tool-creator-interface';

/**
 * Agent execution function signature
 */
export type AgentExecutor = (task: Task, context: AgentExecutionContext) => Promise<AgentResult>;

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  /** Agent configuration */
  config: AgentConfig;

  /** Hook manager */
  hookManager?: HookManager;

  /** Start time */
  startTime: number;

  /** Shared state between executions */
  state: Map<string, any>;

  /** Logger instance */
  log: (message: string) => void;

  /** Utility functions */
  utils: {
    sleep: (ms: number) => Promise<void>;
    retry: <T>(operation: () => Promise<T>, maxRetries?: number) => Promise<T>;
    executeCommand: (command: string, options?: any) => Promise<any>;
  };

  /** Dynamic tool creator (allows agents to create tools at runtime) */
  toolCreator?: IToolCreator;
}

/**
 * Agent template definition
 */
export interface AgentTemplate {
  /** Unique template identifier */
  id: string;

  /** Agent name */
  name: string;

  /** Agent description */
  description: string;

  /** Agent version */
  version: string;

  /** Supported task types */
  supportedTypes: Array<'feature' | 'bug' | 'refactor' | 'docs' | 'test' | 'deployment'>;

  /** Agent priority (higher = preferred for assignment) */
  priority: number;

  /** Required capabilities */
  requiredCapabilities?: string[];

  /** Agent executor function */
  executor: AgentExecutor;

  /** Optional initialization function */
  initialize?: (config: AgentConfig) => Promise<void>;

  /** Optional cleanup function */
  cleanup?: (config: AgentConfig) => Promise<void>;

  /** Metadata */
  metadata?: {
    author?: string;
    createdAt?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * Agent instance
 */
export interface AgentInstance {
  /** Instance ID */
  instanceId: string;

  /** Template ID */
  templateId: string;

  /** Agent type */
  agentType: string;

  /** Configuration */
  config: AgentConfig;

  /** Hook manager */
  hookManager?: HookManager;

  /** Creation timestamp */
  createdAt: string;

  /** Current status */
  status: 'idle' | 'running' | 'completed' | 'failed';

  /** Current task (if running) */
  currentTask?: Task;

  /** Execution history */
  executionHistory: AgentExecutionRecord[];

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent execution record
 */
export interface AgentExecutionRecord {
  /** Execution ID */
  executionId: string;

  /** Task ID */
  taskId: string;

  /** Start time */
  startTime: string;

  /** End time */
  endTime?: string;

  /** Duration in milliseconds */
  durationMs?: number;

  /** Result */
  result?: AgentResult;

  /** Error (if failed) */
  error?: string;
}

/**
 * Agent assignment criteria
 */
export interface AgentAssignmentCriteria {
  /** Task to assign */
  task: Task;

  /** Required agent type (optional) */
  agentType?: string;

  /** Required capabilities */
  requiredCapabilities?: string[];

  /** Prefer existing instance over new creation */
  preferExisting?: boolean;

  /** Maximum number of concurrent tasks per agent */
  maxConcurrentTasks?: number;

  /** Additional filters */
  filters?: Record<string, any>;
}

/**
 * Agent assignment result
 */
export interface AgentAssignmentResult {
  /** Success status */
  success: boolean;

  /** Assigned agent instance */
  agentInstance?: AgentInstance;

  /** Whether a new agent was created */
  wasCreated: boolean;

  /** Assignment reason */
  reason: string;

  /** Alternative agents (if assignment failed) */
  alternatives?: AgentInstance[];

  /** Error message (if failed) */
  error?: string;
}

/**
 * Agent capability
 */
export interface AgentCapability {
  /** Capability name */
  name: string;

  /** Capability description */
  description: string;

  /** Version */
  version: string;

  /** Whether capability is required */
  required: boolean;
}

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  /** Template */
  template: AgentTemplate;

  /** Active instances */
  instances: AgentInstance[];

  /** Total executions */
  totalExecutions: number;

  /** Success rate */
  successRate: number;

  /** Average duration */
  averageDurationMs: number;

  /** Registration timestamp */
  registeredAt: string;
}
