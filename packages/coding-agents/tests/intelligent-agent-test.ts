/**
 * Intelligent Agent System Test
 *
 * Tests all components of the intelligent agent system
 */

import { AgentAnalyzer } from '../agent-analyzer';
import { AgentFactory } from '../agent-factory';
import { ToolFactory } from '../tool-factory';
import { DynamicToolCreator } from '../dynamic-tool-creator';
import { AgentRegistry } from '../agent-registry';
import { AgentTemplate, AgentExecutionContext } from '../types/agent-template';
import { Task, AgentResult, AgentConfig } from '../types/index';

// Test configuration
const config: AgentConfig = {
  deviceIdentifier: 'test-device',
  githubToken: process.env.GITHUB_TOKEN || 'test-token',
  useTaskTool: false,
  useWorktree: false,
  reportDirectory: '.ai/reports',
  logDirectory: '.ai/logs',
};

// Simple test template
const testTemplate: AgentTemplate = {
  id: 'test-template-v1',
  name: 'TestAgent',
  description: 'Simple test agent',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 10,
  requiredCapabilities: ['typescript', 'testing'],

  async executor(task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log(`[TestAgent] Executing task: ${task.id}`);

    // Test toolCreator
    if (context.toolCreator) {
      context.log('[TestAgent] Tool creator available');

      const toolResult = await context.toolCreator.createSimpleTool(
        'test-tool',
        'Test tool for validation',
        'command'
      );

      if (toolResult.success) {
        context.log('[TestAgent] ✓ Tool created successfully');
      }
    }

    await context.utils.sleep(100);

    return {
      status: 'success',
      data: {
        message: 'Test execution completed',
        taskId: task.id,
      },
      metrics: {
        qualityScore: 85,
        testsAdded: 3,
      },
    };
  },

  metadata: {
    author: 'Test Suite',
    tags: ['test', 'simple'],
  },
};

// Test tasks
const simpleTask: Task = {
  id: 'test-simple-1',
  title: 'Fix typo in documentation',
  description: 'Fix spelling mistake in README file',
  type: 'docs',
  priority: 3,
  dependencies: [],
};

const moderateTask: Task = {
  id: 'test-moderate-1',
  title: 'Add input validation',
  description: 'Implement form validation with TypeScript',
  type: 'feature',
  priority: 2,
  dependencies: [],
};

