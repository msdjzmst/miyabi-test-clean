/**
 * Feedback Loop Demo - Goal-Oriented TDD + Consumption-Driven + Infinite Feedback Loop
 *
 * Complete demonstration of the feedback loop system
 */

import { GoalManager } from './goal-manager';
import { ConsumptionValidator } from './consumption-validator';
import { InfiniteLoopOrchestrator } from './infinite-loop-orchestrator';
import type {
  ActualMetrics,
} from '../types/index';

/**
 * Demo: Goal-Oriented TDD + Consumption-Driven + Infinite Feedback Loop
 *
 * このデモは以下を示します：
 * 1. ゴール定義 (Goal-Oriented TDD)
 * 2. 実行結果の消費・検証 (Consumption-Driven)
 * 3. フィードバックループ (Infinite Feedback Loop)
 * 4. 自動ゴール洗練化
 * 5. 収束判定
 */
async function demo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Goal-Oriented TDD + Consumption-Driven Feedback Loop Demo   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ============================================================================
  // Step 1: Initialize Components
  // ============================================================================

  console.log('📋 Step 1: Initializing components...');

  const goalManager = new GoalManager({
    goalsDirectory: './data/goals',
    autoSave: true,
  });

  const consumptionValidator = new ConsumptionValidator({
    reportsDirectory: './data/consumption-reports',
    autoSave: true,
    strictMode: false,
  });

  const loopOrchestrator = new InfiniteLoopOrchestrator(
    {
      maxIterations: 10,
      convergenceThreshold: 5, // Variance < 5 = converged
      minIterationsBeforeConvergence: 3,
      autoRefinementEnabled: true,
      logsDirectory: './data/feedback-loops',
      autoSave: true,
    },
    goalManager,
    consumptionValidator
  );

  console.log('✅ Components initialized');
  console.log('');

  // ============================================================================
  // Step 2: Define Goal
  // ============================================================================

  console.log('🎯 Step 2: Defining goal...');

  const goal = goalManager.createGoal({
    title: 'Implement User Authentication Feature',
    description: 'Create a secure user authentication system with JWT tokens',
    successCriteria: {
      minQualityScore: 85,
      maxEslintErrors: 0,
      maxTypeScriptErrors: 0,
      maxSecurityIssues: 0,
      minTestCoverage: 80,
      minTestsPassed: 10,
      maxBuildTimeMs: 30000,
    },
    testSpecs: [
      {
        id: 'test-1',
        name: 'User Registration',
        description: 'Should register a new user with valid credentials',
        type: 'integration',
        testFile: 'tests/auth/register.test.ts',
        testFunction: 'describe("User Registration")',
        expectedBehavior: 'Returns 201 status with user data',
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'test-2',
        name: 'User Login',
        description: 'Should authenticate user and return JWT token',
        type: 'integration',
        testFile: 'tests/auth/login.test.ts',
        testFunction: 'describe("User Login")',
        expectedBehavior: 'Returns 200 status with JWT token',
        dependencies: ['test-1'],
        status: 'pending',
      },
      {
        id: 'test-3',
        name: 'Token Validation',
        description: 'Should validate JWT token and return user data',
        type: 'unit',
        testFile: 'tests/auth/token.test.ts',
        testFunction: 'describe("Token Validation")',
        expectedBehavior: 'Returns user data for valid token',
        dependencies: ['test-2'],
        status: 'pending',
      },
    ],
    acceptanceCriteria: [
      'User can register with email and password',
      'User can login and receive JWT token',
      'Protected routes require valid JWT token',
      'Passwords are hashed using bcrypt',
      'No security vulnerabilities',
    ],
    priority: 1,
    issueNumber: 123,
    taskId: 'task-auth-001',
  });

  console.log(`✅ Goal created: ${goal.id}`);
  console.log(`   Title: ${goal.title}`);
  console.log(`   Success Criteria: Quality >= ${goal.successCriteria.minQualityScore}, Coverage >= ${goal.successCriteria.minTestCoverage}%`);
  console.log('');

  // ============================================================================
  // Step 3: Start Infinite Feedback Loop
  // ============================================================================

  console.log('🔄 Step 3: Starting infinite feedback loop...');

  const loop = await loopOrchestrator.startLoop(goal.id);

  console.log(`✅ Loop started: ${loop.loopId}`);
  console.log(`   Max Iterations: ${loop.maxIterations}`);
  console.log(`   Auto Refinement: ${loop.autoRefinementEnabled ? 'Enabled' : 'Disabled'}`);
  console.log('');

  // ============================================================================
  // Step 4: Simulate Iterations
  // ============================================================================

  console.log('📊 Step 4: Simulating iterations...');
  console.log('');

  // Simulate progressive improvement over iterations
  const simulatedMetrics: ActualMetrics[] = [
    // Iteration 1: Poor initial state
    {
      qualityScore: 45,
      eslintErrors: 15,
      typeScriptErrors: 8,
      securityIssues: 3,
      testCoverage: 30,
      testsPassed: 3,
      testsFailed: 7,
      buildTimeMs: 25000,
      linesOfCode: 500,
      cyclomaticComplexity: 12,
    },
    // Iteration 2: Some improvement
    {
      qualityScore: 58,
      eslintErrors: 8,
      typeScriptErrors: 5,
      securityIssues: 2,
      testCoverage: 45,
      testsPassed: 5,
      testsFailed: 5,
      buildTimeMs: 23000,
      linesOfCode: 520,
      cyclomaticComplexity: 10,
    },
    // Iteration 3: Significant progress
    {
      qualityScore: 72,
      eslintErrors: 3,
      typeScriptErrors: 2,
      securityIssues: 1,
      testCoverage: 65,
      testsPassed: 8,
      testsFailed: 2,
      buildTimeMs: 20000,
      linesOfCode: 550,
      cyclomaticComplexity: 8,
    },
    // Iteration 4: Near goal
    {
      qualityScore: 83,
      eslintErrors: 1,
      typeScriptErrors: 1,
      securityIssues: 0,
      testCoverage: 78,
      testsPassed: 10,
      testsFailed: 0,
      buildTimeMs: 18000,
      linesOfCode: 580,
      cyclomaticComplexity: 7,
    },
    // Iteration 5: Goal achieved
    {
      qualityScore: 88,
      eslintErrors: 0,
      typeScriptErrors: 0,
      securityIssues: 0,
      testCoverage: 85,
      testsPassed: 12,
      testsFailed: 0,
      buildTimeMs: 17000,
      linesOfCode: 600,
      cyclomaticComplexity: 6,
    },
  ];

  for (let i = 0; i < simulatedMetrics.length; i++) {
    const metrics = simulatedMetrics[i];
    const sessionId = `session-${i + 1}`;

    console.log(`🔄 Iteration ${i + 1}/${simulatedMetrics.length}`);
    console.log(`   Session: ${sessionId}`);

    const iteration = await loopOrchestrator.executeIteration(
      loop.loopId,
      sessionId,
      metrics
    );

    console.log(`   📊 Score: ${iteration.consumptionReport.overallScore}/100`);
    console.log(`   📈 Improvement: ${iteration.scoreImprovement > 0 ? '+' : ''}${iteration.scoreImprovement.toFixed(1)}`);
    console.log(`   ✅ Goal Achieved: ${iteration.consumptionReport.goalAchieved ? 'Yes' : 'No'}`);
    console.log(`   ${iteration.feedback.summary}`);

    if (iteration.consumptionReport.gaps.length > 0) {
      console.log(`   ⚠️  Gaps:`);
      for (const gap of iteration.consumptionReport.gaps.slice(0, 3)) {
        console.log(`      - ${gap.metric}: ${gap.gap.toFixed(1)} (${gap.severity})`);
      }
    }

    if (iteration.consumptionReport.nextActions.length > 0) {
      console.log(`   🎯 Next Actions:`);
      for (const action of iteration.consumptionReport.nextActions.slice(0, 2)) {
        console.log(`      - ${action.description}`);
      }
    }

    console.log('');

    // Check if should continue
    if (!loopOrchestrator.shouldContinue(loop.loopId)) {
      const currentLoop = loopOrchestrator.getLoop(loop.loopId);
      console.log(`🏁 Loop stopped: ${currentLoop?.status}`);
      break;
    }

    // Small delay for readability
    await sleep(100);
  }

  // ============================================================================
  // Step 5: Final Report
  // ============================================================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📈 Final Report');
  console.log('');

  const finalLoop = loopOrchestrator.getLoop(loop.loopId);
  if (finalLoop) {
    console.log(`Loop ID: ${finalLoop.loopId}`);
    console.log(`Status: ${finalLoop.status}`);
    console.log(`Total Iterations: ${finalLoop.iteration}`);
    console.log(`Start Time: ${finalLoop.startTime}`);
    console.log(`End Time: ${finalLoop.lastIterationTime}`);
    console.log('');

    console.log('Convergence Metrics:');
    console.log(`  Score History: [${finalLoop.convergenceMetrics.scoreHistory.join(', ')}]`);
    console.log(`  Score Variance: ${finalLoop.convergenceMetrics.scoreVariance.toFixed(2)}`);
    console.log(`  Improvement Rate: ${finalLoop.convergenceMetrics.improvementRate.toFixed(2)} pts/iteration`);
    console.log(`  Is Converging: ${finalLoop.convergenceMetrics.isConverging}`);
    console.log('');

    if (finalLoop.refinementHistory.length > 0) {
      console.log('Goal Refinements:');
      for (const refinement of finalLoop.refinementHistory) {
        console.log(`  - ${refinement.timestamp}: ${refinement.reason}`);
        for (const change of refinement.changes) {
          console.log(`    ${change.field}: ${change.before} → ${change.after}`);
        }
      }
      console.log('');
    }

    const lastIteration = finalLoop.iterations[finalLoop.iterations.length - 1];
    console.log('Final State:');
    console.log(`  Overall Score: ${lastIteration.consumptionReport.overallScore}/100`);
    console.log(`  Goal Achieved: ${lastIteration.consumptionReport.goalAchieved}`);
    console.log(`  Gaps Remaining: ${lastIteration.consumptionReport.gaps.length}`);
    console.log('');
  }

  console.log('✅ Demo completed successfully!');
  console.log('');
  console.log('🎉 Goal-Oriented TDD + Consumption-Driven + Infinite Feedback Loop system is operational!');
  console.log('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch((error) => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

export { demo };
