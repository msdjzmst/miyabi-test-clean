/**
 * InfiniteLoopOrchestrator - Infinite Feedback Loop Orchestrator
 *
 * Orchestrates the infinite feedback loop for continuous improvement
 */

import type {
  GoalDefinition,
  FeedbackLoop,
  IterationRecord,
  FeedbackRecord,
  ConsumptionReport,
  ConvergenceMetrics,
  GoalRefinement,
  ActualMetrics,
  Escalation,
} from '../types/index';
import { GoalManager } from './goal-manager';
import { ConsumptionValidator } from './consumption-validator';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Error Classes
// ============================================================================

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export interface InfiniteLoopConfig {
  maxIterations: number;
  convergenceThreshold: number; // Variance threshold for convergence
  minIterationsBeforeConvergence: number; // Minimum iterations before checking convergence
  autoRefinementEnabled: boolean;
  logsDirectory: string;
  autoSave: boolean;

  // Error handling configuration
  timeout?: number; // Timeout in milliseconds (default: 300000 = 5 minutes)
  maxRetries?: number; // Maximum retry attempts (default: 3)
  enableEscalation?: boolean; // Enable GitHub/Slack escalation (default: true)
  githubOwner?: string; // GitHub repository owner
  githubRepo?: string; // GitHub repository name
}

/**
 * InfiniteLoopOrchestrator - 無限フィードバックループオーケストレーター
 *
 * Goal-Oriented TDD + Consumption-Drivenの無限ループを制御
 * - イテレーション実行
 * - 収束判定
 * - 自動ゴール洗練化
 * - フィードバック生成
 */
export class InfiniteLoopOrchestrator {
  private config: InfiniteLoopConfig;
  private goalManager: GoalManager;
  private consumptionValidator: ConsumptionValidator;
  private activeLoops: Map<string, FeedbackLoop> = new Map();

  constructor(
    config: InfiniteLoopConfig,
    goalManager: GoalManager,
    consumptionValidator: ConsumptionValidator
  ) {
    this.config = config;
    this.goalManager = goalManager;
    this.consumptionValidator = consumptionValidator;
    this.ensureLogsDirectory();
  }

  /**
   * Start infinite feedback loop for a goal
   */
  async startLoop(goalId: string): Promise<FeedbackLoop> {
    const goal = this.goalManager.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const loopId = this.generateLoopId(goalId);
    const feedbackLoop: FeedbackLoop = {
      loopId,
      goalId,
      iteration: 0,
      maxIterations: this.config.maxIterations,
      startTime: new Date().toISOString(),
      lastIterationTime: new Date().toISOString(),
      status: 'running',
      iterations: [],
      convergenceMetrics: {
        scoreHistory: [],
        scoreVariance: 0,
        improvementRate: 0,
        isConverging: false,
      },
      autoRefinementEnabled: this.config.autoRefinementEnabled,
      refinementHistory: [],
    };

    this.activeLoops.set(loopId, feedbackLoop);

    if (this.config.autoSave) {
      this.saveLoop(feedbackLoop);
    }

    return feedbackLoop;
  }

