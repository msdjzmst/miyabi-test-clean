/**
 * ReviewLoop - Interactive Code Review Loop
 *
 * Implements Daniel's Review Loop pattern from OpenAI Dev Day:
 * - Iterate until quality threshold met (default: 80/100)
 * - Maximum 10 iterations
 * - Auto-fix safe issues (ESLint only)
 * - Escalate if critical issues or max iterations reached
 *
 * OpenAI Results: 70% increase in PR count due to pre-PR quality assurance
 */

import { ReviewAgent } from './review-agent';
import {
  Task,
  QualityReport,
  QualityIssue,
  AgentConfig,
} from '../types/index';
import { execSync } from 'child_process';
import * as readline from 'readline';

export interface ReviewLoopOptions {
  threshold?: number;        // Default: 80
  maxIterations?: number;    // Default: 10
  autoFix?: boolean;         // Default: false
  skipTests?: boolean;       // Default: false
  verbose?: boolean;         // Default: false
}

export interface ReviewLoopResult {
  passed: boolean;
  iterations: number;
  finalScore: number;
  finalReport: QualityReport;
}

export interface AutoFixResult {
  fixed: number;
  manual: number;
  fixedIssues: QualityIssue[];
  manualIssues: QualityIssue[];
}

/**
 * ReviewLoop - Main interactive review loop implementation
 */
export class ReviewLoop {
  private agent: ReviewAgent;
  private threshold: number;
  private maxIterations: number;
  private autoFix: boolean;
  private skipTests: boolean;
  private verbose: boolean;

