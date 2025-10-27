/**
 * Performance Monitor - Agent Performance Tracking & Feedback Loop
 *
 * Tracks:
 * - Tool invocation delays
 * - Agent execution bottlenecks
 * - API call latencies
 * - File I/O operations
 * - Memory usage
 *
 * Provides automatic feedback loop for continuous improvement
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ToolInvocationMetrics {
  toolName: string;
  agentType: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentPerformanceMetrics {
  agentType: string;
  taskId: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  toolInvocations: ToolInvocationMetrics[];
  bottlenecks: PerformanceBottleneck[];
  memoryUsageMb: number;
}

export interface PerformanceBottleneck {
  type: 'tool_invocation' | 'api_call' | 'file_io' | 'computation';
  description: string;
  durationMs: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface PerformanceReport {
  timestamp: string;
  agentMetrics: AgentPerformanceMetrics[];
  summary: {
    totalAgents: number;
    totalDurationMs: number;
    averageDurationMs: number;
    slowestAgent: { type: string; durationMs: number };
    totalBottlenecks: number;
    criticalBottlenecks: number;
  };
  recommendations: string[];
}

/**
 * Singleton Performance Monitor
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private agentMetrics: Map<string, AgentPerformanceMetrics> = new Map();
  private reportDirectory: string;
  private readonly SLOW_TOOL_THRESHOLD_MS = 1000; // 1 second

  private constructor(reportDirectory: string = '.ai/performance') {
    this.reportDirectory = reportDirectory;
    this.ensureDirectory(this.reportDirectory);
  }

  static getInstance(reportDirectory?: string): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(reportDirectory);
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start tracking an agent's performance
   */
  startAgentTracking(agentType: string, taskId: string): void {
    const key = `${agentType}-${taskId}-${Date.now()}`;
    this.agentMetrics.set(key, {
      agentType,
      taskId,
      startTime: Date.now(),
      endTime: 0,
      totalDurationMs: 0,
      toolInvocations: [],
      bottlenecks: [],
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    });
  }

  /**
   * Track a tool invocation
   */
  trackToolInvocation(
    agentType: string,
    taskId: string,
    toolName: string,
    startTime: number,
    endTime: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const key = this.findAgentKey(agentType, taskId);
    if (!key) {
      console.warn(`⚠️  Agent not tracked: ${agentType} - ${taskId}`);
      return;
    }

    const metrics = this.agentMetrics.get(key)!;
    const durationMs = endTime - startTime;

    const invocation: ToolInvocationMetrics = {
      toolName,
      agentType,
      startTime,
      endTime,
      durationMs,
      success,
      error,
      metadata,
    };

    metrics.toolInvocations.push(invocation);

    // Detect bottlenecks
    if (durationMs > this.SLOW_TOOL_THRESHOLD_MS) {
      const bottleneck: PerformanceBottleneck = {
        type: this.classifyToolType(toolName),
        description: `Slow tool invocation: ${toolName} took ${durationMs}ms`,
        durationMs,
        impact: this.determineImpact(durationMs),
        suggestion: this.generateSuggestion(toolName, durationMs),
      };
      metrics.bottlenecks.push(bottleneck);
    }
  }

  /**
   * End agent tracking and calculate final metrics
   */
  endAgentTracking(agentType: string, taskId: string): AgentPerformanceMetrics | null {
    const key = this.findAgentKey(agentType, taskId);
    if (!key) return null;

    const metrics = this.agentMetrics.get(key)!;
    metrics.endTime = Date.now();
    metrics.totalDurationMs = metrics.endTime - metrics.startTime;

    // Save metrics to file
    this.saveAgentMetrics(metrics);

    // Remove from active tracking
    this.agentMetrics.delete(key);

    return metrics;
  }

  /**
   * Generate performance report for all tracked agents
   */
  generateReport(): PerformanceReport {
    const allMetrics: AgentPerformanceMetrics[] = [];

    // Include completed agents from files
    const reportFiles = this.getReportFiles();
    for (const file of reportFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const metrics = JSON.parse(content) as AgentPerformanceMetrics;
        allMetrics.push(metrics);
      } catch (error) {
        // Ignore file read errors
      }
    }

    if (allMetrics.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        agentMetrics: [],
        summary: {
          totalAgents: 0,
          totalDurationMs: 0,
          averageDurationMs: 0,
          slowestAgent: { type: 'N/A', durationMs: 0 },
          totalBottlenecks: 0,
          criticalBottlenecks: 0,
        },
        recommendations: [],
      };
    }

    // Calculate summary
    const totalDurationMs = allMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0);
    const averageDurationMs = totalDurationMs / allMetrics.length;
    const slowestAgent = allMetrics.reduce((prev, current) =>
      prev.totalDurationMs > current.totalDurationMs ? prev : current
    );
    const totalBottlenecks = allMetrics.reduce((sum, m) => sum + m.bottlenecks.length, 0);
    const criticalBottlenecks = allMetrics.reduce(
      (sum, m) => sum + m.bottlenecks.filter((b) => b.impact === 'critical').length,
      0
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(allMetrics);

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      agentMetrics: allMetrics,
      summary: {
        totalAgents: allMetrics.length,
        totalDurationMs,
        averageDurationMs,
        slowestAgent: {
          type: slowestAgent.agentType,
          durationMs: slowestAgent.totalDurationMs,
        },
        totalBottlenecks,
        criticalBottlenecks,
      },
      recommendations,
    };

    // Save report
    this.saveReport(report);

    return report;
  }

  /**
   * Classify tool type for bottleneck categorization
   */
  private classifyToolType(toolName: string): PerformanceBottleneck['type'] {
    if (toolName.includes('claude') || toolName.includes('api')) return 'api_call';
    if (toolName.includes('file') || toolName.includes('write') || toolName.includes('read'))
      return 'file_io';
    if (
      toolName.includes('github') ||
      toolName.includes('octokit') ||
      toolName.includes('fetch')
    )
      return 'api_call';
    return 'tool_invocation';
  }

  /**
   * Determine impact level based on duration
   */
  private determineImpact(durationMs: number): PerformanceBottleneck['impact'] {
    if (durationMs > 30000) return 'critical'; // >30s
    if (durationMs > 10000) return 'high'; // >10s
    if (durationMs > 5000) return 'medium'; // >5s
    return 'low';
  }

  /**
   * Generate improvement suggestion
   */
  private generateSuggestion(toolName: string, durationMs: number): string {
    if (toolName.includes('claude') && durationMs > 5000) {
      return 'Consider using streaming API for faster TTFB, or parallel execution if generating multiple outputs';
    }
    if (toolName.includes('eslint') || toolName.includes('typescript')) {
      return 'Consider running static analysis tools in parallel with Promise.all()';
    }
    if (toolName.includes('github')) {
      return 'Consider parallel GitHub API calls with Promise.all() and check rate limiting';
    }
    if (toolName.includes('file') && durationMs > 1000) {
      return 'Consider async file operations with batching or parallel writes';
    }
    return 'Investigate tool execution time and consider optimization';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(metrics: AgentPerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    // Analyze all bottlenecks
    const allBottlenecks = metrics.flatMap((m) => m.bottlenecks);
    const criticalBottlenecks = allBottlenecks.filter((b) => b.impact === 'critical');

    if (criticalBottlenecks.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: ${criticalBottlenecks.length} critical bottlenecks detected. Immediate optimization required.`
      );

      // Group by type
      const apiBottlenecks = criticalBottlenecks.filter((b) => b.type === 'api_call');
      const fileBottlenecks = criticalBottlenecks.filter((b) => b.type === 'file_io');

      if (apiBottlenecks.length > 0) {
        recommendations.push(
          `  - Optimize API calls: Use streaming API, parallel execution, or caching`
        );
      }
      if (fileBottlenecks.length > 0) {
        recommendations.push(`  - Optimize file I/O: Use async batching or parallel operations`);
      }
    }

    // Check for slow agents
    const slowAgents = metrics.filter((m) => m.totalDurationMs > 60000); // >1 minute
    if (slowAgents.length > 0) {
      recommendations.push(
        `⚠️  ${slowAgents.length} agents taking >1 minute. Review ${slowAgents.map((a) => a.agentType).join(', ')}`
      );
    }

    // Check for sequential tool usage patterns
    for (const metric of metrics) {
      const sequentialApiCalls = this.detectSequentialApiCalls(metric.toolInvocations);
      if (sequentialApiCalls > 2) {
        recommendations.push(
          `💡 ${metric.agentType}: Detected ${sequentialApiCalls} sequential API calls. Consider parallel execution.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No critical performance issues detected. System running optimally.');
    }

    return recommendations;
  }

  /**
   * Detect sequential API calls that could be parallelized
   */
  private detectSequentialApiCalls(invocations: ToolInvocationMetrics[]): number {
    let count = 0;
    let prevEndTime = 0;

    for (const invocation of invocations) {
      if (invocation.toolName.includes('api') || invocation.toolName.includes('claude')) {
        // Check if this call started right after the previous one ended
        if (prevEndTime > 0 && Math.abs(invocation.startTime - prevEndTime) < 100) {
          count++;
        }
        prevEndTime = invocation.endTime;
      }
    }

    return count;
  }

  /**
   * Save agent metrics to file
   */
  private saveAgentMetrics(metrics: AgentPerformanceMetrics): void {
    const filename = `${metrics.agentType}-${metrics.taskId}-${Date.now()}.json`;
    const filepath = path.join(this.reportDirectory, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error(`Failed to save metrics: ${error}`);
    }
  }

  /**
   * Save performance report
   */
  private saveReport(report: PerformanceReport): void {
    const filename = `performance-report-${Date.now()}.json`;
    const filepath = path.join(this.reportDirectory, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Performance Report saved: ${filepath}`);
      console.log(`\n${report.recommendations.join('\n')}`);
    } catch (error) {
      console.error(`Failed to save report: ${error}`);
    }
  }

  /**
   * Get all report files
   */
  private getReportFiles(): string[] {
    try {
      const files = fs.readdirSync(this.reportDirectory);
      return files
        .filter((f) => f.endsWith('.json') && !f.startsWith('performance-report'))
        .map((f) => path.join(this.reportDirectory, f));
    } catch {
      return [];
    }
  }

  /**
   * Find agent key by type and task ID
   */
  private findAgentKey(agentType: string, taskId: string): string | null {
    const keys = Array.from(this.agentMetrics.keys());
    for (const key of keys) {
      if (key.startsWith(`${agentType}-${taskId}`)) {
        return key;
      }
    }
    return null;
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create directory: ${error}`);
    }
  }
}

/**
 * Convenience function to track tool invocations
 */
export async function trackToolInvocation<T>(
  agentType: string,
  taskId: string,
  toolName: string,
  operation: () => Promise<T>
): Promise<T> {
  const monitor = PerformanceMonitor.getInstance();
  const startTime = Date.now();

  try {
    const result = await operation();
    const endTime = Date.now();

    monitor.trackToolInvocation(agentType, taskId, toolName, startTime, endTime, true);

    return result;
  } catch (error) {
    const endTime = Date.now();

    monitor.trackToolInvocation(
      agentType,
      taskId,
      toolName,
      startTime,
      endTime,
      false,
      (error as Error).message
    );

    throw error;
  }
}