  /**
   * Execute one iteration of the feedback loop (with error handling)
   */
  async executeIteration(
    loopId: string,
    sessionId: string,
    actualMetrics: ActualMetrics
  ): Promise<IterationRecord> {
    const loop = this.activeLoops.get(loopId);
    if (!loop) {
      throw new Error(`Loop not found: ${loopId}`);
    }

    const timeout = this.config.timeout || 300000; // 5 minutes default
    const maxRetries = this.config.maxRetries || 3;

    try {
      // Execute with timeout
      return await Promise.race([
        this.executeIterationInternal(loopId, sessionId, actualMetrics),
        this.createTimeout(timeout, sessionId),
      ]);
    } catch (error: any) {
      // Handle timeout
      if (error instanceof TimeoutError) {
        console.error(`⏱️  Iteration timeout: ${sessionId} (${timeout}ms)`);
        loop.status = 'escalated';
        this.activeLoops.set(loopId, loop);

        // Escalate
        if (this.config.enableEscalation !== false) {
          await this.escalate({
            loopId,
            reason: 'Iteration timeout',
            escalationLevel: 'TechLead',
            severity: 'high',
            context: {
              sessionId,
              iteration: loop.iteration,
              timeout,
            },
          });
        }

        throw error;
      }

      // Handle network/retryable errors
      if (error instanceof NetworkError || error instanceof RetryableError) {
        console.error(`🌐 Retryable error: ${error.message}`);

        // Retry with exponential backoff
        return await this.retryWithBackoff(
          () => this.executeIterationInternal(loopId, sessionId, actualMetrics),
          maxRetries,
          sessionId
        );
      }

      // Handle unexpected errors
      console.error(`❌ Unexpected error in iteration:`, error);
      loop.status = 'diverged';
      this.activeLoops.set(loopId, loop);

      // Escalate critical errors
      if (this.config.enableEscalation !== false) {
        await this.escalate({
          loopId,
          reason: `Unexpected error: ${error.message}`,
          escalationLevel: 'TechLead',
          severity: 'critical',
          context: {
            sessionId,
            iteration: loop.iteration,
            errorStack: error.stack,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Execute one iteration of the feedback loop (internal implementation)
   */
  private async executeIterationInternal(
    loopId: string,
    sessionId: string,
    actualMetrics: ActualMetrics
  ): Promise<IterationRecord> {
    const loop = this.activeLoops.get(loopId);
    if (!loop) {
      throw new Error(`Loop not found: ${loopId}`);
    }

    if (loop.status !== 'running') {
      throw new Error(`Loop is not running: ${loop.status}`);
    }

    const startTime = Date.now();

    // Get current goal
    const goal = this.goalManager.getGoal(loop.goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${loop.goalId}`);
    }

    // Validate against goal
    const consumptionReport = this.consumptionValidator.validate(
      goal,
      actualMetrics,
      sessionId
    );

    // Generate feedback
    const feedback = this.generateFeedback(consumptionReport, goal);

    // Calculate score improvement
    const previousScore =
      loop.iterations.length > 0
        ? loop.iterations[loop.iterations.length - 1].consumptionReport.overallScore
        : 0;
    const scoreImprovement = consumptionReport.overallScore - previousScore;

    // Create iteration record
    const iteration: IterationRecord = {
      iteration: loop.iteration + 1,
      timestamp: new Date().toISOString(),
      goalDefinition: goal,
      consumptionReport,
      feedback,
      durationMs: Date.now() - startTime,
      scoreImprovement,
    };

    // Update loop
    loop.iteration++;
    loop.lastIterationTime = iteration.timestamp;
    loop.iterations.push(iteration);

    // Update convergence metrics
    loop.convergenceMetrics = this.updateConvergenceMetrics(loop);

    // Check loop status
    loop.status = this.determineLoopStatus(loop, consumptionReport);

    // Auto-refinement
    if (
      loop.autoRefinementEnabled &&
      this.shouldRefineGoal(loop, consumptionReport)
    ) {
      const refinement = this.refineGoal(loop, consumptionReport);
      loop.refinementHistory.push(refinement);
    }

    this.activeLoops.set(loopId, loop);

    if (this.config.autoSave) {
      this.saveLoop(loop);
      this.saveIteration(iteration, loopId);
    }

    return iteration;
  }

  /**
   * Get loop status
   */
  getLoop(loopId: string): FeedbackLoop | undefined {
    return this.activeLoops.get(loopId);
  }

  /**
   * Stop a running loop
   */
  stopLoop(loopId: string): void {
    const loop = this.activeLoops.get(loopId);
    if (loop && loop.status === 'running') {
      loop.status = 'max_iterations_reached';
      this.activeLoops.set(loopId, loop);

      if (this.config.autoSave) {
        this.saveLoop(loop);
      }
    }
  }

  /**
   * Check if loop should continue
   */
  shouldContinue(loopId: string): boolean {
    const loop = this.activeLoops.get(loopId);
    if (!loop) {
      return false;
    }

    return (
      loop.status === 'running' &&
      loop.iteration < loop.maxIterations &&
      !loop.convergenceMetrics.isConverging
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateFeedback(
    report: ConsumptionReport,
    _goal: GoalDefinition
  ): FeedbackRecord {
    const timestamp = new Date().toISOString();

    // Determine feedback type
    let type: 'positive' | 'constructive' | 'corrective' | 'escalation';
    if (report.goalAchieved) {
      type = 'positive';
    } else if (report.overallScore >= 70) {
      type = 'constructive';
    } else if (report.overallScore >= 50) {
      type = 'corrective';
    } else {
      type = 'escalation';
    }

    // Generate summary
    const summary = this.generateFeedbackSummary(report, type);

    // Generate details
    const details = this.generateFeedbackDetails(report);

    // Extract code examples from validation results
    const codeExamples = this.extractCodeExamples(report);

    const feedback: FeedbackRecord = {
      timestamp,
      type,
      score: report.overallScore,
      summary,
      details,
      codeExamples,
      actionItems: report.nextActions,
      references: this.generateReferences(report),
    };

    return feedback;
  }

  private generateFeedbackSummary(
    report: ConsumptionReport,
    type: string
  ): string {
    if (type === 'positive') {
      return `🎉 Goal achieved! Score: ${report.overallScore}/100. All criteria met.`;
    } else if (type === 'constructive') {
      return `👍 Good progress! Score: ${report.overallScore}/100. ${report.gaps.length} gap(s) remaining.`;
    } else if (type === 'corrective') {
      return `⚠️  Needs improvement. Score: ${report.overallScore}/100. Focus on ${report.gaps.filter((g: import('../types/index.js').GapAnalysis) => g.severity === 'critical' || g.severity === 'high').length} high-priority gap(s).`;
    } else {
      return `🚨 Critical issues detected. Score: ${report.overallScore}/100. Immediate action required.`;
    }
  }

  private generateFeedbackDetails(report: ConsumptionReport): string[] {
    const details: string[] = [];

    // Failed validations
    const failures = report.validationResults.filter((v: import('../types/index.js').ValidationResult) => !v.passed);
    if (failures.length > 0) {
      details.push(`Failed ${failures.length} criterion/criteria:`);
      for (const failure of failures) {
        details.push(`  - ${failure.feedback}`);
      }
    }

    // Gaps
    if (report.gaps.length > 0) {
      details.push(`Gap Analysis:`);
      for (const gap of report.gaps) {
        details.push(
          `  - ${gap.metric}: Gap of ${gap.gap.toFixed(1)} (${gap.gapPercentage.toFixed(1)}%) - ${gap.severity}`
        );
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      details.push(`Recommendations:`);
      for (const rec of report.recommendations) {
        details.push(`  - ${rec}`);
      }
    }

    return details;
  }

  private extractCodeExamples(report: ConsumptionReport): Array<{
    issue: string;
    current: string;
    suggested: string;
  }> {
    const examples: Array<{ issue: string; current: string; suggested: string }> = [];

    // Extract examples from gaps
    for (const gap of report.gaps) {
      if (gap.metric === 'ESLint Errors' || gap.metric === 'TypeScript Errors') {
        examples.push({
          issue: `${gap.metric}: ${gap.actual} error(s)`,
          current: `Current: ${gap.actual} error(s)`,
          suggested: `Target: ${gap.expected} error(s) - Run linter and fix errors`,
        });
      }
    }

    return examples;
  }

  private generateReferences(report: ConsumptionReport): string[] {
    const references: string[] = [];

    // Add relevant documentation based on gaps
    for (const gap of report.gaps) {
      if (gap.metric === 'Test Coverage') {
        references.push('https://vitest.dev/guide/coverage.html');
      }
      if (gap.metric === 'ESLint Errors') {
        references.push('https://eslint.org/docs/latest/rules/');
      }
      if (gap.metric === 'TypeScript Errors') {
        references.push('https://www.typescriptlang.org/docs/handbook/intro.html');
      }
      if (gap.metric === 'Security Issues') {
        references.push('https://docs.npmjs.com/cli/v8/commands/npm-audit');
      }
    }

    return Array.from(new Set(references)); // Remove duplicates
  }

  private updateConvergenceMetrics(loop: FeedbackLoop): ConvergenceMetrics {
    const scoreHistory = loop.iterations.map((it: IterationRecord) => it.consumptionReport.overallScore);

    // Calculate variance
    const mean = scoreHistory.reduce((sum: number, s: number) => sum + s, 0) / scoreHistory.length;
    const variance =
      scoreHistory.reduce((sum: number, s: number) => sum + Math.pow(s - mean, 2), 0) /
      scoreHistory.length;

    // Calculate improvement rate
    let improvementRate = 0;
    if (scoreHistory.length >= 2) {
      const recentScores = scoreHistory.slice(-5); // Last 5 iterations
      improvementRate =
        (recentScores[recentScores.length - 1] - recentScores[0]) / recentScores.length;
    }

    // Check convergence
    const isConverging =
      loop.iteration >= this.config.minIterationsBeforeConvergence &&
      variance < this.config.convergenceThreshold &&
      improvementRate < 0.5; // Less than 0.5 points per iteration

    // Estimate iterations to converge
    let estimatedIterationsToConverge: number | undefined;
    if (!isConverging && improvementRate > 0) {
      const currentScore = scoreHistory[scoreHistory.length - 1];
      const targetScore = 90; // Assuming 90+ is convergence
      const remaining = targetScore - currentScore;
      estimatedIterationsToConverge = Math.ceil(remaining / improvementRate);
    }

    return {
      scoreHistory,
      scoreVariance: variance,
      improvementRate,
      isConverging,
      estimatedIterationsToConverge,
    };
  }

  private determineLoopStatus(
    loop: FeedbackLoop,
    report: ConsumptionReport
  ): FeedbackLoop['status'] {
    // Check max iterations
    if (loop.iteration >= loop.maxIterations) {
      return 'max_iterations_reached';
    }

    // Check convergence
    if (loop.convergenceMetrics.isConverging && report.goalAchieved) {
      return 'converged';
    }

    // Check divergence (score decreasing over time)
    if (
      loop.iteration >= this.config.minIterationsBeforeConvergence &&
      loop.convergenceMetrics.improvementRate < -1
    ) {
      return 'diverged';
    }

    // Check escalation
    if (report.overallScore < 40 && loop.iteration >= 5) {
      return 'escalated';
    }

    return 'running';
  }

  private shouldRefineGoal(
    loop: FeedbackLoop,
    report: ConsumptionReport
  ): boolean {
    // Don't refine too early
    if (loop.iteration < 3) {
      return false;
    }

    // Don't refine if already converged
    if (loop.convergenceMetrics.isConverging) {
      return false;
    }

    // Refine if diverging
    if (loop.status === 'diverged') {
      return true;
    }

    // Refine if score is stagnant (variance very low but not achieving goal)
    if (
      !report.goalAchieved &&
      loop.convergenceMetrics.scoreVariance < 5 &&
      loop.iteration >= 5
    ) {
      return true;
    }

    return false;
  }

  private refineGoal(
    loop: FeedbackLoop,
    report: ConsumptionReport
  ): GoalRefinement {
    const goal = this.goalManager.getGoal(loop.goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${loop.goalId}`);
    }

    const refinedGoal = { ...goal };
    const changes: Array<{
      field: string;
      before: any;
      after: any;
      reason: string;
    }> = [];

    // Adjust thresholds based on actual performance
    if (report.overallScore < 70) {
      // Lower quality score threshold by 10%
      const before = refinedGoal.successCriteria.minQualityScore;
      const after = Math.max(50, before - 10);
      refinedGoal.successCriteria.minQualityScore = after;
      changes.push({
        field: 'successCriteria.minQualityScore',
        before,
        after,
        reason: 'Adjusted to be more achievable based on current performance',
      });
    }

    // Update goal in manager
    this.goalManager.updateGoalProgress(loop.goalId, {
      feedbackRecord: loop.iterations[loop.iterations.length - 1].feedback,
    });

    const refinement: GoalRefinement = {
      timestamp: new Date().toISOString(),
      reason: 'Auto-refinement triggered due to stagnation/divergence',
      originalGoal: goal,
      refinedGoal,
      changes,
      expectedImpact: 'Increased achievability while maintaining quality standards',
    };

    return refinement;
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.config.logsDirectory)) {
      fs.mkdirSync(this.config.logsDirectory, { recursive: true });
    }
  }

  private generateLoopId(goalId: string): string {
    return `loop-${goalId}-${Date.now()}`;
  }

  private saveLoop(loop: FeedbackLoop): void {
    const filePath = path.join(this.config.logsDirectory, `${loop.loopId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(loop, null, 2), 'utf-8');
  }

  private saveIteration(iteration: IterationRecord, loopId: string): void {
    const filename = `iteration-${loopId}-${iteration.iteration}.json`;
    const filePath = path.join(this.config.logsDirectory, filename);
    fs.writeFileSync(filePath, JSON.stringify(iteration, null, 2), 'utf-8');
  }

  // ============================================================================
  // Error Handling Methods
  // ============================================================================

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  private createTimeout(ms: number, sessionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Iteration timeout after ${ms}ms for session ${sessionId}`));
      }, ms);
    });
  }

  /**
   * Retry function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    context: string
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        // Don't retry on last attempt
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Don't retry on non-retryable errors
        if (!(error instanceof NetworkError || error instanceof RetryableError)) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, ...
        console.log(
          `🔄 Retry attempt ${attempt + 1}/${maxRetries} for ${context} after ${delay}ms`
        );

        await this.sleep(delay);
      }
    }

    throw new Error(`Max retries (${maxRetries}) exceeded for ${context}`);
  }

  /**
   * Escalate error to GitHub Issues and/or Slack
   */
  private async escalate(escalation: Escalation): Promise<void> {
    console.log(`🚨 Escalating: ${escalation.reason}`);

    // Escalate to GitHub Issues
    if (process.env.GITHUB_TOKEN && this.config.githubOwner && this.config.githubRepo) {
      try {
        await this.escalateToGitHub(escalation);
      } catch (error: any) {
        console.error(`Failed to escalate to GitHub:`, error.message);
      }
    }

    // Escalate to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await this.escalateToSlack(escalation);
      } catch (error: any) {
        console.error(`Failed to escalate to Slack:`, error.message);
      }
    }
  }

  /**
   * Create GitHub Issue comment for escalation
   */
  private async escalateToGitHub(escalation: Escalation): Promise<void> {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const issueNumber = escalation.context.issueNumber;
    if (!issueNumber) {
      console.warn('⚠️  No issue number in context, skipping GitHub escalation');
      return;
    }

    const body = `
## 🚨 Escalation: ${escalation.reason}

**Level**: ${escalation.escalationLevel}
**Severity**: ${escalation.severity}
**Loop ID**: ${escalation.loopId}
**Session ID**: ${escalation.context.sessionId}
**Iteration**: ${escalation.context.iteration}

### Context
\`\`\`json
${JSON.stringify(escalation.context, null, 2)}
\`\`\`

### Recommended Actions
- Review the feedback loop logs in \`${this.config.logsDirectory}\`
- Check session metrics and identify bottlenecks
- Consider adjusting goal criteria or implementation approach

Please investigate and provide guidance.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
    `.trim();

    await octokit.issues.createComment({
      owner: this.config.githubOwner!,
      repo: this.config.githubRepo!,
      issue_number: issueNumber,
      body,
    });

    console.log(`✅ Escalation posted to GitHub Issue #${issueNumber}`);
  }

  /**
   * Send escalation notification to Slack
   */
  private async escalateToSlack(escalation: Escalation): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL!;

    const severityEmojiMap: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };
    const severityEmoji = severityEmojiMap[escalation.severity] || '⚪';

    const payload = {
      text: `${severityEmoji} Escalation: ${escalation.reason}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Escalation: ${escalation.reason}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Level:*\n${escalation.escalationLevel}`,
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${escalation.severity}`,
            },
            {
              type: 'mrkdwn',
              text: `*Loop ID:*\n${escalation.loopId}`,
            },
            {
              type: 'mrkdwn',
              text: `*Iteration:*\n${escalation.context.iteration}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Session:* ${escalation.context.sessionId}`,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`✅ Escalation sent to Slack`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