  constructor(
    agent: ReviewAgent,
    options: ReviewLoopOptions = {}
  ) {
    this.agent = agent;
    this.threshold = options.threshold ?? 80;
    this.maxIterations = options.maxIterations ?? 10;
    this.autoFix = options.autoFix ?? false;
    this.skipTests = options.skipTests ?? false;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Execute interactive review loop
   *
   * Main loop that iterates until:
   * - Quality threshold met (score >= threshold)
   * - Maximum iterations reached
   * - User skips review
   * - Critical security issues escalated
   */
  async execute(): Promise<ReviewLoopResult> {
    this.log('\n🔍 Starting interactive code review (Daniel\'s Review Loop)\n');

    let iteration = 0;
    let passed = false;
    let finalReport: QualityReport | null = null;

    while (iteration < this.maxIterations && !passed) {
      iteration++;
      this.log(`\n━━━ Review Iteration ${iteration}/${this.maxIterations} ━━━\n`);

      // Run review
      const result = await this.agent.execute(this.createReviewTask(iteration));

      if (result.status === 'failed' && result.error) {
        this.log(`\n❌ Review execution failed: ${result.error}\n`);
        break;
      }

      finalReport = result.data.qualityReport;

      // Check if finalReport is null
      if (!finalReport) {
        this.log(`\n❌ Review failed: No quality report returned\n`);
        break;
      }

      // Display results
      this.displayResults(finalReport, iteration);

      // Check if passed
      if (finalReport.passed && finalReport.score >= this.threshold) {
        passed = true;
        this.log(`\n✅ Review PASSED (score: ${finalReport.score}/100)\n`);
        this.displaySuccessMessage(finalReport);
        break;
      }

      // Display issues
      this.log(`\n❌ Review FAILED (score: ${finalReport.score}/100, threshold: ${this.threshold})\n`);
      this.displayIssues(finalReport);

      // If auto-fix enabled, attempt fixes automatically
      if (this.autoFix) {
        await this.attemptAutoFix(finalReport);
        this.log('\n🔄 Re-running review after auto-fix...\n');
        continue; // Re-review immediately after auto-fix
      }

      // Wait for user action
      const action = await this.promptUser();

      if (action === 'skip') {
        this.log('\n⏭️  Review skipped by user\n');
        break;
      }

      if (action === 'fix') {
        await this.attemptAutoFix(finalReport);
      }

      // If action is 'continue', user will manually fix and we'll re-review
    }

    // Check for max iterations
    if (iteration >= this.maxIterations && !passed) {
      this.log(`\n⚠️  Maximum iterations (${this.maxIterations}) reached.\n`);
      this.log(`\n🚨 Escalating to human reviewer.\n`);
      this.displayEscalationSummary(finalReport!);
    }

    return {
      passed,
      iterations: iteration,
      finalScore: finalReport?.score ?? 0,
      finalReport: finalReport!,
    };
  }

  /**
   * Create review task
   */
  private createReviewTask(iteration: number): Task {
    return {
      id: `review-${Date.now()}-${iteration}`,
      title: `Interactive Review (Iteration ${iteration})`,
      description: 'Comprehensive code review before PR submission',
      type: 'test',
      priority: 1,
      severity: 'Sev.3-Medium',
      impact: 'High',
      assignedAgent: 'ReviewAgent',
      dependencies: [],
      estimatedDuration: 15,
      status: 'running',
      metadata: {
        iteration,
        skipTests: this.skipTests,
      },
    };
  }

  /**
   * Display review results
   */
  private displayResults(report: QualityReport, iteration: number): void {
    this.log(`📊 Analysis Results (Iteration ${iteration}):\n`);

    // Display table
    const maxWidth = 20;
    const separator = '─'.repeat(maxWidth * 2 + 7);

    this.log(`┌${separator}┐`);
    this.log(`│ ${'Metric'.padEnd(maxWidth)} │ ${'Score'.padEnd(7)} │`);
    this.log(`├${separator}┤`);

    if (report.breakdown) {
      if (report.breakdown.eslintScore !== undefined) {
        this.log(`│ ${'ESLint'.padEnd(maxWidth)} │ ${(report.breakdown.eslintScore + '/100').padEnd(7)} │`);
      }
      if (report.breakdown.typeScriptScore !== undefined) {
        this.log(`│ ${'TypeScript'.padEnd(maxWidth)} │ ${(report.breakdown.typeScriptScore + '/100').padEnd(7)} │`);
      }
      if (report.breakdown.securityScore !== undefined) {
        this.log(`│ ${'Security'.padEnd(maxWidth)} │ ${(report.breakdown.securityScore + '/100').padEnd(7)} │`);
      }
      if (report.breakdown.testCoverageScore !== undefined) {
        this.log(`│ ${'Test Coverage'.padEnd(maxWidth)} │ ${(report.breakdown.testCoverageScore + '/100').padEnd(7)} │`);
      }
    }

    this.log(`├${separator}┤`);
    this.log(`│ ${'Overall Quality'.padEnd(maxWidth)} │ ${(report.score + '/100').padEnd(7)} │`);
    this.log(`└${separator}┘\n`);
  }

  /**
   * Display issues
   */
  private displayIssues(report: QualityReport): void {
    if (report.issues.length === 0) {
      this.log('No issues found.\n');
      return;
    }

    this.log(`🔍 Found ${report.issues.length} issue(s):\n`);

    report.issues.forEach((issue, index) => {
      const typeEmoji = this.getTypeEmoji(issue.type);
      const severityBadge = this.getSeverityBadge(issue.severity);

      this.log(`${index + 1}. [${typeEmoji} ${issue.type.toUpperCase()}] ${severityBadge} ${issue.file}:${issue.line}`);
      this.log(`   ${issue.message}`);
      this.log('');
    });

    // Display recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      this.log('💡 Recommendations:\n');
      report.recommendations.forEach((rec, index) => {
        this.log(`   ${index + 1}. ${rec}`);
      });
      this.log('');
    }

    // Display next steps
    this.log('📋 Next steps:\n');
    this.log('   1. Fix the issues above');
    this.log('   2. Type "continue" to re-review');
    this.log('   3. Or type "pls fix" for automatic fixes (where possible)');
    this.log('   4. Or type "skip" to skip review\n');
  }

  /**
   * Display success message
   */
  private displaySuccessMessage(report: QualityReport): void {
    this.log('🎉 Excellent! All checks passed.\n');

    this.log('📊 Quality Breakdown:\n');

    if (report.breakdown) {
      if (report.breakdown.eslintScore === 100 && report.breakdown.typeScriptScore === 100) {
        this.log('   - Code Quality: ✅ Perfect (ESLint + TypeScript)');
      } else {
        this.log('   - Code Quality: ✅ Good');
      }

      if (report.breakdown.securityScore === 100) {
        this.log('   - Security: ✅ No vulnerabilities');
      } else if (report.breakdown.securityScore >= 80) {
        this.log('   - Security: ✅ Acceptable');
      }

      if (report.breakdown.testCoverageScore !== undefined) {
        this.log(`   - Test Coverage: ✅ ${report.breakdown.testCoverageScore}% (target: 80%)`);
      }
    }

    this.log('\n✨ Ready to create PR!\n');
  }

