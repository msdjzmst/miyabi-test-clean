/**
 * Dynamic Agent Usage Examples
 *
 * Demonstrates how to use AgentTemplate, DynamicAgent, AgentFactory, and AgentRegistry
 */

import { AgentFactory } from '../agent-factory';
import { AgentRegistry } from '../agent-registry';
import { AgentTemplate, AgentExecutionContext } from '../types/agent-template';
import { Task, AgentResult, AgentConfig } from '../types/index';
import { HookManager, DashboardWebhookHook } from '../hooks/index';

// ============================================================================
// Example 1: Simple Agent Template
// ============================================================================

/**
 * Simple CodeGen Template
 */
const simpleCodeGenTemplate: AgentTemplate = {
  id: 'simple-codegen-v1',
  name: 'SimpleCodeGenAgent',
  description: 'Simple code generation agent',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 10,

  async executor(_task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Starting code generation...');

    // Step 1: Analyze
    context.log('Analyzing requirements...');
    await context.utils.sleep(1000);

    // Step 2: Generate code
    context.log('Generating code...');
    await context.utils.sleep(2000);

    // Step 3: Test
    context.log('Running tests...');
    await context.utils.sleep(1000);

    return {
      status: 'success',
      data: {
        filesCreated: ['src/feature.ts', 'tests/feature.spec.ts'],
        linesAdded: 150,
      },
      metrics: {
        qualityScore: 85,
        testsAdded: 5,
        coveragePercent: 80,
      },
    };
  },

  metadata: {
    author: 'Miyabi Team',
    createdAt: '2025-10-12',
    tags: ['codegen', 'typescript', 'simple'],
  },
};

/**
 * Advanced CodeGen Template with Claude API
 */
const advancedCodeGenTemplate: AgentTemplate = {
  id: 'advanced-codegen-v1',
  name: 'AdvancedCodeGenAgent',
  description: 'Advanced code generation with Claude Sonnet 4',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 20, // Higher priority than simple

  requiredCapabilities: ['anthropic-api', 'typescript', 'git'],

  async initialize(_config: AgentConfig): Promise<void> {
    // Initialize Claude API client
    console.log('Initializing Claude API...');
  },

  async executor(_task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Advanced code generation starting...');

    // Simulate Claude API call
    context.log('Calling Claude Sonnet 4 API...');
    await context.utils.sleep(3000);

    context.log('Parsing AI response...');
    await context.utils.sleep(1000);

    context.log('Writing generated code...');
    await context.utils.sleep(1000);

    return {
      status: 'success',
      data: {
        filesCreated: ['src/advanced-feature.ts', 'tests/advanced-feature.spec.ts'],
        linesAdded: 300,
        aiGenerated: true,
      },
      metrics: {
        qualityScore: 95,
        testsAdded: 10,
        coveragePercent: 90,
      },
    };
  },

  async cleanup(_config: AgentConfig): Promise<void> {
    // Cleanup Claude API resources
    console.log('Cleaning up Claude API resources...');
  },

  metadata: {
    author: 'Miyabi Team',
    createdAt: '2025-10-12',
    tags: ['codegen', 'ai', 'claude', 'advanced'],
  },
};

/**
 * Review Agent Template
 */
const reviewAgentTemplate: AgentTemplate = {
  id: 'review-agent-v1',
  name: 'ReviewAgent',
  description: 'Code quality review agent',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 15,

  async executor(_task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Starting code review...');

    // Step 1: ESLint
    context.log('Running ESLint...');
    await context.utils.sleep(1000);

    // Step 2: TypeScript type check
    context.log('Running TypeScript type check...');
    await context.utils.sleep(1500);

    // Step 3: Security scan
    context.log('Running security scan...');
    await context.utils.sleep(1000);

    // Step 4: Calculate quality score
    const qualityScore = 87;

    return {
      status: 'success',
      data: {
        eslintErrors: 0,
        typeErrors: 0,
        securityIssues: 0,
        qualityScore,
      },
      metrics: {
        qualityScore,
        errorsFound: 0,
      },
    };
  },

  metadata: {
    author: 'Miyabi Team',
    tags: ['review', 'quality', 'security'],
  },
};

// ============================================================================
// Example 2: Using AgentFactory
// ============================================================================

async function factoryExample() {
  console.log('\n=== Agent Factory Example ===\n');

  const factory = AgentFactory.getInstance();

  // Register templates
  factory.registerTemplate(simpleCodeGenTemplate);
  factory.registerTemplate(advancedCodeGenTemplate);
  factory.registerTemplate(reviewAgentTemplate);

  console.log('Registered templates:', factory.getAllTemplates().length);

  // Create agent for specific task type
  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  const agent = await factory.createAgentForTask('feature', config, {
    autoInitialize: true,
  });

  console.log('Created agent:', agent.getInstanceId());
  console.log('Template:', agent.getTemplate().name);

  // Execute task
  const task: Task = {
    id: 'task-1',
    title: 'Implement new feature',
    description: 'Add user authentication',
    type: 'feature',
    priority: 1,
    dependencies: [],
  };

  const result = await agent.run(task);
  console.log('Result:', result);

  // Factory statistics
  console.log('Factory stats:', factory.getStatistics());
}

// ============================================================================
// Example 3: Using AgentRegistry (Automatic Assignment)
// ============================================================================

