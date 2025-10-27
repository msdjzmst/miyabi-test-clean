/**
 * Custom Error Classes for Intelligent Agent System
 *
 * Provides detailed error classification and context
 */

/**
 * Base Agent Error
 */
export class AgentError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;
  public readonly timestamp: string;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    context?: Record<string, any>,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.recoverable = recoverable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}

/**
 * Analysis Error - Task analysis failures
 */
export class AnalysisError extends AgentError {
  constructor(message: string, context?: Record<string, any>, recoverable: boolean = true) {
    super(message, 'ANALYSIS_ERROR', context, recoverable);
  }

  static complexityCalculationFailed(taskId: string, reason: string): AnalysisError {
    return new AnalysisError('Failed to calculate task complexity', {
      taskId,
      reason,
      stage: 'complexity_calculation',
    });
  }

  static capabilityDetectionFailed(taskId: string, reason: string): AnalysisError {
    return new AnalysisError('Failed to detect required capabilities', {
      taskId,
      reason,
      stage: 'capability_detection',
    });
  }

  static strategyDeterminationFailed(taskId: string, reason: string): AnalysisError {
    return new AnalysisError('Failed to determine assignment strategy', {
      taskId,
      reason,
      stage: 'strategy_determination',
    });
  }
}

/**
 * Tool Creation Error - Dynamic tool generation failures
 */
export class ToolCreationError extends AgentError {
  constructor(message: string, context?: Record<string, any>, recoverable: boolean = true) {
    super(message, 'TOOL_CREATION_ERROR', context, recoverable);
  }

  static invalidToolType(toolName: string, toolType: string): ToolCreationError {
    return new ToolCreationError('Invalid tool type specified', {
      toolName,
      toolType,
      validTypes: ['command', 'api', 'library', 'service'],
    });
  }

  static codeGenerationFailed(toolName: string, reason: string): ToolCreationError {
    return new ToolCreationError('Failed to generate tool code', {
      toolName,
      reason,
      stage: 'code_generation',
    });
  }

  static toolExecutionFailed(
    toolId: string,
    toolName: string,
    reason: string
  ): ToolCreationError {
    return new ToolCreationError('Tool execution failed', {
      toolId,
      toolName,
      reason,
      stage: 'execution',
    });
  }
}

/**
 * Assignment Error - Agent assignment failures
 */
export class AssignmentError extends AgentError {
  constructor(message: string, context?: Record<string, any>, recoverable: boolean = true) {
    super(message, 'ASSIGNMENT_ERROR', context, recoverable);
  }

  static noTemplateFound(taskType: string): AssignmentError {
    return new AssignmentError('No template found for task type', {
      taskType,
      stage: 'template_selection',
    }, false);
  }

  static agentCreationFailed(templateId: string, reason: string): AssignmentError {
    return new AssignmentError('Failed to create agent instance', {
      templateId,
      reason,
      stage: 'agent_creation',
    });
  }

  static maxConcurrentTasksReached(agentId: string, maxTasks: number): AssignmentError {
    return new AssignmentError('Agent has reached maximum concurrent tasks', {
      agentId,
      maxTasks,
      stage: 'concurrency_check',
    });
  }
}

/**
 * Execution Error - Agent execution failures
 */
export class ExecutionError extends AgentError {
  constructor(message: string, context?: Record<string, any>, recoverable: boolean = true) {
    super(message, 'EXECUTION_ERROR', context, recoverable);
  }

  static templateExecutorFailed(
    templateId: string,
    taskId: string,
    reason: string
  ): ExecutionError {
    return new ExecutionError('Template executor failed', {
      templateId,
      taskId,
      reason,
      stage: 'template_execution',
    });
  }

  static hookExecutionFailed(
    hookName: string,
    hookType: 'pre' | 'post' | 'error',
    reason: string
  ): ExecutionError {
    return new ExecutionError('Hook execution failed', {
      hookName,
      hookType,
      reason,
      stage: 'hook_execution',
    });
  }

  static resourceExhausted(resourceType: string, limit: any): ExecutionError {
    return new ExecutionError('Resource exhausted during execution', {
      resourceType,
      limit,
      stage: 'resource_check',
    }, false);
  }
}

/**
 * Timeout Error - Operation timeout failures
 */
export class TimeoutError extends AgentError {
  public readonly operation: string;
  public readonly timeoutMs: number;
  public readonly elapsedMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    elapsedMs: number,
    context?: Record<string, any>
  ) {
    super(
      `Operation '${operation}' timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms)`,
      'TIMEOUT_ERROR',
      context,
      false
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
  }

  static analysisTimeout(taskId: string, timeoutMs: number, elapsedMs: number): TimeoutError {
    return new TimeoutError('task_analysis', timeoutMs, elapsedMs, {
      taskId,
      stage: 'analysis',
    });
  }

  static toolCreationTimeout(
    toolName: string,
    timeoutMs: number,
    elapsedMs: number
  ): TimeoutError {
    return new TimeoutError('tool_creation', timeoutMs, elapsedMs, {
      toolName,
      stage: 'tool_creation',
    });
  }

  static executionTimeout(
    taskId: string,
    agentId: string,
    timeoutMs: number,
    elapsedMs: number
  ): TimeoutError {
    return new TimeoutError('agent_execution', timeoutMs, elapsedMs, {
      taskId,
      agentId,
      stage: 'execution',
    });
  }
}

/**
 * Error Utilities
 */
export class ErrorUtils {
  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof AgentError) {
      return error.recoverable;
    }
    return true; // Assume unknown errors are recoverable
  }

  /**
   * Get error code
   */
  static getErrorCode(error: Error): string {
    if (error instanceof AgentError) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error context
   */
  static getErrorContext(error: Error): Record<string, any> | undefined {
    if (error instanceof AgentError) {
      return error.context;
    }
    return undefined;
  }

  /**
   * Format error for logging
   */
  static formatError(error: Error): string {
    if (error instanceof AgentError) {
      return JSON.stringify(error.toJSON(), null, 2);
    }
    return `${error.name}: ${error.message}\n${error.stack}`;
  }

  /**
   * Create error from unknown error
   */
  static wrapError(error: unknown, defaultMessage: string = 'Unknown error occurred'): AgentError {
    if (error instanceof AgentError) {
      return error;
    }

    if (error instanceof Error) {
      return new AgentError(error.message, 'WRAPPED_ERROR', {
        originalName: error.name,
        originalStack: error.stack,
      });
    }

    return new AgentError(defaultMessage, 'UNKNOWN_ERROR', {
      originalError: String(error),
    });
  }
}
