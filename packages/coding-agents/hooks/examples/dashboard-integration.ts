/**
 * Dashboard Integration Example
 *
 * Demonstrates how to integrate agents with dashboard using DashboardWebhookHook
 */

import { BaseAgent } from '../../base-agent';
import { Task, AgentResult, AgentConfig } from '../../types/index';
import {
  HookManager,
  DashboardWebhookHook,
  EnvironmentCheckHook,
  CleanupHook,
} from '../index';
import { HookContext } from '../../types/hooks';

/**
 * Example Agent with Dashboard Integration
 */
class DashboardIntegratedAgent extends BaseAgent {
  private hookManager: HookManager;
  private dashboardHook: DashboardWebhookHook;

  constructor(config: AgentConfig) {
    super('DashboardIntegratedAgent' as import('../../types/index.js').AgentType, config);

    // Initialize hook manager
    this.hookManager = new HookManager();

    // Create dashboard webhook hook
    this.dashboardHook = new DashboardWebhookHook({
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
      webhookPath: '/api/agent-event',
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      silent: false,
      sessionId: `session-${Date.now()}`,
      deviceIdentifier: config.deviceIdentifier,
    });

    // Register as PreHook (sends agent:started event)
    this.hookManager.registerPreHook(this.dashboardHook, {
      continueOnFailure: true, // Don't block if dashboard is down
      runInBackground: false,
    });

    // Register as PostHook (sends agent:completed event)
    this.hookManager.registerPostHook(this.dashboardHook, {
      continueOnFailure: true,
      runInBackground: true, // Non-blocking
    });

    // Register as ErrorHook (sends agent:error event)
    this.hookManager.registerErrorHook(this.dashboardHook, {
      continueOnFailure: true,
      runInBackground: false,
    });

    // Add other hooks
    this.hookManager.registerPreHook(
      new EnvironmentCheckHook(['GITHUB_TOKEN'])
    );

    this.hookManager.registerPostHook(
      new CleanupHook({ tempDirs: ['.temp'] })
    );
  }

  async execute(task: Task): Promise<AgentResult> {
    this.log('Executing task with dashboard tracking...');

    const context: HookContext = {
      agentType: this.agentType,
      task,
      config: this.config,
      startTime: this.startTime,
    };

    // Send progress updates during execution
    await this.sendProgressUpdate(context, 'Analyzing requirements', 10, ['init'], [
      'analyze',
      'implement',
      'test',
      'complete',
    ]);

    // Simulate work: Analyzing
    await this.sleep(1000);

    await this.sendProgressUpdate(context, 'Implementing solution', 40, ['init', 'analyze'], [
      'implement',
      'test',
      'complete',
    ]);

    // Simulate work: Implementing
    await this.sleep(2000);

    await this.sendProgressUpdate(
      context,
      'Running tests',
      70,
      ['init', 'analyze', 'implement'],
      ['test', 'complete']
    );

    // Simulate work: Testing
    await this.sleep(1000);

    await this.sendProgressUpdate(
      context,
      'Finalizing',
      90,
      ['init', 'analyze', 'implement', 'test'],
      ['complete']
    );

    // Simulate work: Finalizing
    await this.sleep(500);

    return {
      status: 'success',
      data: {
        message: 'Task completed with dashboard tracking',
        filesChanged: 5,
        testsAdded: 3,
      },
      metrics: {
        qualityScore: 85,
        linesChanged: 150,
        testsAdded: 3,
        coveragePercent: 80,
      },
    };
  }

  /**
   * Send progress update to dashboard
   */
  private async sendProgressUpdate(
    context: HookContext,
    currentStep: string,
    percentage: number,
    completedSteps: string[],
    remainingSteps: string[]
  ): Promise<void> {
    try {
      await this.dashboardHook.sendProgress(
        context,
        currentStep,
        percentage,
        completedSteps,
        remainingSteps
      );
    } catch (error) {
      // Ignore errors - don't block execution
      this.log(`Failed to send progress update: ${(error as Error).message}`);
    }
  }

  /**
   * Override run method to integrate hooks
   */
  async run(task: Task): Promise<AgentResult> {
    this.currentTask = task;
    this.startTime = Date.now();

    const context: HookContext = {
      agentType: this.agentType,
      task,
      config: this.config,
      startTime: this.startTime,
    };

    try {
      // Execute prehooks (includes dashboard:started)
      await this.hookManager.executePreHooks(context);

      // Main execution
      const result = await this.execute(task);

      // Execute posthooks (includes dashboard:completed)
      await this.hookManager.executePostHooks(context, result);

      return result;
    } catch (error) {
      // Execute error hooks (includes dashboard:error)
      await this.hookManager.executeErrorHooks(context, error as Error);

      throw error;
    }
  }
}

/**
 * Example: Multiple Agents with Shared Dashboard Session
 */
class CoordinatedDashboardExample {
  private sessionId: string;
  private dashboardUrl: string;

