/**
 * Core type definitions
 *
 * This is a placeholder implementation. Full type system coming soon.
 */

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  description?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * Agent result
 */
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}