  /**
   * Display escalation summary
   */
  private displayEscalationSummary(report: QualityReport): void {
    this.log('📊 Issues Summary:\n');

    const securityIssues = report.issues.filter(i => i.type === 'security');
    const typeScriptIssues = report.issues.filter(i => i.type === 'typescript');
    const eslintIssues = report.issues.filter(i => i.type === 'eslint');

    if (securityIssues.length > 0) {
      this.log(`   - ${securityIssues.length} security issue(s)`);
    }
    if (typeScriptIssues.length > 0) {
      this.log(`   - ${typeScriptIssues.length} TypeScript error(s)`);
    }
    if (eslintIssues.length > 0) {
      this.log(`   - ${eslintIssues.length} ESLint warning(s)`);
    }

    this.log('\n💡 Recommendations:\n');
    this.log('   1. Review security issues with CISO (if applicable)');
    this.log('   2. Refactor code to fix TypeScript errors');
    this.log('   3. Consider breaking down this PR into smaller chunks\n');
  }

  /**
   * Prompt user for action
   */
  private async promptUser(): Promise<'continue' | 'fix' | 'skip'> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('\n> ', (answer) => {
        rl.close();

        const input = answer.trim().toLowerCase();

        if (input === 'pls fix' || input === 'fix') {
          resolve('fix');
        } else if (input === 'skip') {
          resolve('skip');
        } else {
          resolve('continue');
        }
      });
    });
  }

  /**
   * Attempt automatic fixes
   */
  async attemptAutoFix(report: QualityReport): Promise<AutoFixResult> {
    this.log('\n🔧 Attempting automatic fixes...\n');

    const fixedIssues: QualityIssue[] = [];
    const manualIssues: QualityIssue[] = [];

    for (const issue of report.issues) {
      // Only auto-fix ESLint issues
      if (issue.type === 'eslint' && issue.severity !== 'critical') {
        try {
          // Run ESLint with --fix
          execSync(`npx eslint --fix "${issue.file}"`, {
            cwd: process.cwd(),
            encoding: 'utf-8',
          });
          fixedIssues.push(issue);
          this.log(`✅ Fixed: [${issue.type.toUpperCase()}] ${issue.message}`);
          this.log(`   - File: ${issue.file}:${issue.line}\n`);
        } catch (error) {
          manualIssues.push(issue);
          this.log(`⚠️  Could not auto-fix: [${issue.type.toUpperCase()}] ${issue.message}`);
          this.log(`   - File: ${issue.file}:${issue.line}\n`);
        }
      } else {
        // TypeScript and Security issues require manual fix
        manualIssues.push(issue);
        this.log(`⚠️  Manual fix required: [${issue.type.toUpperCase()}] ${issue.message}`);
        this.log(`   - File: ${issue.file}:${issue.line}`);
        this.log(`   - Reason: ${this.getManualFixReason(issue)}\n`);
      }
    }

    // Display summary
    this.log('📊 Auto-fix Summary:\n');
    this.log(`   - Fixed: ${fixedIssues.length}/${report.issues.length} issue(s)`);
    this.log(`   - Manual: ${manualIssues.length}/${report.issues.length} issue(s)\n`);

    if (manualIssues.length > 0) {
      this.log(`Please fix remaining ${manualIssues.length} issue(s) manually and re-run review.\n`);
    }

    return {
      fixed: fixedIssues.length,
      manual: manualIssues.length,
      fixedIssues,
      manualIssues,
    };
  }

  /**
   * Get manual fix reason
   */
  private getManualFixReason(issue: QualityIssue): string {
    if (issue.type === 'typescript') {
      return 'Type errors require code logic changes';
    }
    if (issue.type === 'security') {
      if (issue.severity === 'critical') {
        return 'Critical security issues require careful review';
      }
      return 'Security issues require design decisions';
    }
    return 'Requires manual intervention';
  }

  /**
   * Get type emoji
   */
  private getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      eslint: '🔧',
      typescript: '📘',
      security: '🔒',
      test: '🧪',
    };
    return emojiMap[type] || '❓';
  }

  /**
   * Get severity badge
   */
  private getSeverityBadge(severity: string): string {
    const badgeMap: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
    };
    return badgeMap[severity] || '•';
  }

  /**
   * Log message (respects verbose flag)
   */
  private log(message: string): void {
    if (this.verbose || !message.startsWith('   ')) {
      console.log(message);
    }
  }
}

/**
 * Standalone function to run review loop
 *
 * Usage:
 * ```typescript
 * import { runReviewLoop } from '@miyabi/coding-agents/review/review-loop';
 *
 * const result = await runReviewLoop(config, options);
 * ```
 */
export async function runReviewLoop(
  config: AgentConfig,
  options: ReviewLoopOptions = {}
): Promise<ReviewLoopResult> {
  const agent = new ReviewAgent(config);
  const loop = new ReviewLoop(agent, options);
  return await loop.execute();
}
