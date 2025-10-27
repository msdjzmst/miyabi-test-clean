/**
 * IssueTraceLogger Tests
 *
 * Unit tests for complete Issue lifecycle tracking.
 * Target: 80%+ code coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IssueTraceLogger } from '../issue-trace-logger';
import type { IssueState, QualityReport, PRResult, DeploymentResult, EscalationInfo } from '../../types/index';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TRACE_DIR = path.resolve(__dirname, '../../../.ai/trace-logs');
const TEST_ISSUE_NUMBER = 99999;
const TEST_DEVICE = 'test-device';

describe('IssueTraceLogger', () => {
  let logger: IssueTraceLogger;

  beforeEach(() => {
    // Ensure trace directory exists
    if (!fs.existsSync(TEST_TRACE_DIR)) {
      fs.mkdirSync(TEST_TRACE_DIR, { recursive: true });
    }

    logger = new IssueTraceLogger(
      TEST_ISSUE_NUMBER,
      'Test Issue',
      'https://github.com/test/repo/issues/99999',
      TEST_DEVICE
    );
  });

  afterEach(() => {
    // Clean up test trace log
    IssueTraceLogger.deleteTrace(TEST_ISSUE_NUMBER);
  });

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  describe('Lifecycle Management', () => {
    it('should create new trace log', () => {
      const trace = logger.getTrace();

      expect(trace.issueNumber).toBe(TEST_ISSUE_NUMBER);
      expect(trace.issueTitle).toBe('Test Issue');
      expect(trace.issueUrl).toBe('https://github.com/test/repo/issues/99999');
      expect(trace.currentState).toBe('pending');
      expect(trace.metadata.deviceIdentifier).toBe(TEST_DEVICE);
      expect(trace.metadata.sessionIds.length).toBeGreaterThan(0);
    });

    it('should start trace', () => {
      logger.startTrace();
      const trace = logger.getTrace();

      expect(trace.stateTransitions.length).toBeGreaterThan(0);
      expect(trace.stateTransitions[0].from).toBe('pending');
      expect(trace.stateTransitions[0].to).toBe('pending');
    });

    it('should end trace with final state', () => {
      logger.startTrace();
      logger.endTrace('done', 'All tasks completed');

      const trace = logger.getTrace();

      expect(trace.closedAt).toBeDefined();
      expect(trace.currentState).toBe('done');
      expect(trace.metadata.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should persist trace to file', () => {
      logger.startTrace();
      logger.saveTrace();

      const traceFilePath = path.join(TEST_TRACE_DIR, `issue-${TEST_ISSUE_NUMBER}.json`);
      expect(fs.existsSync(traceFilePath)).toBe(true);
    });

    it('should load existing trace', () => {
      logger.startTrace();
      logger.recordStateTransition('pending', 'analyzing', 'System', 'Starting analysis');
      logger.saveTrace();

      const loaded = IssueTraceLogger.load(TEST_ISSUE_NUMBER);
      expect(loaded).not.toBeNull();

      if (loaded) {
        const trace = loaded.getTrace();
        expect(trace.issueNumber).toBe(TEST_ISSUE_NUMBER);
        expect(trace.stateTransitions.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // State Transition Tracking
  // ============================================================================

  describe('State Transition Tracking', () => {
    it('should record state transition', () => {
      logger.recordStateTransition('pending', 'analyzing', 'CoordinatorAgent', 'Starting decomposition');

      const trace = logger.getTrace();

      expect(trace.stateTransitions.length).toBe(1);
      expect(trace.stateTransitions[0].from).toBe('pending');
      expect(trace.stateTransitions[0].to).toBe('analyzing');
      expect(trace.stateTransitions[0].triggeredBy).toBe('CoordinatorAgent');
      expect(trace.stateTransitions[0].reason).toBe('Starting decomposition');
      expect(trace.currentState).toBe('analyzing');
    });

    it('should track complete state flow', () => {
      const states: Array<{ from: IssueState; to: IssueState }> = [
        { from: 'pending', to: 'analyzing' },
        { from: 'analyzing', to: 'implementing' },
        { from: 'implementing', to: 'reviewing' },
        { from: 'reviewing', to: 'deploying' },
        { from: 'deploying', to: 'done' },
      ];

      states.forEach(({ from, to }) => {
        logger.recordStateTransition(from, to, 'System');
      });

      const trace = logger.getTrace();

      expect(trace.stateTransitions.length).toBe(5);
      expect(trace.currentState).toBe('done');
    });
  });

  // ============================================================================
  // Agent Execution Tracking
  // ============================================================================

  describe('Agent Execution Tracking', () => {
    it('should start agent execution', () => {
      logger.startAgentExecution('CodeGenAgent', 'task-123');

      const trace = logger.getTrace();

      expect(trace.agentExecutions.length).toBe(1);
      expect(trace.agentExecutions[0].agentType).toBe('CodeGenAgent');
      expect(trace.agentExecutions[0].taskId).toBe('task-123');
      expect(trace.agentExecutions[0].status).toBe('running');
    });

    it('should end agent execution', () => {
      logger.startAgentExecution('CodeGenAgent', 'task-123');
      logger.endAgentExecution('CodeGenAgent', 'completed', {
        status: 'success',
        data: { message: 'Task completed' },
      });

      const trace = logger.getTrace();

      expect(trace.agentExecutions[0].status).toBe('completed');
      expect(trace.agentExecutions[0].endTime).toBeDefined();
      expect(trace.agentExecutions[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when ending non-existent execution', () => {
      expect(() => {
        logger.endAgentExecution('CodeGenAgent', 'completed');
      }).toThrow('No active execution found for agent: CodeGenAgent');
    });

    it('should track multiple agent executions', () => {
      logger.startAgentExecution('CodeGenAgent', 'task-1');
      logger.endAgentExecution('CodeGenAgent', 'completed');

      logger.startAgentExecution('ReviewAgent', 'task-2');
      logger.endAgentExecution('ReviewAgent', 'completed');

      const trace = logger.getTrace();

      expect(trace.agentExecutions.length).toBe(2);
      expect(trace.agentExecutions[0].agentType).toBe('CodeGenAgent');
      expect(trace.agentExecutions[1].agentType).toBe('ReviewAgent');
    });
  });

  // ============================================================================
  // Task Management
  // ============================================================================

  describe('Task Management', () => {
    it('should update task statistics', () => {
      logger.updateTaskStats(10, 5, 2);

      const trace = logger.getTrace();

      expect(trace.totalTasks).toBe(10);
      expect(trace.completedTasks).toBe(5);
      expect(trace.failedTasks).toBe(2);
    });

    it('should increment completed tasks', () => {
      logger.updateTaskStats(10, 0, 0);

      logger.incrementCompletedTasks();
      logger.incrementCompletedTasks();
      logger.incrementCompletedTasks();

      const trace = logger.getTrace();

      expect(trace.completedTasks).toBe(3);
    });

    it('should increment failed tasks', () => {
      logger.updateTaskStats(10, 0, 0);

      logger.incrementFailedTasks();
      logger.incrementFailedTasks();

      const trace = logger.getTrace();

      expect(trace.failedTasks).toBe(2);
    });
  });

  // ============================================================================
  // Label Tracking
  // ============================================================================

  describe('Label Tracking', () => {
    it('should record label added', () => {
      logger.recordLabelChange('added', 'bug', 'IssueAgent');

      const trace = logger.getTrace();

      expect(trace.labelChanges.length).toBe(1);
      expect(trace.labelChanges[0].action).toBe('added');
      expect(trace.labelChanges[0].label).toBe('bug');
      expect(trace.currentLabels).toContain('bug');
    });

    it('should record label removed', () => {
      logger.recordLabelChange('added', 'bug', 'IssueAgent');
      logger.recordLabelChange('removed', 'bug', 'User');

      const trace = logger.getTrace();

      expect(trace.labelChanges.length).toBe(2);
      expect(trace.currentLabels).not.toContain('bug');
    });

    it('should not duplicate labels when adding same label twice', () => {
      logger.recordLabelChange('added', 'bug', 'IssueAgent');
      logger.recordLabelChange('added', 'bug', 'IssueAgent');

      const trace = logger.getTrace();

      expect(trace.currentLabels.filter(l => l === 'bug').length).toBe(1);
    });
  });

  // ============================================================================
  // Quality Tracking
  // ============================================================================

  describe('Quality Tracking', () => {
    it('should record quality report', () => {
      const report: QualityReport = {
        score: 85,
        passed: true,
        issues: [],
        recommendations: ['Consider adding more tests'],
        breakdown: {
          eslintScore: 90,
          typeScriptScore: 85,
          securityScore: 80,
          testCoverageScore: 85,
        },
      };

      logger.recordQualityReport(report);

      const trace = logger.getTrace();

      expect(trace.qualityReports.length).toBe(1);
      expect(trace.finalQualityScore).toBe(85);
    });

    it('should update final quality score with latest report', () => {
      const report1: QualityReport = {
        score: 70,
        passed: false,
        issues: [],
        recommendations: [],
        breakdown: {
          eslintScore: 70,
          typeScriptScore: 70,
          securityScore: 70,
          testCoverageScore: 70,
        },
      };

      const report2: QualityReport = {
        score: 90,
        passed: true,
        issues: [],
        recommendations: [],
        breakdown: {
          eslintScore: 90,
          typeScriptScore: 90,
          securityScore: 90,
          testCoverageScore: 90,
        },
      };

      logger.recordQualityReport(report1);
      logger.recordQualityReport(report2);

      const trace = logger.getTrace();

      expect(trace.finalQualityScore).toBe(90);
    });
  });

  // ============================================================================
  // PR Tracking
  // ============================================================================

  describe('PR Tracking', () => {
    it('should record pull request', () => {
      const pr: PRResult = {
        number: 123,
        url: 'https://github.com/test/repo/pull/123',
        state: 'open',
        createdAt: new Date().toISOString(),
      };

      logger.recordPullRequest(pr);

      const trace = logger.getTrace();

      expect(trace.pullRequests.length).toBe(1);
      expect(trace.pullRequests[0].number).toBe(123);
    });
  });

  // ============================================================================
  // Deployment Tracking
  // ============================================================================

  describe('Deployment Tracking', () => {
    it('should record deployment', () => {
      const deployment: DeploymentResult = {
        environment: 'staging',
        version: '1.0.0',
        projectId: 'test-project',
        deploymentUrl: 'https://test-staging.com',
        deployedAt: new Date().toISOString(),
        durationMs: 5000,
        status: 'success',
      };

      logger.recordDeployment(deployment);

      const trace = logger.getTrace();

      expect(trace.deployments.length).toBe(1);
      expect(trace.deployments[0].environment).toBe('staging');
    });
  });

  // ============================================================================
  // Escalation Tracking
  // ============================================================================

  describe('Escalation Tracking', () => {
    it('should record escalation', () => {
      const escalation: EscalationInfo = {
        reason: 'Security vulnerability detected',
        target: 'CISO',
        severity: 'Sev.1-Critical',
        context: { cve: 'CVE-2024-1234' },
        timestamp: new Date().toISOString(),
      };

      logger.recordEscalation(escalation);

      const trace = logger.getTrace();

      expect(trace.escalations.length).toBe(1);
      expect(trace.escalations[0].target).toBe('CISO');
    });
  });

  // ============================================================================
  // Notes & Annotations
  // ============================================================================

  describe('Notes & Annotations', () => {
    it('should add note', () => {
      logger.addNote('Developer', 'Manual intervention required', ['manual', 'blocked']);

      const trace = logger.getTrace();

      expect(trace.notes.length).toBe(1);
      expect(trace.notes[0].author).toBe('Developer');
      expect(trace.notes[0].content).toBe('Manual intervention required');
      expect(trace.notes[0].tags).toEqual(['manual', 'blocked']);
    });
  });

  // ============================================================================
  // Static Methods
  // ============================================================================

  describe('Static Methods', () => {
    it('should load existing trace', () => {
      logger.startTrace();
      logger.saveTrace();

      const loaded = IssueTraceLogger.load(TEST_ISSUE_NUMBER);

      expect(loaded).not.toBeNull();
      if (loaded) {
        const trace = loaded.getTrace();
        expect(trace.issueNumber).toBe(TEST_ISSUE_NUMBER);
      }
    });

    it('should return null for non-existent trace', () => {
      const loaded = IssueTraceLogger.load(88888);
      expect(loaded).toBeNull();
    });

    it('should get all traces', () => {
      logger.startTrace();
      logger.saveTrace();

      const traces = IssueTraceLogger.getAllTraces();

      expect(traces.length).toBeGreaterThan(0);
      expect(traces.some(t => t.issueNumber === TEST_ISSUE_NUMBER)).toBe(true);
    });

    it('should delete trace', () => {
      logger.startTrace();
      logger.saveTrace();

      const deleted = IssueTraceLogger.deleteTrace(TEST_ISSUE_NUMBER);

      expect(deleted).toBe(true);

      const traceFilePath = path.join(TEST_TRACE_DIR, `issue-${TEST_ISSUE_NUMBER}.json`);
      expect(fs.existsSync(traceFilePath)).toBe(false);
    });

    it('should return false when deleting non-existent trace', () => {
      const deleted = IssueTraceLogger.deleteTrace(88888);
      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should track complete Issue lifecycle', () => {
      // Start trace
      logger.startTrace();

      // Analyze
      logger.recordStateTransition('pending', 'analyzing', 'CoordinatorAgent', 'Starting analysis');
      logger.updateTaskStats(5, 0, 0);

      // Implement
      logger.recordStateTransition('analyzing', 'implementing', 'CoordinatorAgent', 'Starting implementation');
      logger.startAgentExecution('CodeGenAgent', 'task-1');
      logger.endAgentExecution('CodeGenAgent', 'completed');
      logger.incrementCompletedTasks();

      // Review
      logger.recordStateTransition('implementing', 'reviewing', 'ReviewAgent', 'Starting review');
      logger.recordQualityReport({
        score: 85,
        passed: true,
        issues: [],
        recommendations: [],
        breakdown: {
          eslintScore: 85,
          typeScriptScore: 85,
          securityScore: 85,
          testCoverageScore: 85,
        },
      });

      // Deploy
      logger.recordStateTransition('reviewing', 'deploying', 'DeploymentAgent', 'Starting deployment');
      logger.recordDeployment({
        environment: 'staging',
        version: '1.0.0',
        projectId: 'test-project',
        deploymentUrl: 'https://test-staging.com',
        deployedAt: new Date().toISOString(),
        durationMs: 5000,
        status: 'success',
      });

      // Done
      logger.recordStateTransition('deploying', 'done', 'System', 'Deployment successful');
      logger.endTrace('done', 'Issue completed successfully');

      const trace = logger.getTrace();

      // Verify complete lifecycle
      // Note: startTrace() creates initial pending→pending transition, plus 5 explicit transitions = 6 total
      expect(trace.stateTransitions.length).toBe(7);
      expect(trace.currentState).toBe('done');
      expect(trace.agentExecutions.length).toBe(1);
      expect(trace.qualityReports.length).toBe(1);
      expect(trace.deployments.length).toBe(1);
      expect(trace.completedTasks).toBe(1);
      expect(trace.closedAt).toBeDefined();
    });
  });
});
