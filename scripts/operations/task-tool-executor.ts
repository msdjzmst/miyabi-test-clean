/**
 * Task Tool Executor - Parallel execution using Claude Code Task tool
 *
 * Orchestrates parallel agent execution across multiple Claude Code sessions.
 * Each session runs in an isolated Git worktree with independent context.
 *
 * Architecture:
 * 1. Group tasks using TaskGrouper
 * 2. Schedule groups using TaskScheduler
 * 3. Launch Claude Code sessions using SessionManager
 * 4. Monitor progress and aggregate results
 */

import { TaskGrouper } from './task-grouper';
import { TaskScheduler } from '@miyabi/coding-agents/coordinator/task-scheduler';
import { ClaudeCodeSessionManager } from '../../utils/claude-code-session-manager';
import { PerformanceMonitor } from '../../utils/performance-monitor';
import type { Task, DAG, TaskGroup, AgentResult, ExecutionReport } from '@miyabi/coding-agents/types/index';
import type { PerformanceReport } from '@miyabi/coding-agents/types/performance-metrics';

export interface TaskToolExecutorConfig {
  worktreeBasePath: string;
  maxConcurrentGroups: number;
  sessionTimeoutMs: number;
  enableProgressReporting: boolean;
  progressReportIntervalMs: number;
  enablePerformanceMonitoring: boolean;
  performanceReportPath?: string;
}

const DEFAULT_EXECUTOR_CONFIG: TaskToolExecutorConfig = {
  worktreeBasePath: '.worktrees',
  maxConcurrentGroups: 5,
  sessionTimeoutMs: 3600000,  // 1 hour
  enableProgressReporting: true,
  progressReportIntervalMs: 30000,  // 30 seconds
  enablePerformanceMonitoring: true,
  performanceReportPath: 'reports/performance',
};

export class TaskToolExecutor {
  private config: TaskToolExecutorConfig;
  private grouper: TaskGrouper;
  private scheduler: TaskScheduler | null;
  private sessionManager: ClaudeCodeSessionManager;
  private performanceMonitor: PerformanceMonitor | null;
  private progressInterval: NodeJS.Timeout | null;

