/**
 * Intelligent Agent System Usage Examples
 *
 * Demonstrates the complete intelligent agent system with:
 * - AgentAnalyzer for task analysis
 * - Dynamic tool creation
 * - Intelligent agent assignment
 * - Runtime tool creation by agents
 */

import { AgentFactory } from '../agent-factory';
import { AgentRegistry } from '../agent-registry';
import { AgentAnalyzer } from '../agent-analyzer';
import { ToolFactory } from '../tool-factory';
import { AgentTemplate, AgentExecutionContext } from '../types/agent-template';
import { Task, AgentResult, AgentConfig } from '../types/index';
import { ToolRequirement } from '../types/agent-analysis';

// ============================================================================
// Example 1: Intelligent Task Analysis
// ============================================================================

async function taskAnalysisExample() {
  console.log('\n=== Task Analysis Example ===\n');

  const analyzer = AgentAnalyzer.getInstance();
  const factory = AgentFactory.getInstance();

  // Register some templates
  factory.registerTemplate(codegenTemplate);
  factory.registerTemplate(reviewTemplate);

  // Create a complex task
  const task: Task = {
    id: 'task-complex-1',
    title: 'Implement real-time collaborative editing with WebSocket',
    description:
      'Add real-time collaborative editing using WebSocket, implement OT algorithm, add user presence, handle conflicts',
    type: 'feature',
    priority: 1,
    dependencies: [],
  };

  // Analyze task
  const analysis = await analyzer.analyzeTask(task, factory.getAllTemplates());

  console.log('Task Analysis Result:');
  console.log('  Complexity:', analysis.complexity.category);
  console.log('  Score:', analysis.complexity.complexityScore);
  console.log('  Capabilities:', analysis.requirements.capabilities);
  console.log('  Recommended Tools:', analysis.complexity.recommendedTools);
  console.log('  Strategy:', analysis.assignmentStrategy.type);
  console.log('  Confidence:', analysis.assignmentStrategy.confidence + '%');
}

// ============================================================================
// Example 2: Dynamic Tool Creation
// ============================================================================

async function dynamicToolCreationExample() {
  console.log('\n=== Dynamic Tool Creation Example ===\n');

  const toolFactory = ToolFactory.getInstance();

  // Create a command tool
  const commandToolReq: ToolRequirement = {
    name: 'eslint',
    type: 'command',
    description: 'Run ESLint code analysis',
    parameters: { fix: true },
    priority: 80,
    critical: true,
  };

  const commandResult = await toolFactory.createTool(commandToolReq);
  console.log('Command tool created:', commandResult.success);
  console.log('  Tool ID:', commandResult.tool?.id);
  console.log('  Duration:', commandResult.durationMs + 'ms');

  // Create an API tool
  const apiToolReq: ToolRequirement = {
    name: 'github-api',
    type: 'api',
    description: 'GitHub API client',
    parameters: {
      url: 'https://api.github.com',
      method: 'GET',
    },
    priority: 70,
    critical: false,
  };

  const apiResult = await toolFactory.createTool(apiToolReq);
  console.log('\nAPI tool created:', apiResult.success);
  console.log('  Tool ID:', apiResult.tool?.id);

  // Export tool
  if (commandResult.tool) {
    await toolFactory.exportTool(
      commandResult.tool.id,
      './.ai/generated-tools/eslint-tool.ts'
    );
    console.log('\n✓ Tool exported to .ai/generated-tools/');
  }
}

// ============================================================================
// Example 3: Agent with Runtime Tool Creation
// ============================================================================

