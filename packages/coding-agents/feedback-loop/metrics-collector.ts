/**
 * MetricsCollector - Real-time metrics collection from actual code execution
 *
 * Collects metrics by running:
 * - ESLint (linting errors)
 * - TypeScript compiler (type errors)
 * - Vitest (test results + coverage)
 * - Build process (performance)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ActualMetrics } from '../types/index';

const execAsync = promisify(exec);

export interface MetricsCollectorConfig {
  workingDirectory: string;
  timeout?: number; // milliseconds
  skipTests?: boolean;
  skipCoverage?: boolean;
  verbose?: boolean;
}

export interface ESLintResult {
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  results: Array<{
    filePath: string;
    errorCount: number;
    warningCount: number;
    messages: Array<{
      ruleId: string;
      severity: number;
      message: string;
      line: number;
      column: number;
    }>;
  }>;
}

export interface TypeScriptResult {
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: string;
  }>;
  totalErrors: number;
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  duration: number; // milliseconds
}

export interface CoverageResult {
  lines: { pct: number; covered: number; total: number };
  statements: { pct: number; covered: number; total: number };
  functions: { pct: number; covered: number; total: number };
  branches: { pct: number; covered: number; total: number };
}

/**
 * MetricsCollector - リアルタイムメトリクス収集
 */
export class MetricsCollector {
  private config: MetricsCollectorConfig;

  constructor(config: MetricsCollectorConfig) {
    this.config = {
      timeout: 120000, // 2 minutes default
      skipTests: false,
      skipCoverage: false,
      verbose: false,
      ...config,
    };
  }

  /**
   * Collect all metrics from the working directory
   */
  async collect(): Promise<ActualMetrics> {
    const startTime = Date.now();

    if (this.config.verbose) {
      console.log(`📊 Collecting metrics from: ${this.config.workingDirectory}`);
    }

    // Run all checks in parallel for speed
    const [eslintResult, tscResult, testResult, coverageResult, buildTime, loc] =
      await Promise.all([
        this.runESLint(),
        this.runTypeScript(),
        this.config.skipTests ? this.getDefaultTestResult() : this.runTests(),
        this.config.skipCoverage
          ? this.getDefaultCoverageResult()
          : this.collectCoverage(),
        this.measureBuildTime(),
        this.countLinesOfCode(),
      ]);

    const qualityScore = this.calculateQualityScore({
      eslintResult,
      tscResult,
      testResult,
      coverageResult,
    });

    const cyclomaticComplexity = await this.estimateComplexity();

    const endTime = Date.now();

    if (this.config.verbose) {
      console.log(`✅ Metrics collected in ${endTime - startTime}ms`);
      console.log(`   Quality Score: ${qualityScore}/100`);
      console.log(`   ESLint Errors: ${eslintResult.errorCount}`);
      console.log(`   TypeScript Errors: ${tscResult.totalErrors}`);
      console.log(`   Tests: ${testResult.passed}/${testResult.total}`);
      console.log(`   Coverage: ${coverageResult.lines.pct.toFixed(1)}%`);
    }

    return {
      qualityScore,
      eslintErrors: eslintResult.errorCount,
      typeScriptErrors: tscResult.totalErrors,
      securityIssues: 0, // TODO: Implement security scan
      testCoverage: coverageResult.lines.pct,
      testsPassed: testResult.passed,
      testsFailed: testResult.failed,
      buildTimeMs: buildTime,
      linesOfCode: loc,
      cyclomaticComplexity,
    };
  }

