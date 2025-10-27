/**
 * DynamicAgent - Generic agent that executes based on AgentTemplate
 *
 * Allows runtime creation of agents without predefined classes
 */

import { BaseAgent } from './base-agent';
import { Task, AgentResult, AgentConfig, AgentType } from './types/index';
import {
  AgentTemplate,
  AgentExecutionContext,
  AgentInstance,
  AgentExecutionRecord,
} from './types/agent-template';
import { HookManager } from './hooks/hook-manager';
import { DynamicToolCreator } from './dynamic-tool-creator';

export class DynamicAgent extends BaseAgent {
  private template: AgentTemplate;
  private instanceId: string;
  private executionHistory: AgentExecutionRecord[] = [];
  private state: Map<string, any> = new Map();
  private status: 'idle' | 'running' | 'completed' | 'failed' = 'idle';

  constructor(template: AgentTemplate, config: AgentConfig, hookManager?: HookManager) {
    super(template.name as AgentType, config);
    this.template = template;
    this.instanceId = `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (hookManager) {
      this.setHookManager(hookManager);
    }
  }

  /**
   * Execute task using template executor
   */
  async execute(task: Task): Promise<AgentResult> {
    this.status = 'running';
    this.currentTask = task;

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const startTime = new Date().toISOString();

    this.log(`Executing task ${task.id} with template ${this.template.name}`);

    try {
      // Create tool creator for this execution
      const toolCreator = new DynamicToolCreator();

      // Create execution context
      const context: AgentExecutionContext = {
        config: this.config,
        hookManager: this.getHookManager(),
        startTime: Date.now(),
        state: this.state,
        log: this.log.bind(this),
        utils: {
          sleep: this.sleep.bind(this),
          retry: this.retry.bind(this),
          executeCommand: this.executeCommand.bind(this),
        },
        toolCreator,
      };

      // Execute template function
      const result = await this.template.executor(task, context);

      // Record execution
      const endTime = new Date().toISOString();
      this.executionHistory.push({
        executionId,
        taskId: task.id,
        startTime,
        endTime,
        durationMs: Date.now() - this.startTime,
        result,
      });

      this.status = 'completed';
      this.log(`Task ${task.id} completed successfully`);

      return result;
    } catch (error) {
      // Record failed execution
      const endTime = new Date().toISOString();
      this.executionHistory.push({
        executionId,
        taskId: task.id,
        startTime,
        endTime,
        durationMs: Date.now() - this.startTime,
        error: (error as Error).message,
      });

      this.status = 'failed';
      this.log(`Task ${task.id} failed: ${(error as Error).message}`);

      throw error;
    }
  }

  /**
   * Initialize agent (if template provides initialization)
   */
  async initialize(): Promise<void> {
    if (this.template.initialize) {
      this.log(`Initializing ${this.template.name}`);
      await this.template.initialize(this.config);
      this.log(`Initialization complete`);
    }
  }

  /**
   * Cleanup agent (if template provides cleanup)
   */
  async cleanup(): Promise<void> {
    if (this.template.cleanup) {
      this.log(`Cleaning up ${this.template.name}`);
      await this.template.cleanup(this.config);
      this.log(`Cleanup complete`);
    }
  }

  /**
   * Get agent instance information
   */
  getInstanceInfo(): AgentInstance {
    return {
      instanceId: this.instanceId,
      templateId: this.template.id,
      agentType: this.template.name,
      config: this.config,
      hookManager: this.getHookManager(),
      createdAt: new Date().toISOString(),
      status: this.status,
      currentTask: this.currentTask,
      executionHistory: this.executionHistory,
      metadata: this.template.metadata,
    };
  }

  /**
   * Get template
   */
  getTemplate(): AgentTemplate {
    return this.template;
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): AgentExecutionRecord[] {
    return [...this.executionHistory];
  }

  /**
   * Get current status
   */
  getStatus(): 'idle' | 'running' | 'completed' | 'failed' {
    return this.status;
  }

  /**
   * Get shared state
   */
  getState(): Map<string, any> {
    return this.state;
  }

  /**
   * Set state value
   */
  setState(key: string, value: any): void {
    this.state.set(key, value);
  }

  /**
   * Get state value
   */
  getStateValue(key: string): any {
    return this.state.get(key);
  }

  /**
   * Clear state
   */
  clearState(): void {
    this.state.clear();
  }

  /**
   * Check if agent can handle task
   */
  canHandleTask(task: Task): boolean {
    // Check if task type is supported
    if (!this.template.supportedTypes.includes(task.type)) {
      return false;
    }

    // Check required capabilities (if specified)
    if (this.template.requiredCapabilities) {
      // In a real implementation, check against available capabilities
      // For now, assume all capabilities are available
    }

    return true;
  }

  /**
   * Get hook manager (protected accessor)
   */
  private getHookManager(): HookManager | undefined {
    // Access through protected property
    return (this as any).hookManager;
  }

  /**
   * Set hook manager (protected mutator)
   */
  private setHookManager(hookManager: HookManager): void {
    // Set through protected property
    (this as any).hookManager = hookManager;
  }
}
