/**
 * Miyabi Agent SDK - Core Type Definitions
 *
 * This module provides TypeScript type definitions for building
 * autonomous agents in the Miyabi ecosystem.
 */

/**
 * Agent execution context containing environment and configuration
 */
export interface AgentContext {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** GitHub issue number (if applicable) */
  issueNumber?: number;
  /** GitHub token for API access */
  token: string;
  /** Agent working directory */
  workdir: string;
  /** Agent configuration */
  config: AgentConfig;
}

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** Agent name/identifier */
  name: string;
  /** Agent role description */
  role: string;
  /** Agent priority level (1-5, 1 = highest) */
  priority: number;
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Escalation rules */
  escalation?: EscalationConfig;
}

/**
 * Retry configuration for agent operations
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Delay between retries in milliseconds */
  delayMs: number;
  /** Backoff strategy */
  backoff?: 'linear' | 'exponential';
}

/**
 * Escalation configuration for failed operations
 */
export interface EscalationConfig {
  /** Severity level for escalation */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Target role/person for escalation */
  target: string;
  /** Channels for escalation notification */
  channels: string[];
}

/**
 * Result of an agent execution
 */
export interface AgentResult {
  /** Execution status */
  status: 'success' | 'failure' | 'partial' | 'timeout';
  /** Human-readable message */
  message: string;
  /** Execution metrics */
  metrics: AgentMetrics;
  /** Artifacts produced during execution */
  artifacts?: AgentArtifact[];
  /** Error information (if failed) */
  error?: AgentError;
}

/**
 * Agent execution metrics
 */
export interface AgentMetrics {
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt: string;
  /** Total execution duration in milliseconds */
  durationMs: number;
  /** Number of operations performed */
  operationCount: number;
  /** Number of API calls made */
  apiCallCount: number;
  /** Token usage (for AI agents) */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Artifact produced by agent execution
 */
export interface AgentArtifact {
  /** Artifact type */
  type: 'file' | 'report' | 'log' | 'metric';
  /** Artifact name/identifier */
  name: string;
  /** File path or content */
  path?: string;
  content?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
}

/**
 * Agent error information
 */
export interface AgentError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Original error object */
  cause?: unknown;
  /** Retry information */
  retryable?: boolean;
}

/**
 * Task definition for agent execution
 */
export interface AgentTask {
  /** Task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type */
  type: 'development' | 'review' | 'deployment' | 'bugfix' | 'documentation' | 'testing';
  /** Task priority */
  priority: number;
  /** Task status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  /** Assigned agent */
  assignedAgent?: string;
  /** Task dependencies */
  dependencies?: string[];
  /** Task labels */
  labels?: string[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * GitHub issue data
 */
export interface GitHubIssue {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body/description */
  body: string;
  /** Issue state */
  state: 'open' | 'closed';
  /** Issue labels */
  labels: string[];
  /** Issue assignees */
  assignees: string[];
  /** Issue creator */
  author: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * GitHub pull request data
 */
export interface GitHubPullRequest {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR body/description */
  body: string;
  /** PR state */
  state: 'open' | 'closed' | 'merged';
  /** Source branch */
  head: string;
  /** Target branch */
  base: string;
  /** PR labels */
  labels: string[];
  /** PR author */
  author: string;
  /** Review status */
  reviewStatus?: 'approved' | 'changes_requested' | 'pending';
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /** Target environment */
  environment: 'staging' | 'production';
  /** Firebase project ID */
  projectId: string;
  /** Deployment URL */
  url: string;
  /** Auto-deploy flag */
  autoDeploy: boolean;
  /** Approval required flag */
  approvalRequired: boolean;
  /** Health check configuration */
  healthCheck: HealthCheckConfig;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Health check URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST';
  /** Expected status code */
  expectedStatus: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts */
  retries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  /** Deployment status */
  status: 'success' | 'failed' | 'rolled_back';
  /** Environment deployed to */
  environment: string;
  /** Deployed version */
  version: string;
  /** Deployment URL */
  url: string;
  /** Deployment duration in milliseconds */
  durationMs: number;
  /** Health check results */
  healthCheckAttempts: number;
  /** Rollback flag */
  rolledBack: boolean;
  /** Error information (if failed) */
  error?: AgentError;
}