const intelligentCodegenTemplate: AgentTemplate = {
  id: 'intelligent-codegen-v1',
  name: 'IntelligentCodeGenAgent',
  description: 'Code generation agent that creates tools as needed',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 30,

  async executor(task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('🧠 Intelligent CodeGen Agent starting...');

    // Step 1: Analyze what tools we need
    context.log('Step 1: Analyzing required tools...');

    const toolsNeeded: string[] = [];

    if (task.description.includes('typescript')) {
      toolsNeeded.push('tsc', 'eslint');
    }
    if (task.description.includes('test')) {
      toolsNeeded.push('vitest');
    }
    if (task.description.includes('api')) {
      toolsNeeded.push('api-client');
    }

    context.log(`  Tools needed: ${toolsNeeded.join(', ')}`);

    // Step 2: Create tools dynamically using toolCreator
    if (context.toolCreator) {
      context.log('Step 2: Creating dynamic tools...');

      for (const toolName of toolsNeeded) {
        const result = await context.toolCreator.createSimpleTool(
          toolName,
          `Dynamic ${toolName} tool`,
          'command'
        );

        if (result.success) {
          context.log(`  ✓ Created tool: ${toolName}`);
        }
      }

      // Create a custom tool from natural language
      const customToolResult = await context.toolCreator.createToolFromDescription(
        'validate code quality and security',
        {
          agentInstanceId: 'intelligent-codegen-instance',
          taskId: task.id,
          timestamp: new Date().toISOString(),
        }
      );

      if (customToolResult.success) {
        context.log('  ✓ Created custom validation tool');
      }
    }

    // Step 3: Execute actual work
    context.log('Step 3: Generating code...');
    await context.utils.sleep(2000);

    // Step 4: Use created tools
    if (context.toolCreator) {
      context.log('Step 4: Running created tools...');

      const stats = context.toolCreator.getStatistics();
      context.log(`  Tools created: ${stats.toolsCreated}`);
      context.log(`  Tools executed: ${stats.totalExecutions}`);
    }

    return {
      status: 'success',
      data: {
        filesCreated: ['src/feature.ts'],
        toolsCreated: toolsNeeded.length,
        dynamicToolsUsed: true,
      },
      metrics: {
        qualityScore: 92,
        testsAdded: 5,
      },
    };
  },

  metadata: {
    author: 'Miyabi Team',
    tags: ['intelligent', 'dynamic', 'codegen'],
  },
};

// ============================================================================
// Example 4: Intelligent Agent Assignment
// ============================================================================

async function intelligentAssignmentExample() {
  console.log('\n=== Intelligent Agent Assignment Example ===\n');

  const factory = AgentFactory.getInstance();
  factory.registerTemplate(codegenTemplate);
  factory.registerTemplate(intelligentCodegenTemplate);

  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  const registry = AgentRegistry.getInstance(config);

  // Task requiring dynamic tools
  const complexTask: Task = {
    id: 'task-dynamic-1',
    title: 'Implement OAuth2 authentication with TypeScript',
    description:
      'Add OAuth2 authentication flow using TypeScript, integrate with Firebase Auth, add security tests',
    type: 'feature',
    priority: 1,
    dependencies: [],
  };

  console.log('Assigning agent with intelligent analysis...\n');

  // Intelligent assignment (analyzes task, creates tools, assigns agent)
  const assignment = await registry.assignAgent({
    task: complexTask,
    preferExisting: true,
  });

  console.log('\nAssignment Result:');
  console.log('  Success:', assignment.success);
  console.log('  Was Created:', assignment.wasCreated);
  console.log('  Reason:', assignment.reason);

  // Get task analysis
  const analysis = registry.getTaskAnalysis(complexTask.id);
  if (analysis) {
    console.log('\nTask Analysis:');
    console.log('  Complexity:', analysis.complexity.category);
    console.log('  Tools to create:', analysis.requirements.tools.map((t) => t.name));
    console.log('  Hooks to create:', analysis.requirements.hooks.map((h) => h.name));
  }

  // Execute task
  if (assignment.agentInstance) {
    const agent = registry.getAgentForTask(complexTask.id);
    if (agent) {
      console.log('\nExecuting task with intelligent agent...\n');
      const result = await agent.run(complexTask);
      console.log('Result:', result.status);
      console.log('Quality Score:', result.metrics?.qualityScore);
    }
  }

  // Statistics
  const stats = registry.getStatistics();
  console.log('\nRegistry Statistics:');
  console.log('  Total Agents:', stats.totalAgents);
  console.log('  Tools Created:', stats.toolsCreated);
  console.log('  Cached Analyses:', stats.cachedAnalyses);
}

