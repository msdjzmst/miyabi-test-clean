/**
 * Performance Monitor
 *
 * Monitors and collects performance metrics during Task Tool parallel execution.
 * Tracks system resources, execution progress, and generates alerts.
 */

import type {
  PerformanceMetrics,
  SystemMetrics,
  ExecutionMetrics,
  ResourceMetrics,
  QualityMetrics,
  CostMetrics,
  MetricsHistory,
  PerformanceAlert,
  PerformanceReport,
  MetricsTrend,
} from '../packages/coding-agents/types/performance-metrics';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMonitorConfig {
  sessionId: string;
  enableRealtimeMonitoring: boolean;
  monitoringIntervalMs: number;
  enableAlerts: boolean;
  alertThresholds: AlertThresholds;
  historyRetentionMs: number;
}

export interface AlertThresholds {
  cpuUsagePercent: number;  // Default: 90
  memoryUsagePercent: number;  // Default: 85
  diskUsagePercent: number;  // Default: 80
  failureRatePercent: number;  // Default: 20
  lowThroughputTasksPerMin: number;  // Default: 5
  highCostUSD: number;  // Default: 10
}

const DEFAULT_CONFIG: Omit<PerformanceMonitorConfig, 'sessionId'> = {
  enableRealtimeMonitoring: true,
  monitoringIntervalMs: 10000,  // 10 seconds
  enableAlerts: true,
  alertThresholds: {
    cpuUsagePercent: 90,
    memoryUsagePercent: 85,
    diskUsagePercent: 80,
    failureRatePercent: 20,
    lowThroughputTasksPerMin: 5,
    highCostUSD: 10,
  },
  historyRetentionMs: 3600000,  // 1 hour
};

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private history: MetricsHistory;
  private alerts: PerformanceAlert[];
  private monitoringInterval: NodeJS.Timeout | null;
  private startTime: number;

  // Execution state for metrics calculation
  private executionState: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
    taskDurations: number[];
    qualityScores: number[];
    apiCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };

  constructor(sessionId: string, config?: Partial<PerformanceMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, sessionId, ...config };
    this.history = {
      sessionId,
      snapshots: [],
      startTime: Date.now(),
    };
    this.alerts = [];
    this.monitoringInterval = null;
    this.startTime = Date.now();

    this.executionState = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      taskDurations: [],
      qualityScores: [],
      apiCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  /**
   * Start real-time monitoring
   */
  public startMonitoring(): void {
    if (!this.config.enableRealtimeMonitoring) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.recordSnapshot(metrics);

      if (this.config.enableAlerts) {
        this.checkAlerts(metrics);
      }
    }, this.config.monitoringIntervalMs);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.history.endTime = Date.now();
  }

  /**
   * Collect current metrics snapshot
   */
  public collectMetrics(): PerformanceMetrics {
    return {
      sessionId: this.config.sessionId,
      timestamp: Date.now(),
      system: this.collectSystemMetrics(),
      execution: this.collectExecutionMetrics(),
      resources: this.collectResourceMetrics(),
      quality: this.collectQualityMetrics(),
      cost: this.collectCostMetrics(),
    };
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpuUsagePercent: this.getCPUUsage(),
      memoryUsedMB: usedMemory / (1024 * 1024),
      memoryTotalMB: totalMemory / (1024 * 1024),
      memoryUsagePercent: (usedMemory / totalMemory) * 100,
      diskUsedMB: 0,  // TODO: Implement disk usage
      diskTotalMB: 0,
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
  }

  /**
   * Collect execution metrics
   */
  private collectExecutionMetrics(): ExecutionMetrics {
    const { completedTasks, failedTasks, totalTasks, taskDurations } = this.executionState;
    const elapsedMs = Date.now() - this.startTime;
    const elapsedMin = elapsedMs / 60000;

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      runningTasks: this.executionState.runningTasks,
      pendingTasks: totalTasks - completedTasks - failedTasks - this.executionState.runningTasks,

      totalGroups: 0,  // Updated externally
      completedGroups: 0,
      failedGroups: 0,
      runningGroups: 0,

      successRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      throughput: elapsedMin > 0 ? completedTasks / elapsedMin : 0,

      averageTaskDurationMs: this.calculateAverage(taskDurations),
      medianTaskDurationMs: this.calculateMedian(taskDurations),
      p95TaskDurationMs: this.calculatePercentile(taskDurations, 95),
      p99TaskDurationMs: this.calculatePercentile(taskDurations, 99),

      totalDurationMs: elapsedMs,
      estimatedRemainingMs: this.estimateRemainingTime(),
    };
  }

  /**
   * Collect resource metrics
   */
  private collectResourceMetrics(): ResourceMetrics {
    return {
      totalWorktrees: 0,  // Updated externally
      activeWorktrees: 0,
      worktreeDiskUsageMB: 0,

      currentConcurrency: this.executionState.runningTasks,
      maxConcurrency: 5,  // Updated externally
      optimalConcurrency: this.calculateOptimalConcurrency(),
      concurrencyUtilization: 0,

      gitOperationsCount: 0,
      gitOperationsTotalMs: 0,
      gitOperationsAvgMs: 0,
    };
  }

  /**
   * Collect quality metrics
   */
  private collectQualityMetrics(): QualityMetrics {
    const { qualityScores } = this.executionState;

    return {
      averageQualityScore: this.calculateAverage(qualityScores),
      excellentCount: qualityScores.filter(s => s >= 90).length,
      goodCount: qualityScores.filter(s => s >= 80 && s < 90).length,
      acceptableCount: qualityScores.filter(s => s >= 70 && s < 80).length,
      poorCount: qualityScores.filter(s => s < 70).length,

      typeScriptErrors: 0,  // Updated externally
      eslintErrors: 0,
      eslintWarnings: 0,
      testCoverage: 0,
    };
  }

  /**
   * Collect cost metrics
   */
  private collectCostMetrics(): CostMetrics {
    const { apiCalls, totalInputTokens, totalOutputTokens } = this.executionState;

    // Anthropic Claude Sonnet pricing (approximate)
    const inputCostPer1M = 3.0;  // $3 per 1M input tokens
    const outputCostPer1M = 15.0;  // $15 per 1M output tokens

    const inputCost = (totalInputTokens / 1000000) * inputCostPer1M;
    const outputCost = (totalOutputTokens / 1000000) * outputCostPer1M;

    return {
      apiCallsCount: apiCalls,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostUSD: inputCost + outputCost,

      cpuTimeMs: Date.now() - this.startTime,
      estimatedComputeCostUSD: 0,  // TODO: Implement compute cost

      totalEstimatedCostUSD: inputCost + outputCost,
    };
  }

  /**
   * Record metrics snapshot
   */
  private recordSnapshot(metrics: PerformanceMetrics): void {
    this.history.snapshots.push({
      timestamp: metrics.timestamp,
      metrics,
    });

    // Clean up old snapshots
    const cutoffTime = Date.now() - this.config.historyRetentionMs;
    this.history.snapshots = this.history.snapshots.filter(
      s => s.timestamp >= cutoffTime,
    );
  }

  /**
   * Check for alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const thresholds = this.config.alertThresholds;

    // CPU usage alert
    if (metrics.system.cpuUsagePercent > thresholds.cpuUsagePercent) {
      this.addAlert({
        severity: 'critical',
        metric: 'cpuUsagePercent',
        message: `High CPU usage: ${metrics.system.cpuUsagePercent.toFixed(1)}%`,
        value: metrics.system.cpuUsagePercent,
        threshold: thresholds.cpuUsagePercent,
        timestamp: Date.now(),
        suggestion: 'Consider reducing concurrency or adding more compute resources',
      });
    }

    // Memory usage alert
    if (metrics.system.memoryUsagePercent > thresholds.memoryUsagePercent) {
      this.addAlert({
        severity: 'critical',
        metric: 'memoryUsagePercent',
        message: `High memory usage: ${metrics.system.memoryUsagePercent.toFixed(1)}%`,
        value: metrics.system.memoryUsagePercent,
        threshold: thresholds.memoryUsagePercent,
        timestamp: Date.now(),
        suggestion: 'Reduce concurrency or clean up worktrees',
      });
    }

    // Failure rate alert
    const failureRate = metrics.execution.totalTasks > 0
      ? (metrics.execution.failedTasks / metrics.execution.totalTasks) * 100
      : 0;

    if (failureRate > thresholds.failureRatePercent) {
      this.addAlert({
        severity: 'warning',
        metric: 'failureRate',
        message: `High failure rate: ${failureRate.toFixed(1)}%`,
        value: failureRate,
        threshold: thresholds.failureRatePercent,
        timestamp: Date.now(),
        suggestion: 'Check logs for common failure patterns',
      });
    }

    // Low throughput alert
    if (metrics.execution.throughput < thresholds.lowThroughputTasksPerMin) {
      this.addAlert({
        severity: 'info',
        metric: 'throughput',
        message: `Low throughput: ${metrics.execution.throughput.toFixed(2)} tasks/min`,
        value: metrics.execution.throughput,
        threshold: thresholds.lowThroughputTasksPerMin,
        timestamp: Date.now(),
        suggestion: 'Increase concurrency if resources allow',
      });
    }

    // High cost alert
    if (metrics.cost.totalEstimatedCostUSD > thresholds.highCostUSD) {
      this.addAlert({
        severity: 'warning',
        metric: 'totalCost',
        message: `High cost: $${metrics.cost.totalEstimatedCostUSD.toFixed(2)}`,
        value: metrics.cost.totalEstimatedCostUSD,
        threshold: thresholds.highCostUSD,
        timestamp: Date.now(),
        suggestion: 'Review task complexity and API usage patterns',
      });
    }
  }

  /**
   * Add alert (deduplicate)
   */
  private addAlert(alert: PerformanceAlert): void {
    // Don't add duplicate alerts within 5 minutes
    const recentAlert = this.alerts.find(
      a => a.metric === alert.metric && Date.now() - a.timestamp < 300000,
    );

    if (!recentAlert) {
      this.alerts.push(alert);
    }
  }

  /**
   * Update execution state
   */
  public updateExecutionState(update: Partial<typeof this.executionState>): void {
    Object.assign(this.executionState, update);
  }

  /**
   * Record task completion
   */
  public recordTaskCompletion(durationMs: number, success: boolean, qualityScore?: number): void {
    if (success) {
      this.executionState.completedTasks++;
      this.executionState.taskDurations.push(durationMs);

      if (qualityScore !== undefined) {
        this.executionState.qualityScores.push(qualityScore);
      }
    } else {
      this.executionState.failedTasks++;
    }

    this.executionState.runningTasks = Math.max(0, this.executionState.runningTasks - 1);
  }

  /**
   * Generate performance report
   */
  public generateReport(): PerformanceReport {
    const endTime = Date.now();
    const finalMetrics = this.collectMetrics();

    return {
      sessionId: this.config.sessionId,
      startTime: this.startTime,
      endTime,
      durationMs: endTime - this.startTime,

      summary: {
        totalTasks: this.executionState.totalTasks,
        successRate: finalMetrics.execution.successRate,
        averageThroughput: finalMetrics.execution.throughput,
        totalCostUSD: finalMetrics.cost.totalEstimatedCostUSD,
      },

      metrics: finalMetrics,
      history: this.history,
      trends: this.calculateTrends(),
      alerts: this.alerts,

      recommendations: this.generateRecommendations(finalMetrics),
    };
  }

  /**
   * Calculate metric trends
   */
  private calculateTrends(): MetricsTrend[] {
    // TODO: Implement trend analysis
    return [];
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    // Concurrency recommendations
    const concurrencyUtil = (metrics.resources.currentConcurrency / metrics.resources.maxConcurrency) * 100;
    if (concurrencyUtil < 50) {
      recommendations.push('Increase concurrency to improve throughput');
    } else if (concurrencyUtil > 90) {
      recommendations.push('System is near max concurrency - consider scaling resources');
    }

    // Quality recommendations
    if (metrics.quality.averageQualityScore < 80) {
      recommendations.push('Quality scores are below target - review task complexity');
    }

    // Cost recommendations
    if (metrics.cost.totalEstimatedCostUSD > 5) {
      recommendations.push('Consider batching smaller tasks to reduce API overhead');
    }

    return recommendations;
  }

  /**
   * Get CPU usage percentage
   */
  private getCPUUsage(): number {
    const cpus = os.cpus();
    if (cpus.length === 0) {return 0;}

    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    if (totalTick === 0) {return 0;}

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (100 * idle / total);

    return Math.max(0, Math.min(100, isNaN(usage) ? 0 : usage));
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) {return 0;}
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) {return 0;}
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {return 0;}
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Estimate remaining time
   */
  private estimateRemainingTime(): number {
    const { completedTasks, totalTasks, taskDurations } = this.executionState;
    if (completedTasks === 0 || totalTasks === 0) {return 0;}

    const avgDuration = this.calculateAverage(taskDurations);
    const remainingTasks = totalTasks - completedTasks;
    return avgDuration * remainingTasks;
  }

  /**
   * Calculate optimal concurrency
   */
  private calculateOptimalConcurrency(): number {
    const cpuCores = os.cpus().length;
    const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);

    const cpuBased = Math.max(1, Math.floor(cpuCores / 2));
    const memoryBased = Math.max(1, Math.floor(freeMemoryGB / 2));

    return Math.min(cpuBased, memoryBased);
  }

  /**
   * Save report to file
   */
  public async saveReport(report: PerformanceReport, outputPath: string): Promise<void> {
    const reportDir = path.dirname(outputPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(report, null, 2),
      'utf-8',
    );
  }

  /**
   * Get current alerts
   */
  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get metrics history
   */
  public getHistory(): MetricsHistory {
    return { ...this.history };
  }
}
