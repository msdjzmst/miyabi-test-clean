/**
 * Dashboard Configuration - Agent Activity Dashboard
 *
 * Issue: #142 - Agent Activity Dashboard
 * Phase: Data Collection Infrastructure
 */

import { AgentType, AgentStatus, Task } from '../../packages/coding-agents/types';

// ============================================================================
// Dashboard Data Types
// ============================================================================

/**
 * AgentDashboard - Complete dashboard state
 */
export interface AgentDashboard {
  realTimeMetrics: RealTimeMetrics;
  historicalData: HistoricalData;
  alerts: DashboardAlert[];
}

/**
 * RealTimeMetrics - Live agent status and metrics
 */
export interface RealTimeMetrics {
  /** Currently active agents */
  activeAgents: ActiveAgentInfo[];

  /** Number of queued tasks */
  queuedTasks: number;

  /** Average execution time (seconds) */
  avgExecutionTime: number;

  /** Current throughput (tasks per minute) */
  currentThroughput: number;

  /** Last update timestamp */
  lastUpdate: string;
}

/**
 * ActiveAgentInfo - Information about an active agent
 */
export interface ActiveAgentInfo {
  agentType: AgentType;
  status: AgentStatus;
  taskId: string;
  taskTitle?: string;
  startedAt: string;
  elapsedTime: number; // milliseconds
  progress?: number; // 0-100
}

/**
 * HistoricalData - Historical metrics and trends
 */
export interface HistoricalData {
  /** Daily execution counts (date -> count) */
  dailyExecutions: Record<string, number>;

  /** Success rate by agent (agent -> percentage) */
  successRate: Record<AgentType, number>;

  /** Average duration by agent (agent -> milliseconds) */
  avgDuration: Record<AgentType, number>;

  /** Recent error logs */
  errorLogs: ErrorLog[];

  /** Task completion time distribution */
  completionTimeDistribution: {
    fast: number; // < 5 minutes
    medium: number; // 5-30 minutes
    slow: number; // > 30 minutes
  };
}

/**
 * ErrorLog - Error information
 */
export interface ErrorLog {
  timestamp: string;
  agentType: AgentType;
  error: string;
  taskId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * DashboardAlert - Alert notification
 */
export interface DashboardAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  agentType?: AgentType;
  taskId?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * DashboardConfig - Dashboard configuration
 */
export interface DashboardConfig {
  /** Update interval (milliseconds) */
  updateInterval: number;

  /** WebSocket server port */
  websocketPort: number;

  /** Maximum error log entries */
  maxErrorLogs: number;

  /** Historical data retention (days) */
  retentionDays: number;

  /** Alert thresholds */
  alertThresholds: {
    errorRatePercent: number;
    longRunningTaskMinutes: number;
    queueSizeThreshold: number;
  };
}

/**
 * Default dashboard configuration
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  updateInterval: 1000, // 1 second
  websocketPort: 3001,
  maxErrorLogs: 100,
  retentionDays: 7,
  alertThresholds: {
    errorRatePercent: 10, // 10% error rate
    longRunningTaskMinutes: 30,
    queueSizeThreshold: 50,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get emoji for agent type
 */
export function getAgentEmoji(agentType: AgentType): string {
  const emojiMap: Record<AgentType, string> = {
    CoordinatorAgent: '🎯',
    CodeGenAgent: '💻',
    ReviewAgent: '🔍',
    IssueAgent: '📋',
    PRAgent: '🔀',
    DeploymentAgent: '🚀',
    AutoFixAgent: '🔧',
    WaterSpiderAgent: '🕷️',
  };
  return emojiMap[agentType] || '🤖';
}

/**
 * Get color for agent status
 */
export function getStatusColor(status: AgentStatus): string {
  const colorMap: Record<AgentStatus, string> = {
    idle: '#888888',
    running: '#00D9FF',
    completed: '#00FF88',
    failed: '#FF0055',
    escalated: '#FFAA00',
  };
  return colorMap[status] || '#CCCCCC';
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Create empty dashboard state
 */
export function createEmptyDashboard(): AgentDashboard {
  return {
    realTimeMetrics: {
      activeAgents: [],
      queuedTasks: 0,
      avgExecutionTime: 0,
      currentThroughput: 0,
      lastUpdate: new Date().toISOString(),
    },
    historicalData: {
      dailyExecutions: {},
      successRate: {} as Record<AgentType, number>,
      avgDuration: {} as Record<AgentType, number>,
      errorLogs: [],
      completionTimeDistribution: {
        fast: 0,
        medium: 0,
        slow: 0,
      },
    },
    alerts: [],
  };
}
