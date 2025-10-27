/**
 * DynamicToolCreator - Runtime tool creation for agents
 *
 * Allows agents to create and use tools dynamically during execution
 */

import {
  ToolRequirement,
  DynamicToolSpec,
  ToolCreationResult,
} from './types/agent-analysis';
import type { IToolCreator } from './types/tool-creator-interface';
import { ToolFactory } from './tool-factory';
import { SecurityValidator } from './utils/security-validator';
import { logger } from './ui/index';

/**
 * Dynamic tool execution context
 */
export interface DynamicToolContext {
  /** Agent instance ID */
  agentInstanceId: string;

  /** Task ID */
  taskId: string;

  /** Execution timestamp */
  timestamp: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Whether execution was successful */
  success: boolean;

  /** Result data */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Execution time (ms) */
  durationMs: number;

  /** Tool ID */
  toolId: string;
}

export class DynamicToolCreator implements IToolCreator {
  private toolFactory: ToolFactory;
  private executionCache: Map<string, any> = new Map();
  private toolExecutionHistory: Array<{
    toolId: string;
    context: DynamicToolContext;
    result: ToolExecutionResult;
  }> = [];

  constructor() {
    this.toolFactory = ToolFactory.getInstance();
  }

  /**
   * Create and execute a tool in one step
   */
  async createAndExecuteTool(
    requirement: ToolRequirement,
    params: any,
    context: DynamicToolContext
  ): Promise<ToolExecutionResult> {
    logger.info(
      `[DynamicToolCreator] Creating and executing tool: ${requirement.name}`
    );

    // Step 1: Create tool
    const creationResult = await this.toolFactory.createTool(requirement);

    if (!creationResult.success || !creationResult.tool) {
      return {
        success: false,
        error: creationResult.error || 'Tool creation failed',
        durationMs: creationResult.durationMs,
        toolId: 'unknown',
      };
    }

    // Step 2: Execute tool
    return this.executeTool(creationResult.tool, params, context);
  }

  /**
   * Execute a dynamic tool
   */
  async executeTool(
    tool: DynamicToolSpec,
    params: any,
    context: DynamicToolContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    logger.info(`[DynamicToolCreator] Executing tool: ${tool.name} (${tool.id})`);

    try {
      let result: any;

      // Execute based on implementation type
      switch (tool.implementationType) {
        case 'function':
          result = await this.executeFunctionTool(tool, params);
          break;
        case 'class':
          result = await this.executeClassTool(tool, params);
          break;
        case 'command-wrapper':
          result = await this.executeCommandTool(tool, params);
          break;
        case 'api-wrapper':
          result = await this.executeApiTool(tool, params);
          break;
        default:
          throw new Error(`Unknown implementation type: ${tool.implementationType}`);
      }

      const durationMs = Date.now() - startTime;

      const executionResult: ToolExecutionResult = {
        success: true,
        result,
        durationMs,
        toolId: tool.id,
      };

      // Store in history
      this.toolExecutionHistory.push({
        toolId: tool.id,
        context,
        result: executionResult,
      });

      logger.success(`✓ Tool executed: ${tool.name} (${durationMs}ms)`);

      return executionResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      const executionResult: ToolExecutionResult = {
        success: false,
        error: (error as Error).message,
        durationMs,
        toolId: tool.id,
      };

      logger.error(`Tool execution failed: ${(error as Error).message}`);

      return executionResult;
    }
  }

  /**
   * Execute function-type tool
   */
  private async executeFunctionTool(
    tool: DynamicToolSpec,
    params: any
  ): Promise<any> {
    if (typeof tool.implementation !== 'string') {
      throw new Error('Function tool requires string implementation');
    }

    // Security validation before execution
    logger.info(`[Security] Validating function tool code: ${tool.name}`);
    const validation = SecurityValidator.validate(tool.implementation);

    if (!validation.safe) {
      const criticalIssues = validation.issues.filter((issue) => issue.severity >= 90);

      logger.error(`[Security] Code validation failed for ${tool.name}`);
      logger.error(`  Critical issues: ${criticalIssues.length}`);

      throw new Error(
        `Security validation failed: ${criticalIssues.length} critical issue(s) detected\n` +
        criticalIssues.map((issue) => `  - ${issue.message}`).join('\n')
      );
    }

    const securityScore = SecurityValidator.getSecurityScore(tool.implementation);
    logger.success(`[Security] ✓ Code validated (score: ${securityScore}/100)`);

    // In a real implementation, this would use vm module or eval
    // For safety, we'll just simulate execution
    logger.info(`Simulating function tool execution: ${tool.name}`);

    return {
      success: true,
      message: `Function tool ${tool.name} executed`,
      params,
      securityScore,
    };
  }

