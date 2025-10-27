/**
 * Tool Creator Interface
 *
 * Solves circular dependency between agent-template.ts and dynamic-tool-creator.ts
 */

import { ToolRequirement } from './agent-analysis';

/**
 * Tool Creator Interface (to avoid circular dependency)
 */
export interface IToolCreator {
  /**
   * Create a simple tool with minimal specification
   */
  createSimpleTool(
    name: string,
    description: string,
    type: 'command' | 'api' | 'library' | 'service',
    params?: Record<string, any>
  ): Promise<{ success: boolean; tool?: any; error?: string; durationMs: number }>;

  /**
   * Create tool from natural language description
   */
  createToolFromDescription(
    description: string,
    context: {
      agentInstanceId: string;
      taskId: string;
      timestamp: string;
    }
  ): Promise<{ success: boolean; tool?: any; error?: string; durationMs: number }>;

  /**
   * Create and execute tool in one step
   */
  createAndExecuteTool(
    requirement: ToolRequirement,
    params: any,
    context: {
      agentInstanceId: string;
      taskId: string;
      timestamp: string;
    }
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    durationMs: number;
    toolId: string;
  }>;

  /**
   * Execute a dynamic tool
   */
  executeTool(
    tool: any,
    params: any,
    context: {
      agentInstanceId: string;
      taskId: string;
      timestamp: string;
    }
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    durationMs: number;
    toolId: string;
  }>;

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDurationMs: number;
    toolsCreated: number;
  };

  /**
   * Get tool execution history
   */
  getExecutionHistory(): Array<{
    toolId: string;
    context: any;
    result: any;
  }>;

  /**
   * Clear execution cache and history
   */
  clear(): void;
}
