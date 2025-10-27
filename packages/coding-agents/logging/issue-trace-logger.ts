/**
 * Issue Trace Logger
 *
 * Complete lifecycle tracking for GitHub Issues.
 * Tracks state transitions, agent executions, label changes, quality reports,
 * PRs, deployments, escalations, and manual annotations.
 *
 * Usage:
 *   const logger = new IssueTraceLogger(issueNumber, issueTitle, issueUrl, deviceIdentifier);
 *   logger.startTrace();
 *   logger.recordStateTransition('pending', 'analyzing', 'CoordinatorAgent');
 *   logger.startAgentExecution('CoordinatorAgent', 'task-123');
 *   logger.endAgentExecution('CoordinatorAgent', 'success');
 *   logger.saveTrace();
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type {
  IssueTraceLog,
  IssueState,
  StateTransition,
  AgentExecution,
  LabelChange,
  TraceNote,
  QualityReport,
  PRResult,
  DeploymentResult,
  EscalationInfo,
  AgentType,
  AgentStatus,
  AgentResult,
} from '../types/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * IssueTraceLogger - Complete Issue lifecycle tracker
 */
export class IssueTraceLogger {
  private trace: IssueTraceLog;
  private traceDir: string;
  private traceFilePath: string;
  private activeAgentExecutions: Map<AgentType, AgentExecution>;
  private sessionId: string;

