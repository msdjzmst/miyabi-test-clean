/**
 * Performance Metrics Types
 *
 * Defines metrics for monitoring Task Tool parallel execution performance.
 * Tracks system resources, execution times, and success rates.
 */

export interface PerformanceMetrics {
  sessionId: string;
  timestamp: number;

  // System metrics
  system: SystemMetrics;

  // Execution metrics
  execution: ExecutionMetrics;

  // Resource usage
  resources: ResourceMetrics;

  // Quality metrics
  quality: QualityMetrics;

  // Cost metrics
  cost: CostMetrics;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryUsagePercent: number;
  diskUsedMB: number;
  diskTotalMB: number;
  loadAverage: number[];  // 1, 5, 15 min averages
  platform: string;
  arch: string;
  nodeVersion: string;
}

export interface ExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;

  totalGroups: number;
  completedGroups: number;
  failedGroups: number;
  runningGroups: number;

  successRate: number;  // 0-100
  throughput: number;  // tasks per minute

  averageTaskDurationMs: number;
  medianTaskDurationMs: number;
  p95TaskDurationMs: number;
  p99TaskDurationMs: number;

  totalDurationMs: number;
  estimatedRemainingMs: number;
}

export interface ResourceMetrics {
  // Worktree resources
  totalWorktrees: number;
  activeWorktrees: number;
  worktreeDiskUsageMB: number;

  // Concurrency
  currentConcurrency: number;
  maxConcurrency: number;
  optimalConcurrency: number;
  concurrencyUtilization: number;  // 0-100

  // Git operations
  gitOperationsCount: number;
  gitOperationsTotalMs: number;
  gitOperationsAvgMs: number;
}

export interface QualityMetrics {
  averageQualityScore: number;  // 0-100
  excellentCount: number;  // 90-100
  goodCount: number;  // 80-89
  acceptableCount: number;  // 70-79
  poorCount: number;  // 0-69

  typeScriptErrors: number;
  eslintErrors: number;
  eslintWarnings: number;
  testCoverage: number;  // 0-100
}

export interface CostMetrics {
  // API usage (if using Anthropic API)
  apiCallsCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUSD: number;

  // Compute resources
  cpuTimeMs: number;
  estimatedComputeCostUSD: number;

  // Total cost
  totalEstimatedCostUSD: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: PerformanceMetrics;
}

export interface MetricsHistory {
  sessionId: string;
  snapshots: MetricsSnapshot[];
  startTime: number;
  endTime?: number;
}

export interface MetricsTrend {
  metric: keyof PerformanceMetrics;
  values: number[];
  timestamps: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;  // percent per minute
}

export interface PerformanceAlert {
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  suggestion?: string;
}

export interface PerformanceReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMs: number;

  summary: {
    totalTasks: number;
    successRate: number;
    averageThroughput: number;
    totalCostUSD: number;
  };

  metrics: PerformanceMetrics;
  history: MetricsHistory;
  trends: MetricsTrend[];
  alerts: PerformanceAlert[];

  recommendations: string[];
}