  /**
   * Run ESLint and parse results
   */
  private async runESLint(): Promise<ESLintResult> {
    try {
      const { stdout } = await execAsync(
        'npx eslint . --format json --ext .ts,.tsx',
        {
          cwd: this.config.workingDirectory,
          timeout: this.config.timeout,
          env: { ...process.env, NODE_ENV: 'test' },
        }
      );

      const results = JSON.parse(stdout);

      const errorCount = results.reduce(
        (sum: number, r: any) => sum + r.errorCount,
        0
      );
      const warningCount = results.reduce(
        (sum: number, r: any) => sum + r.warningCount,
        0
      );

      return {
        errorCount,
        warningCount,
        fixableErrorCount: results.reduce(
          (sum: number, r: any) => sum + r.fixableErrorCount,
          0
        ),
        fixableWarningCount: results.reduce(
          (sum: number, r: any) => sum + r.fixableWarningCount,
          0
        ),
        results: results.map((r: any) => ({
          filePath: r.filePath,
          errorCount: r.errorCount,
          warningCount: r.warningCount,
          messages: r.messages,
        })),
      };
    } catch (error: any) {
      // ESLint exits with code 1 if there are errors, but still outputs JSON
      if (error.stdout) {
        try {
          const results = JSON.parse(error.stdout);
          const errorCount = results.reduce(
            (sum: number, r: any) => sum + r.errorCount,
            0
          );
          const warningCount = results.reduce(
            (sum: number, r: any) => sum + r.warningCount,
            0
          );

          return {
            errorCount,
            warningCount,
            fixableErrorCount: 0,
            fixableWarningCount: 0,
            results: results.map((r: any) => ({
              filePath: r.filePath,
              errorCount: r.errorCount,
              warningCount: r.warningCount,
              messages: r.messages,
            })),
          };
        } catch (parseError) {
          // JSON parse failed
        }
      }

      if (this.config.verbose) {
        console.warn('⚠️  ESLint execution failed:', error.message);
      }

      return {
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        results: [],
      };
    }
  }

  /**
   * Run TypeScript compiler and parse errors
   */
  private async runTypeScript(): Promise<TypeScriptResult> {
    try {
      await execAsync('npx tsc --noEmit --pretty false', {
        cwd: this.config.workingDirectory,
        timeout: this.config.timeout,
        env: { ...process.env, TSC_COMPILE_ON_ERROR: 'true' },
      });

      // No errors if command succeeded
      return { errors: [], totalErrors: 0 };
    } catch (error: any) {
      const stderr = error.stderr || '';
      const errors = this.parseTscOutput(stderr);

      return {
        errors,
        totalErrors: errors.length,
      };
    }
  }

