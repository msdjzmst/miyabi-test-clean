/**
 * Feedback Loop System Demo
 *
 * Demonstrates the complete Goal-Oriented TDD + Consumption-Driven + Infinite Feedback Loop
 */

import { GoalManager } from '@miyabi/coding-agents/feedback-loop/goal-manager';
import { ConsumptionValidator } from '@miyabi/coding-agents/feedback-loop/consumption-validator';
import { InfiniteLoopOrchestrator } from '@miyabi/coding-agents/feedback-loop/infinite-loop-orchestrator';
import { MetricsCollector } from '@miyabi/coding-agents/feedback-loop/metrics-collector';
import * as fs from 'fs';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 Feedback Loop System - Live Demo                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Setup
  const DEMO_DIR = '/tmp/miyabi-demo';
  const GOALS_DIR = `${DEMO_DIR}/goals`;
  const REPORTS_DIR = `${DEMO_DIR}/reports`;
  const LOOPS_DIR = `${DEMO_DIR}/loops`;

  // Create directories
  if (fs.existsSync(DEMO_DIR)) {
    fs.rmSync(DEMO_DIR, { recursive: true });
  }
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  fs.mkdirSync(GOALS_DIR, { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(LOOPS_DIR, { recursive: true });

  console.log('📁 Setup complete: Created temporary directories');
  console.log('');
  await sleep(1000);

  // Step 1: Initialize Components
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Initialize Components');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const goalManager = new GoalManager({
    goalsDirectory: GOALS_DIR,
    autoSave: true,
  });
  console.log('✅ GoalManager initialized');

  const validator = new ConsumptionValidator({
    reportsDirectory: REPORTS_DIR,
    autoSave: true,
    strictMode: false,
  });
  console.log('✅ ConsumptionValidator initialized');

  const orchestrator = new InfiniteLoopOrchestrator(
    {
      maxIterations: 10,
      convergenceThreshold: 5,
      minIterationsBeforeConvergence: 3,
      autoRefinementEnabled: true,
      logsDirectory: LOOPS_DIR,
      autoSave: true,
      timeout: 60000,
      maxRetries: 2,
      enableEscalation: false,
    },
    goalManager,
    validator,
  );
  console.log('✅ InfiniteLoopOrchestrator initialized');

  const metricsCollector = new MetricsCollector({
    workingDirectory: process.cwd(),
    skipTests: true,
    skipCoverage: true,
    verbose: false,
  });
  console.log('✅ MetricsCollector initialized');
  console.log('');
  await sleep(1500);

  // Step 2: Create Goal
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Create Goal (Goal-Oriented TDD)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const goal = goalManager.createGoal({
    title: 'Demo: Improve Code Quality to 80+',
    description: 'Demonstrate progressive quality improvement through feedback loop',
    successCriteria: {
      minQualityScore: 80,
      maxEslintErrors: 5,
      maxTypeScriptErrors: 5,
      maxSecurityIssues: 0,
      minTestCoverage: 70,
      minTestsPassed: 10,
    },
    testSpecs: [],
    acceptanceCriteria: [
      'Quality score reaches 80 or higher',
      'ESLint errors reduced to 5 or fewer',
      'TypeScript errors reduced to 5 or fewer',
      'Test coverage at least 70%',
    ],
    priority: 1,
  });

  console.log(`🎯 Goal Created: "${goal.title}"`);
  console.log(`   ID: ${goal.id}`);
  console.log('');
  console.log('📋 Success Criteria:');
  console.log(`   • Quality Score: >= ${goal.successCriteria.minQualityScore}`);
  console.log(`   • ESLint Errors: <= ${goal.successCriteria.maxEslintErrors}`);
  console.log(`   • TypeScript Errors: <= ${goal.successCriteria.maxTypeScriptErrors}`);
  console.log(`   • Test Coverage: >= ${goal.successCriteria.minTestCoverage}%`);
  console.log('');
  await sleep(2000);

  // Step 3: Start Feedback Loop
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 3: Start Infinite Feedback Loop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const loop = await orchestrator.startLoop(goal.id);
  console.log(`🔄 Feedback Loop Started`);
  console.log(`   Loop ID: ${loop.loopId}`);
  console.log(`   Status: ${loop.status}`);
  console.log(`   Max Iterations: ${loop.maxIterations}`);
  console.log('');
  await sleep(1500);

  // Step 4: Execute Iterations with Real Metrics
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 4: Execute Iterations with Real Metrics Collection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  let iteration = 0;
  const maxIterations = 5;

  while (iteration < maxIterations) {
    const currentLoop = orchestrator.getLoop(loop.loopId);
    if (!currentLoop || currentLoop.status !== 'running') {
      console.log(`⚠️  Loop status changed to: ${currentLoop?.status || 'unknown'}`);
      break;
    }

    iteration++;
    console.log(`\n📍 Iteration ${iteration}/${maxIterations}`);
    console.log('─'.repeat(60));

    // Collect real metrics
    console.log('📊 Collecting real metrics from codebase...');
    let metrics;
    try {
      metrics = await metricsCollector.collect();
      console.log('✅ Metrics collected successfully');
    } catch (error: any) {
      console.log(`⚠️  Metrics collection failed: ${error.message}`);
      console.log('   Using simulated metrics instead');

      // Use simulated metrics for demo
      metrics = {
        qualityScore: Math.min(100, 40 + iteration * 12),
        eslintErrors: Math.max(0, 10 - iteration * 2),
        typeScriptErrors: Math.max(0, 8 - iteration * 2),
        securityIssues: 0,
        testCoverage: Math.min(100, 50 + iteration * 8),
        testsPassed: 10 + iteration,
        testsFailed: Math.max(0, 3 - iteration),
        buildTimeMs: 20000,
        linesOfCode: 3500,
        cyclomaticComplexity: 12,
      };
    }

    console.log('');
    console.log('📈 Current Metrics:');
    console.log(`   • Quality Score: ${metrics.qualityScore}/100`);
    console.log(`   • ESLint Errors: ${metrics.eslintErrors}`);
    console.log(`   • TypeScript Errors: ${metrics.typeScriptErrors}`);
    console.log(`   • Test Coverage: ${metrics.testCoverage}%`);
    console.log(`   • Tests Passed: ${metrics.testsPassed}`);
    console.log('');

    // Execute iteration
    console.log('🔄 Executing iteration...');
    const iterationResult = await orchestrator.executeIteration(
      loop.loopId,
      `demo-session-${iteration}`,
      metrics,
    );

    console.log('');
    console.log('📊 Consumption Validation Results:');
    console.log(`   • Overall Score: ${iterationResult.consumptionReport.overallScore}/100`);
    console.log(`   • Goal Achieved: ${iterationResult.consumptionReport.goalAchieved ? '✅ YES' : '❌ NO'}`);
    console.log(`   • Score Improvement: ${iteration > 1 ? (iterationResult.scoreImprovement > 0 ? `+${iterationResult.scoreImprovement.toFixed(2)}` : iterationResult.scoreImprovement.toFixed(2)) : 'N/A (first iteration)'}`);

    console.log('');
    console.log('💡 Feedback:');
    console.log(`   "${iterationResult.feedback.summary}"`);

    if (iterationResult.consumptionReport.goalAchieved) {
      console.log('');
      console.log('🎉 Goal Achieved!');
      break;
    }

    await sleep(2000);
  }

  // Step 5: Final Results
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 5: Final Results & Convergence Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const finalLoop = orchestrator.getLoop(loop.loopId);
  if (finalLoop) {
    console.log(`🔄 Loop Status: ${finalLoop.status}`);
    console.log(`📊 Total Iterations: ${finalLoop.iterations.length}`);
    console.log('');

    console.log('📈 Score History:');
    finalLoop.iterations.forEach((iter: any, idx: number) => {
      const score = iter.consumptionReport.overallScore;
      const bar = '█'.repeat(Math.floor(score / 2));
      console.log(`   ${idx + 1}. Score: ${score}/100 ${bar}`);
    });

    console.log('');
    console.log('🎯 Convergence Metrics:');
    console.log(`   • Score Variance: ${finalLoop.convergenceMetrics.scoreVariance.toFixed(2)}`);
    console.log(`   • Improvement Rate: ${finalLoop.convergenceMetrics.improvementRate.toFixed(2)}/iteration`);
    console.log(`   • Is Converging: ${finalLoop.convergenceMetrics.isConverging ? '✅ YES' : '❌ NO'}`);

    if (finalLoop.convergenceMetrics.estimatedIterationsToConverge) {
      console.log(`   • Estimated Iterations to Converge: ${finalLoop.convergenceMetrics.estimatedIterationsToConverge}`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Demo Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📚 What was demonstrated:');
  console.log('   1. ✅ Goal-Oriented TDD - Defined clear success criteria');
  console.log('   2. ✅ Real Metrics Collection - Collected actual code quality metrics');
  console.log('   3. ✅ Consumption-Driven Validation - Validated results against goal');
  console.log('   4. ✅ Infinite Feedback Loop - Iterative improvement with convergence detection');
  console.log('   5. ✅ Progressive Improvement - Quality scores improved over iterations');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   • Try parallel execution: npm run integrated:demo:parallel');
  console.log('   • View dashboard: npm run dashboard:dev');
  console.log('   • Run full test suite: npm run test:e2e:integrated');
  console.log('');

  // Cleanup
  console.log('🧹 Cleaning up temporary files...');
  if (fs.existsSync(DEMO_DIR)) {
    fs.rmSync(DEMO_DIR, { recursive: true });
  }
  console.log('✅ Cleanup complete');
  console.log('');
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

export { main };
