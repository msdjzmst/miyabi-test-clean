/**
 * Test script for ParallelExecutionManager
 *
 * Tests ParallelExecutionManager functionality:
 * - Initialization
 * - Progress tracking
 * - Integration with WorktreeManager
 */

import { ParallelExecutionManager } from '@miyabi/coding-agents/execution/parallel-execution-manager';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Testing ParallelExecutionManager                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const testResults: Array<{ test: string; passed: boolean; message: string }> = [];

  // Test 1: ParallelExecutionManager initialization
  console.log('1️⃣ Test: ParallelExecutionManager initialization');
  try {
    void new ParallelExecutionManager({
      maxConcurrency: 2,
      worktreeConfig: {
        basePath: '.worktrees',
        repoRoot: process.cwd(),
      },
      feedbackLoopConfig: {
        maxIterations: 5,
        convergenceThreshold: 5,
        autoRefinementEnabled: true,
      },
      metricsConfig: {
        workingDirectory: process.cwd(),
        skipTests: true,
        skipCoverage: true,
      },
      timeout: 60000,
      enableLogging: true,
    });

    testResults.push({
      test: 'ParallelExecutionManager initialization',
      passed: true,
      message: 'ParallelExecutionManager created successfully',
    });
    console.log('   ✅ ParallelExecutionManager initialized');
  } catch (error: any) {
    testResults.push({
      test: 'ParallelExecutionManager initialization',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 2: Get initial progress
  console.log('2️⃣ Test: Get initial progress');
  try {
    const manager = new ParallelExecutionManager({
      maxConcurrency: 2,
      worktreeConfig: {
        basePath: '.worktrees',
        repoRoot: process.cwd(),
      },
      feedbackLoopConfig: {
        maxIterations: 5,
        convergenceThreshold: 5,
        autoRefinementEnabled: true,
      },
      metricsConfig: {
        workingDirectory: process.cwd(),
        skipTests: true,
        skipCoverage: true,
      },
      enableLogging: false,
    });

    const progress = manager.getProgress();

    console.log('   📊 Initial Progress:');
    console.log(`      - Total: ${progress.total}`);
    console.log(`      - Pending: ${progress.pending}`);
    console.log(`      - Running: ${progress.running}`);
    console.log(`      - Completed: ${progress.completed}`);
    console.log(`      - Failed: ${progress.failed}`);
    console.log(`      - Percentage: ${progress.percentage.toFixed(1)}%`);

    testResults.push({
      test: 'Get initial progress',
      passed: true,
      message: `Initial progress: ${progress.total} total tasks`,
    });
    console.log('   ✅ Progress retrieved successfully');
  } catch (error: any) {
    testResults.push({
      test: 'Get initial progress',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 3: Verify component integration
  console.log('3️⃣ Test: Component integration verification');
  try {
    console.log('   🔍 Checking component files...');

    const components = [
      'agents/execution/parallel-execution-manager.ts',
      'agents/worktree/worktree-manager.ts',
      'agents/water-spider/water-spider-agent.ts',
      'agents/feedback-loop/infinite-loop-orchestrator.ts',
      'agents/feedback-loop/metrics-collector.ts',
      'agents/feedback-loop/goal-manager.ts',
      'agents/feedback-loop/consumption-validator.ts',
    ];

    const fs = await import('fs');

    let allFound = true;
    for (const component of components) {
      if (fs.existsSync(component)) {
        console.log(`      ✅ ${component}`);
      } else {
        console.log(`      ❌ ${component} not found`);
        allFound = false;
      }
    }

    if (allFound) {
      testResults.push({
        test: 'Component integration verification',
        passed: true,
        message: 'All components found',
      });
      console.log('   ✅ All components verified');
    } else {
      testResults.push({
        test: 'Component integration verification',
        passed: false,
        message: 'Some components missing',
      });
      console.log('   ⚠️  Some components missing');
    }
  } catch (error: any) {
    testResults.push({
      test: 'Component integration verification',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 4: Configuration validation
  console.log('4️⃣ Test: Configuration validation');
  try {
    const validConfigs = [
      { maxConcurrency: 1, desc: 'Sequential execution (concurrency=1)' },
      { maxConcurrency: 2, desc: 'Low concurrency (concurrency=2)' },
      { maxConcurrency: 5, desc: 'High concurrency (concurrency=5)' },
    ];

    console.log('   🔧 Testing different configurations:');

    for (const { maxConcurrency, desc } of validConfigs) {
      void new ParallelExecutionManager({
        maxConcurrency,
        worktreeConfig: {
          basePath: '.worktrees',
          repoRoot: process.cwd(),
        },
        feedbackLoopConfig: {
          maxIterations: 5,
          convergenceThreshold: 5,
          autoRefinementEnabled: true,
        },
        metricsConfig: {
          workingDirectory: process.cwd(),
          skipTests: true,
          skipCoverage: true,
        },
        enableLogging: false,
      });

      console.log(`      ✅ ${desc}`);
    }

    testResults.push({
      test: 'Configuration validation',
      passed: true,
      message: 'All configurations valid',
    });
    console.log('   ✅ Configuration validation successful');
  } catch (error: any) {
    testResults.push({
      test: 'Configuration validation',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 Test Results Summary:');
  console.log('');

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  const passRate = (passedCount / totalCount) * 100;

  testResults.forEach((result, i) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`   ${i + 1}. ${icon} ${result.test}`);
    console.log(`      ${result.message}`);
  });

  console.log('');
  console.log(`   Total: ${passedCount}/${totalCount} passed (${passRate.toFixed(1)}%)`);
  console.log('');

  if (passRate === 100) {
    console.log('🎉 All tests passed! ParallelExecutionManager is ready to use.');
  } else if (passRate >= 80) {
    console.log('✅ Most tests passed. ParallelExecutionManager is functional with minor issues.');
  } else {
    console.log('⚠️  Some tests failed. Check the results above for details.');
  }

  console.log('');
  console.log('💡 Usage Example:');
  console.log('   const manager = new ParallelExecutionManager({');
  console.log('     maxConcurrency: 3,');
  console.log('     worktreeConfig: {');
  console.log('       basePath: ".worktrees",');
  console.log('       repoRoot: process.cwd(),');
  console.log('     },');
  console.log('     feedbackLoopConfig: {');
  console.log('       maxIterations: 10,');
  console.log('       convergenceThreshold: 5,');
  console.log('       autoRefinementEnabled: true,');
  console.log('     },');
  console.log('     metricsConfig: {');
  console.log('       workingDirectory: process.cwd(),');
  console.log('     },');
  console.log('   });');
  console.log('');
  console.log('   // Execute issues in parallel');
  console.log('   const report = await manager.executeIssues(issues);');
  console.log('');
  console.log('   // Get progress');
  console.log('   const progress = manager.getProgress();');
  console.log('');
  console.log('   // Cleanup');
  console.log('   await manager.cleanup();');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(passRate === 100 ? 0 : 1);
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { main };
