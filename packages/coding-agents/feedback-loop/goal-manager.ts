/**
 * GoalManager - Goal-Oriented TDD Goal Management
 *
 * Manages goal definitions, tracks progress, and facilitates goal-based testing
 */

import type {
  GoalDefinition,
  SuccessCriteria,
  TestSpecification,
  MetricsThreshold,
  FeedbackRecord,
} from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

export interface GoalManagerConfig {
  goalsDirectory: string;
  autoSave: boolean;
}

/**
 * GoalManager - テストゴール定義・管理システム
 *
 * Goal-Oriented TDDの中核を担うクラス
 * - ゴール定義の作成・保存・読み込み
 * - ゴールの進捗追跡
 * - テスト仕様の管理
 */
export class GoalManager {
  private goals: Map<string, GoalDefinition> = new Map();
  private config: GoalManagerConfig;

  constructor(config: GoalManagerConfig) {
    this.config = config;
    this.ensureGoalsDirectory();
    this.loadGoals();
  }

  /**
   * Create a new goal definition
   */
  createGoal(params: {
    title: string;
    description: string;
    successCriteria: SuccessCriteria;
    testSpecs: TestSpecification[];
    acceptanceCriteria: string[];
    priority?: number;
    deadline?: string;
    issueNumber?: number;
    taskId?: string;
  }): GoalDefinition {
    const id = this.generateGoalId(params.title);

    const goal: GoalDefinition = {
      id,
      title: params.title,
      description: params.description,
      successCriteria: params.successCriteria,
      testSpecs: params.testSpecs,
      acceptanceCriteria: params.acceptanceCriteria,
      metricsThresholds: this.deriveMetricsThresholds(params.successCriteria),
      priority: params.priority ?? 1,
      deadline: params.deadline,
      context: {
        issueNumber: params.issueNumber,
        taskId: params.taskId,
        previousAttempts: 0,
        feedbackHistory: [],
      },
    };

    this.goals.set(id, goal);

    if (this.config.autoSave) {
      this.saveGoal(goal);
    }

    return goal;
  }

  /**
   * Get goal by ID
   */
  getGoal(id: string): GoalDefinition | undefined {
    return this.goals.get(id);
  }

  /**
   * Get all goals
   */
  getAllGoals(): GoalDefinition[] {
    return Array.from(this.goals.values());
  }

  /**
   * Get goals by issue number
   */
  getGoalsByIssue(issueNumber: number): GoalDefinition[] {
    return Array.from(this.goals.values()).filter(
      (goal) => goal.context.issueNumber === issueNumber
    );
  }

  /**
   * Get goals by task ID
   */
  getGoalsByTask(taskId: string): GoalDefinition[] {
    return Array.from(this.goals.values()).filter(
      (goal) => goal.context.taskId === taskId
    );
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(
    goalId: string,
    updates: {
      testSpecs?: TestSpecification[];
      feedbackRecord?: FeedbackRecord;
      previousAttempts?: number;
    }
  ): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (updates.testSpecs) {
      goal.testSpecs = updates.testSpecs;
    }

    if (updates.feedbackRecord) {
      goal.context.feedbackHistory.push(updates.feedbackRecord);
    }

    if (updates.previousAttempts !== undefined) {
      goal.context.previousAttempts = updates.previousAttempts;
    }

    this.goals.set(goalId, goal);

    if (this.config.autoSave) {
      this.saveGoal(goal);
    }
  }

  /**
   * Check if goal is achieved
   */
  isGoalAchieved(goalId: string, actualMetrics: {
    qualityScore: number;
    eslintErrors: number;
    typeScriptErrors: number;
    securityIssues: number;
    testCoverage: number;
    testsPassed: number;
  }): boolean {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return false;
    }

    const criteria = goal.successCriteria;

    return (
      actualMetrics.qualityScore >= criteria.minQualityScore &&
      actualMetrics.eslintErrors <= criteria.maxEslintErrors &&
      actualMetrics.typeScriptErrors <= criteria.maxTypeScriptErrors &&
      actualMetrics.securityIssues <= criteria.maxSecurityIssues &&
      actualMetrics.testCoverage >= criteria.minTestCoverage &&
      actualMetrics.testsPassed >= criteria.minTestsPassed
    );
  }

  /**
   * Get goal achievement status
   */
  getGoalStatus(goalId: string): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    pendingTests: number;
    progress: number;
  } {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const totalTests = goal.testSpecs.length;
    const passedTests = goal.testSpecs.filter((t: TestSpecification) => t.status === 'passed').length;
    const failedTests = goal.testSpecs.filter((t: TestSpecification) => t.status === 'failed').length;
    const pendingTests = goal.testSpecs.filter((t: TestSpecification) => t.status === 'pending').length;

    const progress = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      pendingTests,
      progress,
    };
  }

  /**
   * Delete goal
   */
  deleteGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      this.goals.delete(goalId);
      const filePath = path.join(this.config.goalsDirectory, `${goalId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureGoalsDirectory(): void {
    if (!fs.existsSync(this.config.goalsDirectory)) {
      fs.mkdirSync(this.config.goalsDirectory, { recursive: true });
    }
  }

  private loadGoals(): void {
    if (!fs.existsSync(this.config.goalsDirectory)) {
      return;
    }

    const files = fs.readdirSync(this.config.goalsDirectory);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.config.goalsDirectory, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const goal = JSON.parse(content) as GoalDefinition;
        this.goals.set(goal.id, goal);
      }
    }
  }

  private saveGoal(goal: GoalDefinition): void {
    const filePath = path.join(this.config.goalsDirectory, `${goal.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(goal, null, 2), 'utf-8');
  }

  private generateGoalId(title: string): string {
    const timestamp = Date.now();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `goal-${slug}-${timestamp}`;
  }

  private deriveMetricsThresholds(criteria: SuccessCriteria): MetricsThreshold {
    return {
      qualityScore: criteria.minQualityScore,
      testCoverage: criteria.minTestCoverage,
      buildTime: criteria.maxBuildTimeMs ?? 30000,
      codeSize: 10000, // Default: 10K lines
      cyclomaticComplexity: 10, // Default: max complexity 10
    };
  }
}
