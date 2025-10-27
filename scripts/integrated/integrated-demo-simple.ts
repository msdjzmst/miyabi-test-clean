/**
 * Integrated System Demo (Simple Version)
 *
 * Demonstrates Water Spider + Feedback Loop integration without external dependencies
 */

import { GoalManager } from '@miyabi/coding-agents/feedback-loop/goal-manager';
import { ConsumptionValidator } from '@miyabi/coding-agents/feedback-loop/consumption-validator';
import { InfiniteLoopOrchestrator } from '@miyabi/coding-agents/feedback-loop/infinite-loop-orchestrator';
import type { ActualMetrics } from '@miyabi/coding-agents/types/index';

async function demo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔗 Integrated System Demo: Water Spider + Feedback Loop    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize components
  console.log('📋 Initializing integrated system...');

  const goalManager = new GoalManager({
    goalsDirectory: './data/goals',
    autoSave: true,
  });

  const validator = new ConsumptionValidator({
    reportsDirectory: './data/consumption-reports',
    autoSave: true,
    strictMode: false,
  });

  const orchestrator = new InfiniteLoopOrchestrator(
    {
      maxIterations: 10,
      convergenceThreshold: 5,
      minIterationsBeforeConvergence: 3,
      autoRefinementEnabled: true,
      logsDirectory: './data/feedback-loops',
      autoSave: true,
    },
    goalManager,
    validator,
  );

  console.log('✅ Components initialized');
  console.log('');

  // Create goal
  console.log('🎯 Creating goal...');

  const goal = goalManager.createGoal({
    title: 'Integrated Demo: Authentication Feature',
    description: 'Implement secure authentication with continuous improvement',
    successCriteria: {
      minQualityScore: 85,
      maxEslintErrors: 0,
      maxTypeScriptErrors: 0,
      maxSecurityIssues: 0,
      minTestCoverage: 80,
      minTestsPassed: 10,
    },
    testSpecs: [],
    acceptanceCriteria: [
      'User registration works',
      'User login works',
      'JWT tokens issued',
      'Security validated',
    ],
    priority: 1,
  });

  console.log(`✅ Goal created: ${goal.id}`);
  console.log('');

  // Start feedback loop
  console.log('🔄 Starting feedback loop...');
  const loop = await orchestrator.startLoop(goal.id);
  console.log(`✅ Loop started: ${loop.loopId}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 Executing iterations with integrated system...');
  console.log('   (Water Spider would auto-continue sessions in real scenario)');
  console.log('');

  // Simulate iterations
  const simulatedMetrics: ActualMetrics[] = [
    // Iteration 1
    {
      qualityScore: 50,
      eslintErrors: 12,
      typeScriptErrors: 6,
      securityIssues: 2,
      testCoverage: 40,
      testsPassed: 4,
      testsFailed: 6,
      buildTimeMs: 22000,
      linesOfCode: 450,
      cyclomaticComplexity: 11,
    },
    // Iteration 2
    {
      qualityScore: 65,
      eslintErrors: 6,
      typeScriptErrors: 3,
      securityIssues: 1,
      testCoverage: 55,
      testsPassed: 7,
      testsFailed: 3,
      buildTimeMs: 19000,
      linesOfCode: 480,
      cyclomaticComplexity: 9,
    },
    // Iteration 3
    {
      qualityScore: 78,
      eslintErrors: 2,
      typeScriptErrors: 1,
      securityIssues: 0,
      testCoverage: 72,
      testsPassed: 10,
      testsFailed: 0,
      buildTimeMs: 16000,
      linesOfCode: 520,
      cyclomaticComplexity: 7,
    },
    // Iteration 4
    {
      qualityScore: 88,
      eslintErrors: 0,
      typeScriptErrors: 0,
      securityIssues: 0,
      testCoverage: 85,
      testsPassed: 12,
      testsFailed: 0,
      buildTimeMs: 14000,
      linesOfCode: 550,
      cyclomaticComplexity: 6,
    },
  ];

  for (let i = 0; i < simulatedMetrics.length; i++) {
    const metrics = simulatedMetrics[i];
    const sessionId = `integrated-session-${i + 1}`;

    console.log(`🔄 Iteration ${i + 1}/${simulatedMetrics.length}`);
    console.log(`   Session: ${sessionId}`);

    const iteration = await orchestrator.executeIteration(
      loop.loopId,
      sessionId,
      metrics,
    );

    console.log(`   📊 Score: ${iteration.consumptionReport.overallScore}/100`);
    console.log(`   📈 Improvement: ${iteration.scoreImprovement > 0 ? '+' : ''}${iteration.scoreImprovement.toFixed(1)}`);
    console.log(`   ✅ Goal Achieved: ${iteration.consumptionReport.goalAchieved ? 'Yes' : 'No'}`);
    console.log(`   ${iteration.feedback.summary}`);

    if (iteration.consumptionReport.gaps.length > 0) {
      console.log(`   ⚠️  Gaps:`);
      for (const gap of iteration.consumptionReport.gaps.slice(0, 2)) {
        console.log(`      - ${gap.metric}: ${gap.gap.toFixed(1)} (${gap.severity})`);
      }
    }

    console.log('');

    if (iteration.consumptionReport.goalAchieved) {
      console.log('🎉 Goal achieved with integrated system!');
      break;
    }

    // Simulate session continuation (Water Spider's role)
    if (i < simulatedMetrics.length - 1) {
      console.log('   🕷️ Water Spider: Auto-continuing session...');
      await sleep(500);
    }

    console.log('');
  }

  // Final report
  const finalLoop = orchestrator.getLoop(loop.loopId);
  if (finalLoop) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📈 Integration Report');
    console.log('');
    console.log('🔄 Feedback Loop:');
    console.log(`   Status: ${finalLoop.status}`);
    console.log(`   Iterations: ${finalLoop.iteration}`);
    console.log(`   Score History: [${finalLoop.convergenceMetrics.scoreHistory.join(', ')}]`);
    console.log(`   Improvement Rate: ${finalLoop.convergenceMetrics.improvementRate.toFixed(2)} pts/iteration`);
    console.log('');

    console.log('🕷️ Water Spider:');
    console.log(`   Auto-Continue: Enabled`);
    console.log(`   Sessions Monitored: ${finalLoop.iteration}`);
    console.log(`   Continuations: ${finalLoop.iteration - 1}`);
    console.log('');

    const lastIteration = finalLoop.iterations[finalLoop.iterations.length - 1];
    console.log('📊 Final State:');
    console.log(`   Overall Score: ${lastIteration.consumptionReport.overallScore}/100`);
    console.log(`   Goal Achieved: ${lastIteration.consumptionReport.goalAchieved}`);
    console.log(`   Gaps Remaining: ${lastIteration.consumptionReport.gaps.length}`);
    console.log('');
  }

  console.log('✅ Integrated demo completed successfully!');
  console.log('');
  console.log('🎯 Key Benefits Demonstrated:');
  console.log('   ✅ Continuous improvement through feedback loop');
  console.log('   ✅ Automatic session continuation (Water Spider)');
  console.log('   ✅ Progressive quality improvement (50 → 88 score)');
  console.log('   ✅ Zero human intervention required');
  console.log('');
  console.log('🚀 Ready for production use!');
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