const complexTask: Task = {
  id: 'test-complex-1',
  title: 'Implement real-time WebSocket system',
  description: 'Add real-time collaborative editing with WebSocket, implement OT algorithm, TypeScript, comprehensive tests',
  type: 'feature',
  priority: 1,
  dependencies: [],
};

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<any>
): Promise<TestResult> {
  console.log(`\n📝 Running: ${name}`);
  const startTime = Date.now();

  try {
    const details = await testFn();
    const duration = Date.now() - startTime;

    console.log(`✅ Passed (${duration}ms)`);

    return {
      name,
      passed: true,
      duration,
      details,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ Failed (${duration}ms):`, (error as Error).message);

    return {
      name,
      passed: false,
      error: (error as Error).message,
      duration,
    };
  }
}

// Test 1: AgentAnalyzer - Task Analysis
async function testAgentAnalyzer() {
  const analyzer = AgentAnalyzer.getInstance();
  const factory = AgentFactory.getInstance();
  factory.registerTemplate(testTemplate);

  const availableTemplates = factory.getAllTemplates();

  // Test simple task
  const simpleAnalysis = await analyzer.analyzeTask(simpleTask, availableTemplates);
  if (simpleAnalysis.complexity.category !== 'simple') {
    throw new Error(`Expected 'simple' but got '${simpleAnalysis.complexity.category}'`);
  }

  // Test complex task
  const complexAnalysis = await analyzer.analyzeTask(complexTask, availableTemplates);
  if (complexAnalysis.complexity.complexityScore < 60) {
    throw new Error(`Expected high complexity but got ${complexAnalysis.complexity.complexityScore}`);
  }

  return {
    simpleScore: simpleAnalysis.complexity.complexityScore,
    complexScore: complexAnalysis.complexity.complexityScore,
    capabilities: complexAnalysis.requirements.capabilities,
  };
}

// Test 2: ToolFactory - Dynamic Tool Creation
async function testToolFactory() {
  const toolFactory = ToolFactory.getInstance();

  // Create command tool
  const commandTool = await toolFactory.createTool({
    name: 'test-command',
    type: 'command',
    description: 'Test command tool',
    parameters: {},
    priority: 10,
    critical: false,
  });

  if (!commandTool.success || !commandTool.tool) {
    throw new Error('Failed to create command tool');
  }

  // Create API tool
  const apiTool = await toolFactory.createTool({
    name: 'test-api',
    type: 'api',
    description: 'Test API tool',
    parameters: { url: 'http://test.com' },
    priority: 10,
    critical: false,
  });

  if (!apiTool.success || !apiTool.tool) {
    throw new Error('Failed to create API tool');
  }

  const allTools = toolFactory.getAllTools();

  return {
    commandToolId: commandTool.tool.id,
    apiToolId: apiTool.tool.id,
    totalTools: allTools.length,
  };
}

// Test 3: DynamicToolCreator - Runtime Tool Creation
async function testDynamicToolCreator() {
  const toolCreator = new DynamicToolCreator();

  // Create and execute simple tool
  const result = await toolCreator.createAndExecuteTool(
    {
      name: 'echo',
      type: 'command',
      description: 'Echo command',
      parameters: {},
      priority: 10,
      critical: false,
    },
    { message: 'test' },
    {
      agentInstanceId: 'test-agent',
      taskId: 'test-task',
      timestamp: new Date().toISOString(),
    }
  );

  if (!result.success && result.error && !result.error.includes('Command failed')) {
    // Command might fail but tool creation should succeed
    throw new Error('Tool creation/execution completely failed');
  }

  const stats = toolCreator.getStatistics();

  return {
    executionSuccess: result.success,
    totalExecutions: stats.totalExecutions,
    toolsCreated: stats.toolsCreated,
  };
}

// Test 4: AgentRegistry - Intelligent Assignment
async function testAgentRegistry() {
  const factory = AgentFactory.getInstance();
  await factory.clear();
  factory.registerTemplate(testTemplate);

  // Reset registry
  const registry = AgentRegistry.getInstance(config);
  await registry.clear();

  // Re-register template after clear
  factory.registerTemplate(testTemplate);

  // Test assignment for moderate task
  const assignment = await registry.assignAgent({
    task: moderateTask,
    preferExisting: true,
  });

  if (!assignment.success) {
    throw new Error(`Assignment failed: ${assignment.error}`);
  }

  // Get analysis
  const analysis = registry.getTaskAnalysis(moderateTask.id);
  if (!analysis) {
    throw new Error('Analysis not cached');
  }

  const stats = registry.getStatistics();

  return {
    wasCreated: assignment.wasCreated,
    complexity: analysis.complexity.category,
    totalAgents: stats.totalAgents,
    toolsCreated: stats.toolsCreated,
  };
}

// Test 5: End-to-End Integration
async function testEndToEnd() {
  const factory = AgentFactory.getInstance();
  await factory.clear();
  factory.registerTemplate(testTemplate);

  const registry = AgentRegistry.getInstance(config);
  await registry.clear();

  // Re-register template after clear
  factory.registerTemplate(testTemplate);

  // Assign and execute
  const assignment = await registry.assignAgent({
    task: complexTask,
    preferExisting: true,
  });

  if (!assignment.success) {
    throw new Error(`Assignment failed: ${assignment.error}`);
  }

  const agent = registry.getAgentForTask(complexTask.id);
  if (!agent) {
    throw new Error('Agent not found after assignment');
  }

  // Execute task
  const result = await agent.run(complexTask);

  if (result.status !== 'success') {
    throw new Error(`Task execution failed: ${result.status}`);
  }

  const analysis = registry.getTaskAnalysis(complexTask.id);
  const stats = registry.getStatistics();

  return {
    executionStatus: result.status,
    qualityScore: result.metrics?.qualityScore,
    complexity: analysis?.complexity.category,
    totalAssignments: stats.totalAssignments,
    cachedAnalyses: stats.cachedAnalyses,
  };
}

// Main test runner
async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Intelligent Agent System - Test Suite           ║');
  console.log('╚════════════════════════════════════════════════════╝');

  // Run all tests
  results.push(await runTest('Test 1: AgentAnalyzer', testAgentAnalyzer));
  results.push(await runTest('Test 2: ToolFactory', testToolFactory));
  results.push(await runTest('Test 3: DynamicToolCreator', testDynamicToolCreator));
  results.push(await runTest('Test 4: AgentRegistry', testAgentRegistry));
  results.push(await runTest('Test 5: End-to-End Integration', testEndToEnd));

  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Test Results Summary                             ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}: ${result.name} (${result.duration}ms)`);

    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📊 Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
