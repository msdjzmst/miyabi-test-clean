#!/usr/bin/env tsx
/**
 * Performance Report Generator
 *
 * Generates comprehensive performance reports from agent execution metrics
 * Shows bottlenecks, recommendations, and improvement suggestions
 */

import { PerformanceMonitor } from '@miyabi/coding-agents/monitoring/performance-monitor';
import * as path from 'path';

async function main() {
  console.log('📊 Generating Performance Report...\n');

  // Get performance monitor instance
  const reportDirectory = path.join(process.cwd(), '.ai', 'performance');
  const monitor = PerformanceMonitor.getInstance(reportDirectory);

  // Generate report
  const report = monitor.generateReport();

  // Display summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PERFORMANCE SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total Agents Tracked:    ${report.summary.totalAgents}`);
  console.log(`Total Execution Time:    ${(report.summary.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`Average per Agent:       ${(report.summary.averageDurationMs / 1000).toFixed(2)}s`);
  console.log(`Slowest Agent:           ${report.summary.slowestAgent.type} (${(report.summary.slowestAgent.durationMs / 1000).toFixed(2)}s)`);
  console.log(`\nTotal Bottlenecks:       ${report.summary.totalBottlenecks}`);
  console.log(`  - Critical:            ${report.summary.criticalBottlenecks} 🔴`);
  console.log(`  - Other:               ${report.summary.totalBottlenecks - report.summary.criticalBottlenecks}`);

  // Display recommendations
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RECOMMENDATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const recommendation of report.recommendations) {
    console.log(recommendation);
  }

  // Display top bottlenecks
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TOP BOTTLENECKS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allBottlenecks = report.agentMetrics.flatMap((m) => ({
    agent: m.agentType,
    ...m,
    bottlenecks: m.bottlenecks,
  }));

  const sortedBottlenecks = allBottlenecks
    .flatMap((a) => a.bottlenecks.map((b) => ({ agent: a.agent, ...b })))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  for (const bottleneck of sortedBottlenecks) {
    const impactEmoji = {
      critical: '🔴',
      high: '🟡',
      medium: '🟠',
      low: '🟢',
    }[bottleneck.impact];

    console.log(`${impactEmoji} [${bottleneck.agent}] ${bottleneck.description}`);
    console.log(`   Duration: ${(bottleneck.durationMs / 1000).toFixed(2)}s`);
    console.log(`   💡 ${bottleneck.suggestion}\n`);
  }

  // Display agent breakdown
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AGENT BREAKDOWN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const agent of report.agentMetrics) {
    console.log(`${agent.agentType} (${agent.taskId})`);
    console.log(`  Total Time:        ${(agent.totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`  Tool Invocations:  ${agent.toolInvocations.length}`);
    console.log(`  Bottlenecks:       ${agent.bottlenecks.length}`);
    console.log(`  Memory Usage:      ${agent.memoryUsageMb.toFixed(2)} MB\n`);
  }

  console.log('\n✅ Report generated successfully!');
  console.log(`   Report saved to: ${reportDirectory}/performance-report-*.json\n`);
}

main().catch((error) => {
  console.error('❌ Error generating report:', error);
  process.exit(1);
});
