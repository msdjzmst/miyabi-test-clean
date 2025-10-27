/**
 * Test script for MetricsCollector
 *
 * Tests real-time metrics collection without starting the full integrated system
 */

import { MetricsCollector } from '@miyabi/coding-agents/feedback-loop/metrics-collector';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Testing Real-Time Metrics Collection                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const workingDirectory = process.argv[2] || process.cwd();

  console.log(`📂 Working Directory: ${workingDirectory}`);
  console.log('');

  const collector = new MetricsCollector({
    workingDirectory,
    skipTests: false,
    skipCoverage: false,
    verbose: true,
  });

  try {
    console.log('🔄 Collecting metrics...');
    console.log('');

    const metrics = await collector.collect();

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Collected Metrics Summary:');
    console.log('');
    console.log(`   Quality Score:          ${metrics.qualityScore}/100`);
    console.log(`   ESLint Errors:          ${metrics.eslintErrors}`);
    console.log(`   TypeScript Errors:      ${metrics.typeScriptErrors}`);
    console.log(`   Security Issues:        ${metrics.securityIssues}`);
    console.log(`   Test Coverage:          ${metrics.testCoverage.toFixed(1)}%`);
    console.log(`   Tests Passed:           ${metrics.testsPassed}`);
    console.log(`   Tests Failed:           ${metrics.testsFailed ?? 0}`);
    console.log(`   Build Time:             ${metrics.buildTimeMs}ms`);
    console.log(`   Lines of Code:          ${(metrics.linesOfCode ?? 0).toLocaleString()}`);
    console.log(`   Cyclomatic Complexity:  ${metrics.cyclomaticComplexity ?? 0}`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Quality assessment
    if (metrics.qualityScore >= 80) {
      console.log('✅ EXCELLENT: Quality score is 80 or above');
    } else if (metrics.qualityScore >= 60) {
      console.log('⚠️  GOOD: Quality score is acceptable but has room for improvement');
    } else if (metrics.qualityScore >= 40) {
      console.log('⚠️  NEEDS IMPROVEMENT: Quality score is below expectations');
    } else {
      console.log('❌ CRITICAL: Quality score is very low - immediate action required');
    }

    console.log('');

    // Detailed feedback
    const issues: string[] = [];

    if (metrics.eslintErrors > 0) {
      issues.push(`${metrics.eslintErrors} ESLint error(s)`);
    }

    if (metrics.typeScriptErrors > 0) {
      issues.push(`${metrics.typeScriptErrors} TypeScript error(s)`);
    }

    if (metrics.securityIssues > 0) {
      issues.push(`${metrics.securityIssues} security issue(s)`);
    }

    if (metrics.testCoverage < 80) {
      issues.push(`Low test coverage (${metrics.testCoverage.toFixed(1)}%)`);
    }

    if ((metrics.testsFailed ?? 0) > 0) {
      issues.push(`${metrics.testsFailed} failing test(s)`);
    }

    if (issues.length > 0) {
      console.log('🔍 Issues Found:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('');
    }

    // Recommendations
    const recommendations: string[] = [];

    if (metrics.eslintErrors > 0) {
      recommendations.push('Run `npx eslint . --fix` to auto-fix ESLint errors');
    }

    if (metrics.typeScriptErrors > 0) {
      recommendations.push(
        'Check TypeScript errors with `npx tsc --noEmit` and fix type issues',
      );
    }

    if (metrics.testCoverage < 80) {
      recommendations.push(
        'Add more tests to increase coverage to 80% or above',
      );
    }

    if ((metrics.testsFailed ?? 0) > 0) {
      recommendations.push('Fix failing tests before proceeding');
    }

    if (recommendations.length > 0) {
      console.log('💡 Recommendations:');
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('✅ Metrics collection test completed successfully!');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Metrics collection failed:', error.message);
    console.error('');

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { main };