  constructor(
    issueNumber: number,
    issueTitle: string,
    issueUrl: string,
    deviceIdentifier: string,
    sessionId?: string
  ) {
    this.sessionId = sessionId || this.generateSessionId();
    this.activeAgentExecutions = new Map();

    // Initialize trace directory
    this.traceDir = path.resolve(__dirname, '../../.ai/trace-logs');
    this.traceFilePath = path.join(this.traceDir, `issue-${issueNumber}.json`);

    // Ensure trace directory exists
    if (!fs.existsSync(this.traceDir)) {
      fs.mkdirSync(this.traceDir, { recursive: true });
    }

    // Load existing trace or create new one
    if (fs.existsSync(this.traceFilePath)) {
      this.trace = this.loadTrace();
      this.trace.metadata.sessionIds.push(this.sessionId);
    } else {
      this.trace = this.createNewTrace(issueNumber, issueTitle, issueUrl, deviceIdentifier);
    }
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Start tracking the Issue
   */
  public startTrace(): void {
    if (this.trace.stateTransitions.length === 0) {
      // First transition - pending state
      this.recordStateTransition('pending', 'pending', 'System', 'Issue created');
    }
    this.saveTrace();
  }

  /**
   * End tracking - mark Issue as completed
   */
  public endTrace(finalState: IssueState = 'done', reason?: string): void {
    this.trace.closedAt = new Date().toISOString();
    this.trace.currentState = finalState;

    if (this.trace.stateTransitions.length > 0) {
      const lastTransition = this.trace.stateTransitions[this.trace.stateTransitions.length - 1];
      this.recordStateTransition(lastTransition.to, finalState, 'System', reason);
    }

    this.calculateTotalDuration();
    this.saveTrace();
  }

  /**
   * Get current trace
   */
  public getTrace(): IssueTraceLog {
    return { ...this.trace };
  }

  // ============================================================================
  // State Transition Tracking
  // ============================================================================

  /**
   * Record state transition
   */
  public recordStateTransition(
    from: IssueState,
    to: IssueState,
    triggeredBy: string,
    reason?: string
  ): void {
    const transition: StateTransition = {
      from,
      to,
      timestamp: new Date().toISOString(),
      triggeredBy,
      reason,
    };

    this.trace.stateTransitions.push(transition);
    this.trace.currentState = to;
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Agent Execution Tracking
  // ============================================================================

  /**
   * Start agent execution
   */
  public startAgentExecution(agentType: AgentType, taskId?: string): void {
    const execution: AgentExecution = {
      agentType,
      taskId,
      startTime: new Date().toISOString(),
      status: 'running',
    };

    this.activeAgentExecutions.set(agentType, execution);
    this.trace.agentExecutions.push(execution);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  /**
   * End agent execution
   */
  public endAgentExecution(
    agentType: AgentType,
    status: AgentStatus,
    result?: AgentResult,
    error?: string
  ): void {
    const execution = this.activeAgentExecutions.get(agentType);
    if (!execution) {
      throw new Error(`No active execution found for agent: ${agentType}`);
    }

    execution.endTime = new Date().toISOString();
    execution.status = status;
    execution.result = result;
    execution.error = error;

    // Calculate duration
    const startMs = new Date(execution.startTime).getTime();
    const endMs = new Date(execution.endTime).getTime();
    execution.durationMs = endMs - startMs;

    this.activeAgentExecutions.delete(agentType);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * Update task statistics
   */
  public updateTaskStats(total: number, completed: number, failed: number): void {
    this.trace.totalTasks = total;
    this.trace.completedTasks = completed;
    this.trace.failedTasks = failed;
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  /**
   * Increment completed tasks
   */
  public incrementCompletedTasks(): void {
    this.trace.completedTasks++;
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  /**
   * Increment failed tasks
   */
  public incrementFailedTasks(): void {
    this.trace.failedTasks++;
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Label Tracking
  // ============================================================================

  /**
   * Record label change
   */
  public recordLabelChange(
    action: 'added' | 'removed',
    label: string,
    performedBy: string
  ): void {
    const change: LabelChange = {
      timestamp: new Date().toISOString(),
      action,
      label,
      performedBy,
    };

    this.trace.labelChanges.push(change);

    // Update current labels
    if (action === 'added' && !this.trace.currentLabels.includes(label)) {
      this.trace.currentLabels.push(label);
    } else if (action === 'removed') {
      this.trace.currentLabels = this.trace.currentLabels.filter(l => l !== label);
    }

    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Quality Tracking
  // ============================================================================

  /**
   * Record quality report
   */
  public recordQualityReport(report: QualityReport): void {
    this.trace.qualityReports.push(report);

    // Update final quality score (latest report)
    this.trace.finalQualityScore = report.score;

    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // PR Tracking
  // ============================================================================

  /**
   * Record pull request
   */
  public recordPullRequest(pr: PRResult): void {
    this.trace.pullRequests.push(pr);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Deployment Tracking
  // ============================================================================

  /**
   * Record deployment
   */
  public recordDeployment(deployment: DeploymentResult): void {
    this.trace.deployments.push(deployment);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Escalation Tracking
  // ============================================================================

  /**
   * Record escalation
   */
  public recordEscalation(escalation: EscalationInfo): void {
    this.trace.escalations.push(escalation);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Notes & Annotations
  // ============================================================================

  /**
   * Add note
   */
  public addNote(author: string, content: string, tags?: string[]): void {
    const note: TraceNote = {
      timestamp: new Date().toISOString(),
      author,
      content,
      tags,
    };

    this.trace.notes.push(note);
    this.trace.metadata.lastUpdated = new Date().toISOString();
    this.saveTrace();
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Save trace to disk
   */
  public saveTrace(): void {
    try {
      const json = JSON.stringify(this.trace, null, 2);
      fs.writeFileSync(this.traceFilePath, json, 'utf-8');
    } catch (error) {
      console.error(`Failed to save trace log: ${error}`);
      throw error;
    }
  }

  /**
   * Load trace from disk
   */
  private loadTrace(): IssueTraceLog {
    try {
      const json = fs.readFileSync(this.traceFilePath, 'utf-8');
      return JSON.parse(json) as IssueTraceLog;
    } catch (error) {
      throw new Error(`Failed to load trace log: ${error}`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create new trace
   */
  private createNewTrace(
    issueNumber: number,
    issueTitle: string,
    issueUrl: string,
    deviceIdentifier: string
  ): IssueTraceLog {
    return {
      issueNumber,
      issueTitle,
      issueUrl,
      createdAt: new Date().toISOString(),
      currentState: 'pending',
      stateTransitions: [],
      agentExecutions: [],
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      labelChanges: [],
      currentLabels: [],
      qualityReports: [],
      pullRequests: [],
      deployments: [],
      escalations: [],
      notes: [],
      metadata: {
        deviceIdentifier,
        sessionIds: [this.sessionId],
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${new Date().toISOString()}`;
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(): void {
    if (!this.trace.closedAt) {
      return;
    }

    const startMs = new Date(this.trace.createdAt).getTime();
    const endMs = new Date(this.trace.closedAt).getTime();
    this.trace.metadata.totalDurationMs = endMs - startMs;
  }

  // ============================================================================
  // Static Methods
  // ============================================================================

  /**
   * Load existing trace log
   */
  public static load(issueNumber: number): IssueTraceLogger | null {
    const traceDir = path.resolve(__dirname, '../../.ai/trace-logs');
    const traceFilePath = path.join(traceDir, `issue-${issueNumber}.json`);

    if (!fs.existsSync(traceFilePath)) {
      return null;
    }

    try {
      const json = fs.readFileSync(traceFilePath, 'utf-8');
      const trace = JSON.parse(json) as IssueTraceLog;

      // Create logger instance from existing trace
      const logger = new IssueTraceLogger(
        trace.issueNumber,
        trace.issueTitle,
        trace.issueUrl,
        trace.metadata.deviceIdentifier
      );

      return logger;
    } catch (error) {
      console.error(`Failed to load trace log for issue ${issueNumber}: ${error}`);
      return null;
    }
  }

  /**
   * Get all trace logs
   */
  public static getAllTraces(): IssueTraceLog[] {
    const traceDir = path.resolve(__dirname, '../../.ai/trace-logs');

    if (!fs.existsSync(traceDir)) {
      return [];
    }

    const files = fs.readdirSync(traceDir);
    const traces: IssueTraceLog[] = [];

    for (const file of files) {
      if (file.startsWith('issue-') && file.endsWith('.json')) {
        try {
          const filePath = path.join(traceDir, file);
          const json = fs.readFileSync(filePath, 'utf-8');
          const trace = JSON.parse(json) as IssueTraceLog;
          traces.push(trace);
        } catch (error) {
          console.error(`Failed to load trace log ${file}: ${error}`);
        }
      }
    }

    return traces;
  }

  /**
   * Delete trace log
   */
  public static deleteTrace(issueNumber: number): boolean {
    const traceDir = path.resolve(__dirname, '../../.ai/trace-logs');
    const traceFilePath = path.join(traceDir, `issue-${issueNumber}.json`);

    if (!fs.existsSync(traceFilePath)) {
      return false;
    }

    try {
      fs.unlinkSync(traceFilePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete trace log for issue ${issueNumber}: ${error}`);
      return false;
    }
  }
}