  /**
   * Parse TypeScript compiler output
   */
  private parseTscOutput(output: string): TypeScriptResult['errors'] {
    const errors: TypeScriptResult['errors'] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match: file.ts(line,col): error TSxxxx: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: match[4],
          message: match[5],
        });
      }
    }

    return errors;
  }

  /**
   * Run tests with Vitest
   */
  private async runTests(): Promise<TestResult> {
    try {
      const { stdout } = await execAsync('npx vitest run --reporter=json', {
        cwd: this.config.workingDirectory,
        timeout: this.config.timeout,
        env: { ...process.env, CI: 'true' },
      });

      const result = JSON.parse(stdout);

      return {
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        total: result.numTotalTests || 0,
        duration: result.testResults?.reduce(
          (sum: number, r: any) => sum + (r.perfStats?.runtime || 0),
          0
        ) || 0,
      };
    } catch (error: any) {
      if (this.config.verbose) {
        console.warn('⚠️  Test execution failed:', error.message);
      }

      return this.getDefaultTestResult();
    }
  }

  /**
   * Collect code coverage with Vitest
   */
  private async collectCoverage(): Promise<CoverageResult> {
    try {
      await execAsync(
        'npx vitest run --coverage --reporter=json',
        {
          cwd: this.config.workingDirectory,
          timeout: this.config.timeout,
          env: { ...process.env, CI: 'true' },
        }
      );

      // Try to read coverage from coverage-final.json
      const coveragePath = join(
        this.config.workingDirectory,
        'coverage',
        'coverage-final.json'
      );

      if (existsSync(coveragePath)) {
        const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));

        // Calculate totals
        let totalLines = 0;
        let coveredLines = 0;
        let totalStatements = 0;
        let coveredStatements = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalBranches = 0;
        let coveredBranches = 0;

        for (const file of Object.values(coverageData)) {
          const data = file as any;
          totalLines += Object.keys(data.statementMap || {}).length;
          coveredLines += Object.values(data.s || {}).filter(
            (v: unknown) => (v as number) > 0
          ).length;

          totalStatements += Object.keys(data.statementMap || {}).length;
          coveredStatements += Object.values(data.s || {}).filter(
            (v: unknown) => (v as number) > 0
          ).length;

          totalFunctions += Object.keys(data.fnMap || {}).length;
          coveredFunctions += Object.values(data.f || {}).filter(
            (v: unknown) => (v as number) > 0
          ).length;

          totalBranches += Object.keys(data.branchMap || {}).length;
          coveredBranches += Object.values(data.b || {}).reduce(
            (sum: number, branches: any) =>
              sum + branches.filter((v: number) => v > 0).length,
            0
          );
        }

        return {
          lines: {
            pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
            covered: coveredLines,
            total: totalLines,
          },
          statements: {
            pct:
              totalStatements > 0
                ? (coveredStatements / totalStatements) * 100
                : 0,
            covered: coveredStatements,
            total: totalStatements,
          },
          functions: {
            pct:
              totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
            covered: coveredFunctions,
            total: totalFunctions,
          },
          branches: {
            pct:
              totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
            covered: coveredBranches,
            total: totalBranches,
          },
        };
      }

      return this.getDefaultCoverageResult();
    } catch (error: any) {
      if (this.config.verbose) {
        console.warn('⚠️  Coverage collection failed:', error.message);
      }

      return this.getDefaultCoverageResult();
    }
  }

  /**
   * Measure build time
   */
  private async measureBuildTime(): Promise<number> {
    const startTime = Date.now();

    try {
      await execAsync('npx tsc --noEmit', {
        cwd: this.config.workingDirectory,
        timeout: this.config.timeout,
      });

      return Date.now() - startTime;
    } catch (error) {
      // Even with errors, return the time it took
      return Date.now() - startTime;
    }
  }

  /**
   * Count lines of code (simplified)
   */
  private async countLinesOfCode(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1',
        {
          cwd: this.config.workingDirectory,
          timeout: 10000,
        }
      );

      const match = stdout.trim().match(/^\s*(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Estimate cyclomatic complexity (simplified)
   */
  private async estimateComplexity(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'find . -name "*.ts" -o -name "*.tsx" | xargs grep -c "if\\|for\\|while\\|case\\|catch" | ' +
          'awk -F: \'{ sum += $2 } END { print sum }\'',
        {
          cwd: this.config.workingDirectory,
          timeout: 10000,
          shell: '/bin/bash',
        }
      );

      return parseInt(stdout.trim(), 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(data: {
    eslintResult: ESLintResult;
    tscResult: TypeScriptResult;
    testResult: TestResult;
    coverageResult: CoverageResult;
  }): number {
    // Weighted scoring:
    // - ESLint: 25% (0 errors = 25 points)
    // - TypeScript: 25% (0 errors = 25 points)
    // - Tests: 25% (all passing = 25 points)
    // - Coverage: 25% (80%+ = 25 points)

    let score = 0;

    // ESLint score (25 points max)
    if (data.eslintResult.errorCount === 0) {
      score += 25;
    } else if (data.eslintResult.errorCount <= 5) {
      score += 15;
    } else if (data.eslintResult.errorCount <= 10) {
      score += 10;
    } else if (data.eslintResult.errorCount <= 20) {
      score += 5;
    }

    // TypeScript score (25 points max)
    if (data.tscResult.totalErrors === 0) {
      score += 25;
    } else if (data.tscResult.totalErrors <= 5) {
      score += 15;
    } else if (data.tscResult.totalErrors <= 10) {
      score += 10;
    } else if (data.tscResult.totalErrors <= 20) {
      score += 5;
    }

    // Test score (25 points max)
    if (data.testResult.total === 0) {
      score += 0; // No tests = 0 points
    } else {
      const passRate =
        data.testResult.total > 0
          ? data.testResult.passed / data.testResult.total
          : 0;
      score += passRate * 25;
    }

    // Coverage score (25 points max)
    score += (data.coverageResult.lines.pct / 100) * 25;

    return Math.round(score);
  }

  /**
   * Get default test result (when tests are skipped or fail to run)
   */
  private getDefaultTestResult(): TestResult {
    return {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
    };
  }

  /**
   * Get default coverage result (when coverage is skipped or fails)
   */
  private getDefaultCoverageResult(): CoverageResult {
    return {
      lines: { pct: 0, covered: 0, total: 0 },
      statements: { pct: 0, covered: 0, total: 0 },
      functions: { pct: 0, covered: 0, total: 0 },
      branches: { pct: 0, covered: 0, total: 0 },
    };
  }
}