  constructor(config?: Partial<TaskToolExecutorConfig>) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
    this.grouper = new TaskGrouper({
      maxConcurrentGroups: this.config.maxConcurrentGroups,
    });
    this.scheduler = null;
    this.sessionManager = new ClaudeCodeSessionManager({
      worktreeBasePath: this.config.worktreeBasePath,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      maxConcurrentSessions: this.config.maxConcurrentGroups,
    });
    this.performanceMonitor = null;
    this.progressInterval = null;
  }

  /**
   * Execute tasks in parallel using Claude Code Task tool
   */
  public async execute(tasks: Task[], dag: DAG): Promise<ExecutionReport> {
    const startTime = Date.now();

    console.log('🚀 Starting Task Tool parallel execution');
    console.log(`   Total tasks: ${tasks.length}`);

    // Initialize performance monitor
    if (this.config.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor(`task-tool-${Date.now()}`, {
        enableRealtimeMonitoring: true,
        monitoringIntervalMs: 10000,  // 10 seconds
        enableAlerts: true,
      });

      this.performanceMonitor.updateExecutionState({
        totalTasks: tasks.length,
      });

      this.performanceMonitor.startMonitoring();
      console.log('📊 Performance monitoring enabled');
    }

    // Phase 1: Group tasks
    console.log('\n📊 Phase 1: Grouping tasks...');
    const groups = this.grouper.groupTasks(tasks, dag, this.config.worktreeBasePath);
    const groupSummary = this.grouper.generateSummary(groups);
    console.log(groupSummary);

    // Validate groups
    const validation = this.grouper.validateGroups(groups);
    if (!validation.valid) {
      throw new Error(`Group validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn(`⚠️  Warnings: ${validation.warnings.join(', ')}`);
    }

    // Phase 2: Initialize scheduler
    console.log('\n⏰ Phase 2: Initializing scheduler...');
    this.scheduler = new TaskScheduler(groups, {
      maxConcurrency: this.config.maxConcurrentGroups,
    });

    // Phase 3: Start progress reporting
    if (this.config.enableProgressReporting) {
      this.startProgressReporting();
    }

    // Phase 4: Execute groups in parallel
    console.log('\n⚡ Phase 3: Executing groups in parallel...');
    const results = await this.executeGroups();

    // Phase 5: Stop progress reporting
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Phase 6: Generate execution report
    console.log('\n📄 Phase 4: Generating execution report...');
    const endTime = Date.now();
    const report = this.generateExecutionReport(tasks, results, startTime, endTime);

    // Phase 7: Generate performance report
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
      const perfReport = this.performanceMonitor.generateReport();

      // Display alerts
      const alerts = perfReport.alerts;
      if (alerts.length > 0) {
        console.log('\n⚠️  Performance Alerts:');
        for (const alert of alerts) {
          const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️';
          console.log(`   ${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);
          if (alert.suggestion) {
            console.log(`      💡 ${alert.suggestion}`);
          }
        }
      }

      // Display recommendations
      if (perfReport.recommendations.length > 0) {
        console.log('\n💡 Performance Recommendations:');
        for (const rec of perfReport.recommendations) {
          console.log(`   • ${rec}`);
        }
      }

      // Save performance report
      if (this.config.performanceReportPath) {
        const reportPath = `${this.config.performanceReportPath}/perf-${Date.now()}.json`;
        await this.performanceMonitor.saveReport(perfReport, reportPath);
        console.log(`\n📊 Performance report saved: ${reportPath}`);
      }

      console.log(`\n📈 Performance Summary:`);
      console.log(`   Success Rate: ${perfReport.summary.successRate.toFixed(1)}%`);
      console.log(`   Throughput: ${perfReport.summary.averageThroughput.toFixed(2)} tasks/min`);
      console.log(`   Total Cost: $${perfReport.summary.totalCostUSD.toFixed(4)}`);
    }

    // Cleanup
    await this.cleanup();

    console.log('\n✅ Parallel execution completed');
    console.log(`   Duration: ${Math.ceil((endTime - startTime) / 1000)}s`);
    console.log(`   Success rate: ${report.summary.successRate.toFixed(1)}%`);

    return report;
  }

  /**
   * Execute groups in parallel with scheduler
   */
  private async executeGroups(): Promise<Map<string, AgentResult>> {
    if (!this.scheduler) {
      throw new Error('Scheduler not initialized');
    }

    const results = new Map<string, AgentResult>();

    // Main execution loop
    while (this.scheduler.hasWorkRemaining()) {
      // Get next group to execute
      const nextGroup = this.scheduler.getNextGroup();

      if (nextGroup) {
        // Start group execution
        this.scheduler.startGroup(nextGroup.groupId);

        // Launch Claude Code session (async)
        this.launchSession(nextGroup)
          .then((result) => {
            results.set(nextGroup.groupId, result);
            this.scheduler!.completeGroup(nextGroup.groupId);
          })
          .catch((error) => {
            this.scheduler!.failGroup(nextGroup.groupId, error.message);
          });
      }

      // Check for timeouts
      const timedOut = this.sessionManager.checkTimeouts();
      for (const sessionId of timedOut) {
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
          this.scheduler.failGroup(session.groupId, 'Session timeout');
        }
      }

      // Wait a bit before next iteration
      await this.sleep(1000);

      // Check if we can launch more work
      if (!this.scheduler.canAcceptWork() && this.scheduler.hasWorkRemaining()) {
        // All slots full, wait for completion
        await this.sleep(5000);
      }
    }

    // Wait for all running sessions to complete
    await this.waitForCompletion();

    return results;
  }

  /**
   * Launch Claude Code session for task group
   */
  private async launchSession(group: TaskGroup): Promise<AgentResult> {
    console.log(`\n🚀 Launching session for ${group.groupId} (${group.tasks.length} tasks)`);

    const sessionStartTime = Date.now();

    try {
      // Create session
      const session = await this.sessionManager.createSession(group);

      console.log(`   ✅ Session ${session.sessionId} created`);
      console.log(`   📂 Worktree: ${session.worktreePath}`);

      // Generate Task tool prompt
      const prompt = this.sessionManager.generateTaskToolPrompt(group);

      console.log(`   📝 Prompt generated (${prompt.length} chars)`);

      // Update performance monitor - running tasks
      if (this.performanceMonitor) {
        this.performanceMonitor.updateExecutionState({
          runningTasks: group.tasks.length,
        });
      }

      // NOTE: In real implementation, this would use Claude Code's Task tool
      // For now, we simulate execution and return mock result
      const result = await this.simulateClaudeCodeExecution(group, session.worktreePath);

      // Complete session
      this.sessionManager.completeSession(session.sessionId, result, new Map());

      // Record task completion in performance monitor
      const durationMs = Date.now() - sessionStartTime;
      const qualityScore = typeof result.data === 'object' && result.data
        ? (result.data as { qualityScore?: number }).qualityScore
        : undefined;

      if (this.performanceMonitor) {
        for (let i = 0; i < group.tasks.length; i++) {
          this.performanceMonitor.recordTaskCompletion(
            durationMs / group.tasks.length,
            result.status === 'success',
            qualityScore,
          );
        }
      }

      console.log(`   ✅ Session ${session.sessionId} completed`);

      return result;
    } catch (error) {
      console.error(`   ❌ Session failed: ${(error as Error).message}`);

      // Record task failures
      const durationMs = Date.now() - sessionStartTime;
      if (this.performanceMonitor) {
        for (let i = 0; i < group.tasks.length; i++) {
          this.performanceMonitor.recordTaskCompletion(
            durationMs / group.tasks.length,
            false,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Simulate Claude Code execution (temporary)
   *
   * TODO: Replace with actual Claude Code Task tool integration
   */
  private async simulateClaudeCodeExecution(
    group: TaskGroup,
    _worktreePath: string,
  ): Promise<AgentResult> {
    // Simulate execution time based on estimated duration
    const executionTimeMs = Math.min(group.estimatedDurationMs, 10000);
    await this.sleep(executionTimeMs);

    // Return success result
    return {
      status: 'success',
      data: {
        groupId: group.groupId,
        completedTasks: group.tasks.map((t: Task) => t.id),
        failedTasks: [],
        qualityScore: 85,
        summary: `Completed ${group.tasks.length} tasks successfully`,
      },
    };
  }

  /**
   * Wait for all running sessions to complete
   */
  private async waitForCompletion(): Promise<void> {
    while (this.sessionManager.getActiveSessions().some((s) => s.status === 'running')) {
      await this.sleep(2000);
    }
  }

  /**
   * Start progress reporting
   */
  private startProgressReporting(): void {
    this.progressInterval = setInterval(() => {
      if (this.scheduler) {
        const summary = this.scheduler.generateProgressSummary();
        console.log(`\n${summary}`);

        const stats = this.sessionManager.getStatistics();
        console.log(`\nSession Statistics:`);
        console.log(`  Active: ${stats.running}`);
        console.log(`  Completed: ${stats.completed}`);
        console.log(`  Failed: ${stats.failed}`);
      }
    }, this.config.progressReportIntervalMs);
  }

  /**
   * Generate execution report
   */
  private generateExecutionReport(
    tasks: Task[],
    results: Map<string, AgentResult>,
    startTime: number,
    endTime: number,
  ): ExecutionReport {
    const completed = Array.from(results.values()).filter((r) => r.status === 'success').length;
    const failed = Array.from(results.values()).filter((r) => r.status === 'failed').length;

    return {
      sessionId: `task-tool-${Date.now()}`,
      deviceIdentifier: process.env.DEVICE_IDENTIFIER || 'unknown',
      startTime,
      endTime,
      totalDurationMs: endTime - startTime,
      summary: {
        total: tasks.length,
        completed,
        failed,
        escalated: 0,
        successRate: (completed / tasks.length) * 100,
      },
      tasks: [],
      metrics: [],
      escalations: [],
    };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...');

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Note: We keep worktrees for debugging
    // Uncomment to clean up worktrees:
    // await this.sessionManager.cleanupAll();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current execution statistics
   */
  public getStatistics() {
    return {
      scheduler: this.scheduler?.getState(),
      sessions: this.sessionManager.getStatistics(),
      performance: this.performanceMonitor?.collectMetrics(),
    };
  }

  /**
   * Get performance report
   */
  public getPerformanceReport(): PerformanceReport | null {
    return this.performanceMonitor?.generateReport() || null;
  }
}
