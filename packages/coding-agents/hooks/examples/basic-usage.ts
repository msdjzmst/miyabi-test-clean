/**
 * Basic Hook Usage Example
 *
 * Demonstrates simple prehook/posthook setup
 */

import { BaseAgent } from '../../base-agent';
import { Task, AgentResult, AgentConfig } from '../../types/index';
import {
  HookManager,
  EnvironmentCheckHook,
  CleanupHook,
} from '../index';

class BasicAgent extends BaseAgent {
  private hookManager: HookManager;

  constructor(config: AgentConfig) {
    super('BasicAgent' as import('../../types/index.js').AgentType, config);

    // Initialize hook manager
    this.hookManager = new HookManager();

    // Register prehook: Validate environment
    this.hookManager.registerPreHook(
      new EnvironmentCheckHook(['GITHUB_TOKEN', 'DEVICE_IDENTIFIER'])
    );

    // Register posthook: Cleanup
    this.hookManager.registerPostHook(
      new CleanupHook({
        tempDirs: ['.temp', '.cache'],
      })
    );
  }

  async execute(task: Task): Promise<AgentResult> {
    this.log('BasicAgent executing...');

    // Your agent logic here
    await this.doWork(task);

    return {
      status: 'success',
      data: {
        message: 'Task completed successfully',
      },
    };
  }

  /**
   * Override run method to integrate hooks
   */
  async run(task: Task): Promise<AgentResult> {
    this.currentTask = task;
    this.startTime = Date.now();

    const context = {
      agentType: this.agentType,
      task,
      config: this.config,
      startTime: this.startTime,
    };

    try {
      // Execute prehooks
      await this.hookManager.executePreHooks(context);

      // Main execution
      const result = await this.execute(task);

      // Execute posthooks
      await this.hookManager.executePostHooks(context, result);

      return result;
    } catch (error) {
      // Execute error hooks
      await this.hookManager.executeErrorHooks(context, error as Error);

      throw error;
    }
  }

  private async doWork(_task: Task): Promise<void> {
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Usage
async function main() {
  const agent = new BasicAgent({
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  });

  const task: Task = {
    id: 'example-1',
    title: 'Example Task',
    description: 'This is an example task',
    type: 'feature',
    priority: 2,
    dependencies: [],
  };

  try {
    const result = await agent.run(task);
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
