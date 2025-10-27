/**
 * Metrics Collector - Agent performance metrics collection
 *
 * Issue: #142 - Agent Activity Dashboard
 * Phase: Data Collection Infrastructure
 */

import { EventEmitter } from 'events';
import {
  AgentType,
  AgentStatus,
  AgentMetrics,
  Task,
} from '../../packages/coding-agents/types';
import {
  AgentDashboard,
  ActiveAgentInfo,
  ErrorLog,
  DashboardAlert,
  DashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  createEmptyDashboard,
} from './dashboard-config';

// ============================================================================
// MetricsCollector Implementation
// ============================================================================

/**
 * MetricsCollector - Collect and aggregate agent metrics
 *
 * Features:
 * - Track active agents
 * - Record execution metrics
 * - Calculate statistics
 * - Generate alerts
 * - Maintain historical data
 */
export class MetricsCollector extends EventEmitter {
  private dashboard: AgentDashboard;
  private config: DashboardConfig;
  private activeAgentMap: Map<string, ActiveAgentInfo>;
  private executionHistory: Array<{
    agentType: AgentType;
    durationMs: number;
    success: boolean;
    timestamp: string;
  }>;

  constructor(config: Partial<DashboardConfig> = {}) {
    super();

    this.config = { ...DEFAULT_DASHBOARD_CONFIG, ...config };
    this.dashboard = createEmptyDashboard();
    this.activeAgentMap = new Map();
    this.executionHistory = [];

    // Start periodic updates
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, this.config.updateInterval);
  }

  // ==========================================================================
  // Agent Lifecycle Tracking
  // ==========================================================================

  /**
   * Record agent start
   */
  onAgentStart(agentType: AgentType, taskId: string, taskTitle?: string): void {
    const info: ActiveAgentInfo = {
      agentType,
      status: 'running',
      taskId,
      taskTitle,
      startedAt: new Date().toISOString(),
      elapsedTime: 0,
      progress: 0,
    };

    this.activeAgentMap.set(taskId, info);
    this.emit('agent:started', info);

    // Check for long-running task alert
    setTimeout(() => {
      if (this.activeAgentMap.has(taskId)) {
        this.createAlert(
          'warning',
          `Long-running task detected: ${agentType} (${taskId})`,
          agentType,
          taskId
        );
      }
    }, this.config.alertThresholds.longRunningTaskMinutes * 60 * 1000);
  }

  /**
   * Record agent progress update
   */
  onAgentProgress(taskId: string, progress: number): void {
    const info = this.activeAgentMap.get(taskId);
    if (info) {
      info.progress = progress;
      this.emit('agent:progress', { taskId, progress });
    }
  }

  /**
   * Record agent completion
   */
  onAgentComplete(
    agentType: AgentType,
    taskId: string,
    metrics: AgentMetrics
  ): void {
    const info = this.activeAgentMap.get(taskId);
    if (info) {
      info.status = 'completed';
      this.activeAgentMap.delete(taskId);
    }

    // Record execution history
    this.executionHistory.push({
      agentType,
      durationMs: metrics.durationMs,
      success: true,
      timestamp: new Date().toISOString(),
    });

    // Update daily executions
    const today = new Date().toISOString().split('T')[0];
    this.dashboard.historicalData.dailyExecutions[today] =
      (this.dashboard.historicalData.dailyExecutions[today] || 0) + 1;

    // Update completion time distribution
    const minutes = metrics.durationMs / 1000 / 60;
    if (minutes < 5) {
      this.dashboard.historicalData.completionTimeDistribution.fast++;
    } else if (minutes < 30) {
      this.dashboard.historicalData.completionTimeDistribution.medium++;
    } else {
      this.dashboard.historicalData.completionTimeDistribution.slow++;
    }

    this.emit('agent:completed', { agentType, taskId, metrics });
    this.calculateStatistics();
  }

  /**
   * Record agent failure
   */
  onAgentFailed(
    agentType: AgentType,
    taskId: string,
    error: string,
    durationMs: number
  ): void {
    const info = this.activeAgentMap.get(taskId);
    if (info) {
      info.status = 'failed';
      this.activeAgentMap.delete(taskId);
    }

    // Record execution history
    this.executionHistory.push({
      agentType,
      durationMs,
      success: false,
      timestamp: new Date().toISOString(),
    });

    // Add error log
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      agentType,
      error,
      taskId,
      severity: 'error',
    };

    this.dashboard.historicalData.errorLogs.unshift(errorLog);

    // Trim error logs
    if (
      this.dashboard.historicalData.errorLogs.length >
      this.config.maxErrorLogs
    ) {
      this.dashboard.historicalData.errorLogs =
        this.dashboard.historicalData.errorLogs.slice(
          0,
          this.config.maxErrorLogs
        );
    }

    // Create alert for failure
    this.createAlert('error', `Agent failed: ${error}`, agentType, taskId);

    this.emit('agent:failed', { agentType, taskId, error });
    this.calculateStatistics();
  }

  // ==========================================================================
  // Real-time Metrics
  // ==========================================================================

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(): void {
    const now = Date.now();

    // Update elapsed time for active agents
    const activeAgents: ActiveAgentInfo[] = [];
    for (const info of this.activeAgentMap.values()) {
      const startTime = new Date(info.startedAt).getTime();
      info.elapsedTime = now - startTime;
      activeAgents.push(info);
    }

    this.dashboard.realTimeMetrics.activeAgents = activeAgents;
    this.dashboard.realTimeMetrics.lastUpdate = new Date().toISOString();

    // Calculate throughput (tasks per minute in last 5 minutes)
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const recentExecutions = this.executionHistory.filter(
      (h) => h.timestamp > fiveMinutesAgo
    );
    this.dashboard.realTimeMetrics.currentThroughput =
      recentExecutions.length / 5;

    this.emit('metrics:updated', this.dashboard.realTimeMetrics);
  }

  /**
   * Calculate historical statistics
   */
  private calculateStatistics(): void {
    const agentStats: Record<
      string,
      { total: number; success: number; totalDuration: number }
    > = {};

    // Aggregate execution history
    for (const execution of this.executionHistory) {
      const key = execution.agentType;
      if (!agentStats[key]) {
        agentStats[key] = { total: 0, success: 0, totalDuration: 0 };
      }

      agentStats[key].total++;
      if (execution.success) {
        agentStats[key].success++;
      }
      agentStats[key].totalDuration += execution.durationMs;
    }

    // Calculate success rate and average duration
    for (const [agentType, stats] of Object.entries(agentStats)) {
      const successRate = (stats.success / stats.total) * 100;
      const avgDuration = stats.totalDuration / stats.total;

      this.dashboard.historicalData.successRate[agentType as AgentType] =
        successRate;
      this.dashboard.historicalData.avgDuration[agentType as AgentType] =
        avgDuration;

      // Check error rate threshold
      if (successRate < 100 - this.config.alertThresholds.errorRatePercent) {
        this.createAlert(
          'warning',
          `High error rate for ${agentType}: ${(100 - successRate).toFixed(1)}%`,
          agentType as AgentType
        );
      }
    }

    this.emit('statistics:updated', this.dashboard.historicalData);
  }

  // ==========================================================================
  // Alerts
  // ==========================================================================

  /**
   * Create an alert
   */
  private createAlert(
    severity: DashboardAlert['severity'],
    message: string,
    agentType?: AgentType,
    taskId?: string
  ): void {
    const alert: DashboardAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      agentType,
      taskId,
    };

    this.dashboard.alerts.unshift(alert);

    // Keep only last 50 alerts
    if (this.dashboard.alerts.length > 50) {
      this.dashboard.alerts = this.dashboard.alerts.slice(0, 50);
    }

    this.emit('alert:created', alert);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.dashboard.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', alertId);
    }
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get current dashboard state
   */
  getDashboard(): AgentDashboard {
    return JSON.parse(JSON.stringify(this.dashboard));
  }

  /**
   * Get active agents
   */
  getActiveAgents(): ActiveAgentInfo[] {
    return Array.from(this.activeAgentMap.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear old data
   */
  clearOldData(): void {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);
    const retentionDateStr = retentionDate.toISOString();

    // Clear old execution history
    this.executionHistory = this.executionHistory.filter(
      (h) => h.timestamp > retentionDateStr
    );

    // Clear old daily executions
    for (const date of Object.keys(
      this.dashboard.historicalData.dailyExecutions
    )) {
      if (date < retentionDateStr.split('T')[0]) {
        delete this.dashboard.historicalData.dailyExecutions[date];
      }
    }

    this.emit('data:cleared');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global MetricsCollector instance
 */
export const globalMetricsCollector = new MetricsCollector();