  constructor(dashboardUrl: string = 'http://localhost:3001') {
    this.sessionId = `session-${Date.now()}`;
    this.dashboardUrl = dashboardUrl;
  }

  /**
   * Create agent with shared session ID
   */
  createAgent(agentType: string, config: AgentConfig): BaseAgent {
    const hookManager = new HookManager();

    // All agents share the same session ID for tracking
    const dashboardHook = new DashboardWebhookHook({
      dashboardUrl: this.dashboardUrl,
      sessionId: this.sessionId, // Shared session
      deviceIdentifier: config.deviceIdentifier,
      enableRetry: true,
    });

    hookManager.registerPreHook(dashboardHook);
    hookManager.registerPostHook(dashboardHook, { runInBackground: true });
    hookManager.registerErrorHook(dashboardHook);

    // Create custom agent class dynamically
    class CustomAgent extends BaseAgent {
      constructor() {
        super(agentType as any, config);
      }

      async execute(_task: Task): Promise<AgentResult> {
        // Agent-specific implementation
        return {
          status: 'success',
          data: { agentType },
        };
      }

      async run(task: Task): Promise<AgentResult> {
        this.currentTask = task;
        this.startTime = Date.now();

        const context: HookContext = {
          agentType: this.agentType,
          task,
          config: this.config,
          startTime: this.startTime,
        };

        try {
          await hookManager.executePreHooks(context);
          const result = await this.execute(task);
          await hookManager.executePostHooks(context, result);
          return result;
        } catch (error) {
          await hookManager.executeErrorHooks(context, error as Error);
          throw error;
        }
      }
    }

    return new CustomAgent();
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

/**
 * Example: Custom Dashboard Events
 */
class CustomEventExample extends BaseAgent {
  private dashboardHook: DashboardWebhookHook;

  constructor(config: AgentConfig) {
    super('CustomEventExample' as import('../../types/index.js').AgentType, config);

    this.dashboardHook = new DashboardWebhookHook({
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
      deviceIdentifier: config.deviceIdentifier,
    });
  }

  async execute(task: Task): Promise<AgentResult> {
    // Send custom metric event
    await this.dashboardHook.sendCustomEvent({
      eventType: 'metric:recorded',
      timestamp: new Date().toISOString(),
      agentId: this.agentType.toLowerCase().replace('agent', ''),
      issueNumber: task.metadata?.issueNumber,
      sessionId: this.dashboardHook.getSessionId(),
      deviceIdentifier: this.config.deviceIdentifier,
      metric: {
        name: 'code_complexity',
        value: 42,
        unit: 'cyclomatic',
        tags: {
          file: 'main.ts',
          function: 'processTask',
        },
      },
    });

    // Send custom task created event
    await this.dashboardHook.sendCustomEvent({
      eventType: 'task:created',
      timestamp: new Date().toISOString(),
      agentId: this.agentType.toLowerCase().replace('agent', ''),
      sessionId: this.dashboardHook.getSessionId(),
      deviceIdentifier: this.config.deviceIdentifier,
      task: {
        taskId: 'subtask-1',
        title: 'Subtask created by agent',
        type: 'feature',
        priority: 'P2',
        estimatedDuration: 30,
      },
    });

    return {
      status: 'success',
      data: { customEventsRecorded: 2 },
    };
  }
}

/**
 * Usage Examples
 */
async function basicUsage() {
  const agent = new DashboardIntegratedAgent({
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  });

  const task: Task = {
    id: 'example-1',
    title: 'Example Task with Dashboard Tracking',
    description: 'This task will be tracked in the dashboard',
    type: 'feature',
    priority: 2,
    dependencies: [],
    metadata: {
      issueNumber: 123,
    },
  };

  try {
    const result = await agent.run(task);
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function coordinatedUsage() {
  const coordinator = new CoordinatedDashboardExample('http://localhost:3001');

  console.log('Session ID:', coordinator.getSessionId());

  // Create multiple agents with shared session
  const agent1 = coordinator.createAgent('CodeGenAgent', {
    deviceIdentifier: 'device-1',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  });

  const agent2 = coordinator.createAgent('ReviewAgent', {
    deviceIdentifier: 'device-1',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  });

  // Both agents will report to dashboard with same session ID
  const task1: Task = {
    id: 'task-1',
    title: 'Task 1',
    description: 'First task',
    type: 'feature',
    priority: 2,
    dependencies: [],
  };

  const task2: Task = {
    id: 'task-2',
    title: 'Task 2',
    description: 'Second task',
    type: 'feature',
    priority: 2,
    dependencies: ['task-1'],
  };

  await agent1.run(task1);
  await agent2.run(task2);
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  basicUsage()
    .then(() => console.log('Basic usage example completed'))
    .catch((error) => console.error('Basic usage example failed:', error));
}

export {
  DashboardIntegratedAgent,
  CoordinatedDashboardExample,
  CustomEventExample,
  basicUsage,
  coordinatedUsage,
};