// ============================================================================
// Example 5: Multiple Tasks with Intelligent Assignment
// ============================================================================

async function parallelIntelligentAssignmentExample() {
  console.log('\n=== Parallel Intelligent Assignment Example ===\n');

  const factory = AgentFactory.getInstance();
  factory.registerTemplate(codegenTemplate);
  factory.registerTemplate(reviewTemplate);
  factory.registerTemplate(intelligentCodegenTemplate);

  const config: AgentConfig = {
    deviceIdentifier: 'example-device',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: false,
    reportDirectory: '.ai/reports',
    logDirectory: '.ai/logs',
  };

  const registry = AgentRegistry.getInstance(config);

  // Multiple tasks with varying complexity
  const tasks: Task[] = [
    {
      id: 'task-simple',
      title: 'Fix typo in documentation',
      description: 'Fix spelling mistake in README',
      type: 'docs',
      priority: 3,
      dependencies: [],
    },
    {
      id: 'task-moderate',
      title: 'Add input validation',
      description: 'Add validation for user input forms',
      type: 'feature',
      priority: 2,
      dependencies: [],
    },
    {
      id: 'task-complex',
      title: 'Implement distributed caching with Redis',
      description:
        'Add distributed caching layer using Redis, implement cache invalidation strategy, add monitoring',
      type: 'feature',
      priority: 1,
      dependencies: [],
    },
  ];

  // Assign agents intelligently for all tasks
  console.log('Analyzing and assigning agents for all tasks...\n');

  for (const task of tasks) {
    const assignment = await registry.assignAgent({
      task,
      preferExisting: true,
    });

    const analysis = registry.getTaskAnalysis(task.id);

    console.log(`Task: ${task.title}`);
    console.log(`  Complexity: ${analysis?.complexity.category}`);
    console.log(`  Score: ${analysis?.complexity.complexityScore}/100`);
    console.log(`  Strategy: ${analysis?.assignmentStrategy.type}`);
    console.log(`  Agent Created: ${assignment.wasCreated}`);
    console.log(`  Tools Created: ${analysis?.requirements.tools.length || 0}`);
    console.log();
  }

  // Execute all tasks
  console.log('Executing all tasks...\n');

  const results = await Promise.all(
    tasks.map(async (task) => {
      const agent = registry.getAgentForTask(task.id);
      return agent ? agent.run(task) : null;
    })
  );

  console.log('All tasks completed!');
  console.log('Results:', results.filter((r) => r).length + '/' + tasks.length);

  // Final statistics
  const stats = registry.getStatistics();
  console.log('\nFinal Statistics:');
  console.log('  Total Assignments:', stats.totalAssignments);
  console.log('  Total Agents:', stats.totalAgents);
  console.log('  Tools Created:', stats.toolsCreated);
  console.log('  Analyses Cached:', stats.cachedAnalyses);
}

// ============================================================================
// Helper Templates
// ============================================================================

const codegenTemplate: AgentTemplate = {
  id: 'basic-codegen-v1',
  name: 'BasicCodeGenAgent',
  description: 'Basic code generation',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 10,

  async executor(_task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Basic codegen executing...');
    await context.utils.sleep(1000);
    return {
      status: 'success',
      data: { filesCreated: ['src/file.ts'] },
      metrics: { qualityScore: 75 },
    };
  },
};

const reviewTemplate: AgentTemplate = {
  id: 'basic-review-v1',
  name: 'BasicReviewAgent',
  description: 'Basic code review',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 15,

  async executor(_task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Review executing...');
    await context.utils.sleep(1500);
    return {
      status: 'success',
      data: { qualityScore: 85 },
      metrics: { qualityScore: 85 },
    };
  },
};

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    await taskAnalysisExample();
    await dynamicToolCreationExample();
    await intelligentAssignmentExample();
    await parallelIntelligentAssignmentExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  intelligentCodegenTemplate,
  taskAnalysisExample,
  dynamicToolCreationExample,
  intelligentAssignmentExample,
  parallelIntelligentAssignmentExample,
};
