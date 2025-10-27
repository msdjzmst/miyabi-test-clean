/**
 * ConsumptionValidator - Consumption-Driven Validation System
 *
 * Consumes execution results and validates them against goal definitions
 */

import type {
  GoalDefinition,
  ConsumptionReport,
  ValidationResult,
  ActualMetrics,
  GapAnalysis,
  NextAction,
  SuccessCriteria,
} from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

export interface ConsumptionValidatorConfig {
  reportsDirectory: string;
  autoSave: boolean;
  strictMode: boolean; // If true, all criteria must pass
}

/**
 * ConsumptionValidator - 成果消費・検証システム
 *
 * Consumption-Drivenの中核を担うクラス
 * - 実行結果を消費
 * - ゴールに対する達成度を評価
 * - ギャップ分析
 * - 次のアクション提案
 */
export class ConsumptionValidator {
  private config: ConsumptionValidatorConfig;
  private reports: Map<string, ConsumptionReport> = new Map();

  constructor(config: ConsumptionValidatorConfig) {
    this.config = config;
    this.ensureReportsDirectory();
  }

  /**
   * Validate execution results against goal
   */
  validate(
    goal: GoalDefinition,
    actualMetrics: ActualMetrics,
    sessionId: string
  ): ConsumptionReport {
    const timestamp = new Date().toISOString();

    // Validate each criterion
    const validationResults = this.validateCriteria(goal.successCriteria, actualMetrics);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(validationResults);

    // Check if goal is achieved
    const goalAchieved = this.isGoalAchieved(validationResults, overallScore, goal);

    // Perform gap analysis
    const gaps = this.analyzeGaps(goal.successCriteria, actualMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, validationResults);

    // Generate next actions
    const nextActions = this.generateNextActions(gaps, goal);

    const report: ConsumptionReport = {
      goalId: goal.id,
      sessionId,
      timestamp,
      validationResults,
      overallScore,
      goalAchieved,
      actualMetrics,
      gaps,
      recommendations,
      nextActions,
    };

    this.reports.set(`${goal.id}-${sessionId}`, report);

    if (this.config.autoSave) {
      this.saveReport(report);
    }

    return report;
  }

  /**
   * Get report by goal ID and session ID
   */
  getReport(goalId: string, sessionId: string): ConsumptionReport | undefined {
    return this.reports.get(`${goalId}-${sessionId}`);
  }

  /**
   * Get all reports for a goal
   */
  getReportsByGoal(goalId: string): ConsumptionReport[] {
    return Array.from(this.reports.values()).filter((r) => r.goalId === goalId);
  }