async function registryExample() {
  console.log('\n=== Agent Registry Example ===\n');

  const factory = AgentFactory.getInstance();
  factory.registerTemplate(simpleCodeGenTemplate);
  factory.registerTemplate(advancedCodeGenTemplate);

  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  const registry = AgentRegistry.getInstance(config);

  // Task 1: First feature - will create new agent
  const task1: Task = {
    id: 'task-1',
    title: 'Feature 1',
    description: 'First feature',
    type: 'feature',
    priority: 1,
    dependencies: [],
  };

  const assignment1 = await registry.assignAgent({
    task: task1,
    preferExisting: true,
  });

  console.log('Assignment 1:', {
    success: assignment1.success,
    wasCreated: assignment1.wasCreated,
    reason: assignment1.reason,
  });

  // Task 2: Second feature - will reuse existing agent if idle
  const task2: Task = {
    id: 'task-2',
    title: 'Feature 2',
    description: 'Second feature',
    type: 'feature',
    priority: 2,
    dependencies: [],
  };

  const assignment2 = await registry.assignAgent({
    task: task2,
    preferExisting: true,
  });

  console.log('Assignment 2:', {
    success: assignment2.success,
    wasCreated: assignment2.wasCreated,
    reason: assignment2.reason,
  });

  // Execute tasks
  if (assignment1.agentInstance) {
    const agent1 = registry.getAgentForTask('task-1');
    if (agent1) {
      await agent1.run(task1);
    }
  }

  if (assignment2.agentInstance) {
    const agent2 = registry.getAgentForTask('task-2');
    if (agent2) {
      await agent2.run(task2);
    }
  }

  // Registry statistics
  console.log('Registry stats:', registry.getStatistics());

  // Cleanup
  await registry.cleanupCompletedAssignments();
  await registry.destroyIdleAgents();
}

// ============================================================================
// Example 4: Agent with Dashboard Integration
// ============================================================================

async function dashboardIntegrationExample() {
  console.log('\n=== Dashboard Integration Example ===\n');

  const factory = AgentFactory.getInstance();
  factory.registerTemplate(simpleCodeGenTemplate);

  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  // Create hook manager with dashboard webhook
  const hookManager = new HookManager();
  const dashboardHook = new DashboardWebhookHook({
    dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
    enableRetry: true,
    sessionId: `session-${Date.now()}`,
    deviceIdentifier: config.deviceIdentifier,
  });

  hookManager.registerPreHook(dashboardHook);
  hookManager.registerPostHook(dashboardHook, { runInBackground: true });
  hookManager.registerErrorHook(dashboardHook);

  // Create agent with hooks
  const agent = await factory.createAgent(simpleCodeGenTemplate.id, config, {
    hookManager,
    autoInitialize: true,
  });

  // Execute task (will send events to dashboard)
  const task: Task = {
    id: 'task-dashboard',
    title: 'Task with Dashboard Tracking',
    description: 'This task reports to dashboard',
    type: 'feature',
    priority: 1,
    dependencies: [],
    metadata: {
      issueNumber: 123,
    },
  };

  await agent.run(task);

  console.log('Task completed with dashboard tracking');
}

// ============================================================================
// Example 5: Multiple Agents in Parallel
// ============================================================================

async function parallelAgentsExample() {
  console.log('\n=== Parallel Agents Example ===\n');

  const factory = AgentFactory.getInstance();
  factory.registerTemplate(simpleCodeGenTemplate);
  factory.registerTemplate(reviewAgentTemplate);

  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  const registry = AgentRegistry.getInstance(config);

  // Create multiple tasks
  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Feature A',
      description: 'Implement feature A',
      type: 'feature',
      priority: 1,
      dependencies: [],
    },
    {
      id: 'task-2',
      title: 'Feature B',
      description: 'Implement feature B',
      type: 'feature',
      priority: 1,
      dependencies: [],
    },
    {
      id: 'task-3',
      title: 'Review Feature A',
      description: 'Review feature A code',
      type: 'feature',
      priority: 2,
      dependencies: ['task-1'],
    },
  ];

  // Assign agents to all tasks
  const assignments = await Promise.all(
    tasks.map((task) =>
      registry.assignAgent({
        task,
        preferExisting: true,
        maxConcurrentTasks: 1,
      })
    )
  );

  console.log('Assignments:', assignments.map((a) => ({ success: a.success, wasCreated: a.wasCreated })));

  // Execute tasks in parallel (respecting dependencies)
  const task1Agent = registry.getAgentForTask('task-1');
  const task2Agent = registry.getAgentForTask('task-2');

  if (task1Agent && task2Agent) {
    // Execute independent tasks in parallel
    await Promise.all([task1Agent.run(tasks[0]), task2Agent.run(tasks[1])]);

    // Execute dependent task after
    const task3Agent = registry.getAgentForTask('task-3');
    if (task3Agent) {
      await task3Agent.run(tasks[2]);
    }
  }

  console.log('All tasks completed');
  console.log('Final stats:', registry.getStatistics());
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    await factoryExample();
    await registryExample();
    await dashboardIntegrationExample();
    await parallelAgentsExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  simpleCodeGenTemplate,
  advancedCodeGenTemplate,
  reviewAgentTemplate,
  factoryExample,
  registryExample,
  dashboardIntegrationExample,
  parallelAgentsExample,
};