  /**
   * Execute class-type tool
   */
  private async executeClassTool(
    tool: DynamicToolSpec,
    params: any
  ): Promise<any> {
    if (typeof tool.implementation !== 'string') {
      throw new Error('Class tool requires string implementation');
    }

    // Security validation before execution
    logger.info(`[Security] Validating class tool code: ${tool.name}`);
    const validation = SecurityValidator.validate(tool.implementation);

    if (!validation.safe) {
      const criticalIssues = validation.issues.filter((issue) => issue.severity >= 90);

      logger.error(`[Security] Code validation failed for ${tool.name}`);
      logger.error(`  Critical issues: ${criticalIssues.length}`);

      throw new Error(
        `Security validation failed: ${criticalIssues.length} critical issue(s) detected\n` +
        criticalIssues.map((issue) => `  - ${issue.message}`).join('\n')
      );
    }

    const securityScore = SecurityValidator.getSecurityScore(tool.implementation);
    logger.success(`[Security] ✓ Code validated (score: ${securityScore}/100)`);

    // Simulate class instantiation and execution
    logger.info(`Simulating class tool execution: ${tool.name}`);

    return {
      success: true,
      message: `Class tool ${tool.name} executed`,
      params,
      securityScore,
    };
  }

  /**
   * Execute command-type tool
   */
  private async executeCommandTool(
    tool: DynamicToolSpec,
    params: any
  ): Promise<any> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Build command
    const command = tool.name;
    const args = Object.entries(params)
      .map(([key, value]) => `--${key}=${value}`)
      .join(' ');

    const fullCommand = `${command} ${args}`;

    logger.info(`Executing command: ${fullCommand}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand);

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command: fullCommand,
      };
    } catch (error) {
      throw new Error(`Command failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute API-type tool
   */
  private async executeApiTool(
    _tool: DynamicToolSpec,
    params: any
  ): Promise<any> {
    const url = params.url;
    const method = params.method || 'GET';
    const headers = params.headers || {};

    logger.info(`API request: ${method} ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify(params.body) : undefined,
      });

      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data,
      };
    } catch (error) {
      throw new Error(`API request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create a simple tool with minimal specification
   */
  async createSimpleTool(
    name: string,
    description: string,
    type: 'command' | 'api' | 'library' | 'service',
    params: Record<string, any> = {}
  ): Promise<ToolCreationResult> {
    const requirement: ToolRequirement = {
      name,
      type,
      description,
      parameters: params,
      priority: 10,
      critical: false,
    };

    return this.toolFactory.createTool(requirement);
  }

  /**
   * Create a tool from natural language description
   */
  async createToolFromDescription(
    description: string,
    _context: DynamicToolContext
  ): Promise<ToolCreationResult> {
    logger.info('[DynamicToolCreator] Analyzing tool description...');

    // Simple NLP-based tool creation (in real implementation, use AI)
    const analysis = this.analyzeDescription(description);

    const requirement: ToolRequirement = {
      name: analysis.name,
      type: analysis.type,
      description: analysis.description,
      parameters: analysis.parameters,
      priority: 10,
      critical: false,
    };

    return this.toolFactory.createTool(requirement);
  }

  /**
   * Analyze tool description (simple heuristic-based)
   */
  private analyzeDescription(description: string): {
    name: string;
    type: 'command' | 'api' | 'library' | 'service';
    description: string;
    parameters: Record<string, any>;
  } {
    const lower = description.toLowerCase();

    // Infer type
    let type: 'command' | 'api' | 'library' | 'service' = 'command';

    if (lower.includes('api') || lower.includes('http') || lower.includes('request')) {
      type = 'api';
    } else if (lower.includes('service') || lower.includes('cloud')) {
      type = 'service';
    } else if (lower.includes('library') || lower.includes('package')) {
      type = 'library';
    }

    // Extract name (simple heuristic)
    const words = description.split(' ');
    const name = words[0].toLowerCase().replace(/[^a-z0-9]/g, '_');

    return {
      name,
      type,
      description,
      parameters: {},
    };
  }

  /**
   * Get tool execution history
   */
  getExecutionHistory(): Array<{
    toolId: string;
    context: DynamicToolContext;
    result: ToolExecutionResult;
  }> {
    return [...this.toolExecutionHistory];
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDurationMs: number;
    toolsCreated: number;
  } {
    const totalExecutions = this.toolExecutionHistory.length;
    const successfulExecutions = this.toolExecutionHistory.filter(
      (h) => h.result.success
    ).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    const totalDuration = this.toolExecutionHistory.reduce(
      (sum, h) => sum + h.result.durationMs,
      0
    );
    const averageDurationMs =
      totalExecutions > 0 ? totalDuration / totalExecutions : 0;

    const toolsCreated = this.toolFactory.getAllTools().length;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDurationMs: Math.round(averageDurationMs),
      toolsCreated,
    };
  }

  /**
   * Clear execution cache and history
   */
  clear(): void {
    this.executionCache.clear();
    this.toolExecutionHistory = [];
    logger.info('Dynamic tool creator cleared');
  }

  /**
   * Export tool for reuse
   */
  async exportTool(toolId: string, outputPath: string): Promise<boolean> {
    return this.toolFactory.exportTool(toolId, outputPath);
  }
}