  /**
   * Get historical score trend
   */
  getScoreTrend(goalId: string): Array<{ timestamp: string; score: number }> {
    return this.getReportsByGoal(goalId)
      .map((r) => ({ timestamp: r.timestamp, score: r.overallScore }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateCriteria(
    criteria: SuccessCriteria,
    actual: ActualMetrics
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Quality Score
    results.push({
      criterion: 'Quality Score',
      expected: criteria.minQualityScore,
      actual: actual.qualityScore,
      passed: actual.qualityScore >= criteria.minQualityScore,
      scoreImpact: this.calculateScoreImpact(
        actual.qualityScore,
        criteria.minQualityScore,
        'gte'
      ),
      feedback: this.generateCriterionFeedback(
        'Quality Score',
        actual.qualityScore,
        criteria.minQualityScore,
        'gte'
      ),
    });

    // ESLint Errors
    results.push({
      criterion: 'ESLint Errors',
      expected: criteria.maxEslintErrors,
      actual: actual.eslintErrors,
      passed: actual.eslintErrors <= criteria.maxEslintErrors,
      scoreImpact: this.calculateScoreImpact(
        actual.eslintErrors,
        criteria.maxEslintErrors,
        'lte'
      ),
      feedback: this.generateCriterionFeedback(
        'ESLint Errors',
        actual.eslintErrors,
        criteria.maxEslintErrors,
        'lte'
      ),
    });

    // TypeScript Errors
    results.push({
      criterion: 'TypeScript Errors',
      expected: criteria.maxTypeScriptErrors,
      actual: actual.typeScriptErrors,
      passed: actual.typeScriptErrors <= criteria.maxTypeScriptErrors,
      scoreImpact: this.calculateScoreImpact(
        actual.typeScriptErrors,
        criteria.maxTypeScriptErrors,
        'lte'
      ),
      feedback: this.generateCriterionFeedback(
        'TypeScript Errors',
        actual.typeScriptErrors,
        criteria.maxTypeScriptErrors,
        'lte'
      ),
    });

    // Security Issues
    results.push({
      criterion: 'Security Issues',
      expected: criteria.maxSecurityIssues,
      actual: actual.securityIssues,
      passed: actual.securityIssues <= criteria.maxSecurityIssues,
      scoreImpact: this.calculateScoreImpact(
        actual.securityIssues,
        criteria.maxSecurityIssues,
        'lte'
      ),
      feedback: this.generateCriterionFeedback(
        'Security Issues',
        actual.securityIssues,
        criteria.maxSecurityIssues,
        'lte'
      ),
    });

    // Test Coverage
    results.push({
      criterion: 'Test Coverage',
      expected: criteria.minTestCoverage,
      actual: actual.testCoverage,
      passed: actual.testCoverage >= criteria.minTestCoverage,
      scoreImpact: this.calculateScoreImpact(
        actual.testCoverage,
        criteria.minTestCoverage,
        'gte'
      ),
      feedback: this.generateCriterionFeedback(
        'Test Coverage',
        actual.testCoverage,
        criteria.minTestCoverage,
        'gte'
      ),
    });

    // Tests Passed
    results.push({
      criterion: 'Tests Passed',
      expected: criteria.minTestsPassed,
      actual: actual.testsPassed,
      passed: actual.testsPassed >= criteria.minTestsPassed,
      scoreImpact: this.calculateScoreImpact(
        actual.testsPassed,
        criteria.minTestsPassed,
        'gte'
      ),
      feedback: this.generateCriterionFeedback(
        'Tests Passed',
        actual.testsPassed,
        criteria.minTestsPassed,
        'gte'
      ),
    });

    // Build Time (if specified)
    if (criteria.maxBuildTimeMs !== undefined) {
      results.push({
        criterion: 'Build Time',
        expected: criteria.maxBuildTimeMs,
        actual: actual.buildTimeMs,
        passed: actual.buildTimeMs <= criteria.maxBuildTimeMs,
        scoreImpact: this.calculateScoreImpact(
          actual.buildTimeMs,
          criteria.maxBuildTimeMs,
          'lte'
        ),
        feedback: this.generateCriterionFeedback(
          'Build Time',
          actual.buildTimeMs,
          criteria.maxBuildTimeMs,
          'lte'
        ),
      });
    }

    // Custom Metrics (if specified)
    if (criteria.customMetrics) {
      for (const customMetric of criteria.customMetrics) {
        const actualValue = actual.customMetrics?.[customMetric.name] ?? 0;
        const passed = this.evaluateCustomMetric(
          actualValue,
          customMetric.threshold,
          customMetric.operator
        );

        results.push({
          criterion: customMetric.name,
          expected: customMetric.threshold,
          actual: actualValue,
          passed,
          scoreImpact: passed ? 10 : -10,
          feedback: this.generateCriterionFeedback(
            customMetric.name,
            actualValue,
            customMetric.threshold,
            customMetric.operator
          ),
        });
      }
    }

    return results;
  }

  private calculateOverallScore(results: ValidationResult[]): number {
    const baseScore = 100;
    const totalImpact = results.reduce((sum, r) => sum + r.scoreImpact, 0);
    return Math.max(0, Math.min(100, baseScore + totalImpact));
  }

  private isGoalAchieved(
    results: ValidationResult[],
    overallScore: number,
    goal: GoalDefinition
  ): boolean {
    if (this.config.strictMode) {
      // All criteria must pass
      return results.every((r) => r.passed);
    } else {
      // Overall score must be >= threshold (default: 80)
      const threshold = goal.successCriteria.minQualityScore ?? 80;
      return overallScore >= threshold;
    }
  }

  private analyzeGaps(
    criteria: SuccessCriteria,
    actual: ActualMetrics
  ): GapAnalysis[] {
    const gaps: GapAnalysis[] = [];

    // Quality Score Gap
    if (actual.qualityScore < criteria.minQualityScore) {
      gaps.push(this.createGapAnalysis(
        'Quality Score',
        criteria.minQualityScore,
        actual.qualityScore
      ));
    }

    // ESLint Errors Gap
    if (actual.eslintErrors > criteria.maxEslintErrors) {
      gaps.push(this.createGapAnalysis(
        'ESLint Errors',
        criteria.maxEslintErrors,
        actual.eslintErrors
      ));
    }

    // TypeScript Errors Gap
    if (actual.typeScriptErrors > criteria.maxTypeScriptErrors) {
      gaps.push(this.createGapAnalysis(
        'TypeScript Errors',
        criteria.maxTypeScriptErrors,
        actual.typeScriptErrors
      ));
    }

    // Security Issues Gap
    if (actual.securityIssues > criteria.maxSecurityIssues) {
      gaps.push(this.createGapAnalysis(
        'Security Issues',
        criteria.maxSecurityIssues,
        actual.securityIssues
      ));
    }

    // Test Coverage Gap
    if (actual.testCoverage < criteria.minTestCoverage) {
      gaps.push(this.createGapAnalysis(
        'Test Coverage',
        criteria.minTestCoverage,
        actual.testCoverage
      ));
    }

    // Tests Passed Gap
    if (actual.testsPassed < criteria.minTestsPassed) {
      gaps.push(this.createGapAnalysis(
        'Tests Passed',
        criteria.minTestsPassed,
        actual.testsPassed
      ));
    }

    return gaps;
  }

  private createGapAnalysis(
    metric: string,
    expected: number,
    actual: number
  ): GapAnalysis {
    const gap = Math.abs(expected - actual);
    const gapPercentage = expected !== 0 ? (gap / expected) * 100 : 100;

    let severity: 'critical' | 'high' | 'medium' | 'low';
    if (gapPercentage >= 50) {
      severity = 'critical';
    } else if (gapPercentage >= 30) {
      severity = 'high';
    } else if (gapPercentage >= 10) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return {
      metric,
      expected,
      actual,
      gap,
      gapPercentage,
      severity,
    };
  }

  private generateRecommendations(
    gaps: GapAnalysis[],
    _results: ValidationResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Priority: Critical gaps first
    const criticalGaps = gaps.filter((g) => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(
        `🚨 Address ${criticalGaps.length} critical gap(s) immediately: ${criticalGaps
          .map((g) => g.metric)
          .join(', ')}`
      );
    }

    // High gaps
    const highGaps = gaps.filter((g) => g.severity === 'high');
    if (highGaps.length > 0) {
      recommendations.push(
        `⚠️  Focus on ${highGaps.length} high-priority gap(s): ${highGaps
          .map((g) => g.metric)
          .join(', ')}`
      );
    }

    // Specific recommendations
    for (const gap of gaps) {
      if (gap.metric === 'Test Coverage' && gap.severity !== 'low') {
        recommendations.push(
          `📈 Increase test coverage from ${gap.actual}% to ${gap.expected}% by adding unit tests`
        );
      }
      if (gap.metric === 'Quality Score' && gap.severity !== 'low') {
        recommendations.push(
          `🔧 Improve code quality from ${gap.actual} to ${gap.expected} by addressing ESLint/TypeScript errors`
        );
      }
      if (gap.metric === 'Security Issues' && gap.actual > 0) {
        recommendations.push(
          `🔐 Fix ${gap.actual} security issue(s) immediately - run npm audit fix`
        );
      }
    }

    return recommendations;
  }

  private generateNextActions(gaps: GapAnalysis[], _goal: GoalDefinition): NextAction[] {
    const actions: NextAction[] = [];
    let actionId = 1;

    for (const gap of gaps) {
      const estimatedImpact = this.estimateImpact(gap);

      if (gap.metric === 'Test Coverage') {
        actions.push({
          id: `action-${actionId++}`,
          type: 'test',
          description: `Add unit tests to increase coverage from ${gap.actual}% to ${gap.expected}%`,
          priority: gap.severity === 'critical' ? 1 : 2,
          estimatedImpact,
          targetMetric: 'Test Coverage',
        });
      }

      if (gap.metric === 'ESLint Errors') {
        actions.push({
          id: `action-${actionId++}`,
          type: 'fix',
          description: `Fix ${gap.actual} ESLint error(s) - target: ${gap.expected}`,
          priority: 1,
          estimatedImpact,
          targetMetric: 'ESLint Errors',
        });
      }

      if (gap.metric === 'TypeScript Errors') {
        actions.push({
          id: `action-${actionId++}`,
          type: 'fix',
          description: `Fix ${gap.actual} TypeScript error(s) - target: ${gap.expected}`,
          priority: 1,
          estimatedImpact,
          targetMetric: 'TypeScript Errors',
        });
      }

      if (gap.metric === 'Security Issues') {
        actions.push({
          id: `action-${actionId++}`,
          type: 'fix',
          description: `Fix ${gap.actual} security issue(s) - run npm audit fix`,
          priority: 1,
          estimatedImpact: 20,
          targetMetric: 'Security Issues',
        });
      }

      if (gap.metric === 'Quality Score') {
        actions.push({
          id: `action-${actionId++}`,
          type: 'refactor',
          description: `Refactor code to improve quality score from ${gap.actual} to ${gap.expected}`,
          priority: 2,
          estimatedImpact,
          targetMetric: 'Quality Score',
        });
      }
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  private calculateScoreImpact(
    actual: number,
    expected: number,
    operator: 'gte' | 'lte' | 'eq'
  ): number {
    if (operator === 'gte') {
      return actual >= expected ? 0 : Math.min(-20, (actual - expected) / 5);
    } else if (operator === 'lte') {
      return actual <= expected ? 0 : Math.max(-20, (expected - actual) / 5);
    } else {
      return actual === expected ? 0 : -10;
    }
  }

  private generateCriterionFeedback(
    criterion: string,
    actual: number,
    expected: number,
    operator: 'gte' | 'lte' | 'eq'
  ): string {
    if (operator === 'gte') {
      if (actual >= expected) {
        return `✅ ${criterion} meets requirement (${actual} >= ${expected})`;
      } else {
        return `❌ ${criterion} below requirement (${actual} < ${expected})`;
      }
    } else if (operator === 'lte') {
      if (actual <= expected) {
        return `✅ ${criterion} meets requirement (${actual} <= ${expected})`;
      } else {
        return `❌ ${criterion} exceeds limit (${actual} > ${expected})`;
      }
    } else {
      if (actual === expected) {
        return `✅ ${criterion} matches requirement (${actual} === ${expected})`;
      } else {
        return `❌ ${criterion} does not match (${actual} !== ${expected})`;
      }
    }
  }

  private evaluateCustomMetric(
    actual: number,
    expected: number,
    operator: 'gte' | 'lte' | 'eq'
  ): boolean {
    if (operator === 'gte') {
      return actual >= expected;
    } else if (operator === 'lte') {
      return actual <= expected;
    } else {
      return actual === expected;
    }
  }

  private estimateImpact(gap: GapAnalysis): number {
    // Estimate score improvement if this gap is closed
    if (gap.severity === 'critical') {
      return 20;
    } else if (gap.severity === 'high') {
      return 15;
    } else if (gap.severity === 'medium') {
      return 10;
    } else {
      return 5;
    }
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.config.reportsDirectory)) {
      fs.mkdirSync(this.config.reportsDirectory, { recursive: true });
    }
  }

  private saveReport(report: ConsumptionReport): void {
    const filename = `consumption-${report.goalId}-${report.sessionId}.json`;
    const filePath = path.join(this.config.reportsDirectory, filename);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }
}
