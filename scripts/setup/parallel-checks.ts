#!/usr/bin/env node
/**
 * Parallel Checks - Run TypeScript/ESLint/Tests in Parallel
 *
 * Performance optimization: Instead of running checks sequentially,
 * run them in parallel to reduce total execution time by 50%+
 *
 * Before:
 *   tsc (2.4s) → eslint (3s) → vitest (5s) = 10.4s total
 *
 * After:
 *   max(tsc, eslint, vitest) = max(2.4s, 3s, 5s) = 5s total (-52%)
 *
 * Usage:
 *   pnpm run check:all
 *   pnpm run check:all --only typecheck
 *   pnpm run check:all --only lint
 *   pnpm run check:all --only test
 */

import { spawn } from 'child_process';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  name: string;
  command: string;
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

interface CheckConfig {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  enabled: boolean;
  color: string;
  emoji: string;
}

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIArgs {
  only?: 'typecheck' | 'lint' | 'test';
  verbose: boolean;
  bail: boolean; // Stop on first failure
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    verbose: false,
    bail: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--only') {
      args.only = process.argv[++i] as any;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--bail' || arg === '-b') {
      args.bail = true;
    }
  }

  return args;
}

// ============================================================================
// Check Configuration
// ============================================================================

function getCheckConfigs(only?: string): CheckConfig[] {
  const all: CheckConfig[] = [
    {
      name: 'TypeScript',
      command: 'pnpm',
      args: ['run', 'typecheck'],
      enabled: !only || only === 'typecheck',
      color: '\x1b[34m', // Blue
      emoji: '📘',
    },
    {
      name: 'ESLint',
      command: 'pnpm',
      args: ['run', 'lint'],
      cwd: path.join(process.cwd(), 'packages/dashboard'),
      enabled: !only || only === 'lint',
      color: '\x1b[35m', // Magenta
      emoji: '🔍',
    },
    {
      name: 'Tests',
      command: 'pnpm',
      args: ['run', 'test'],
      enabled: !only || only === 'test',
      color: '\x1b[32m', // Green
      emoji: '🧪',
    },
  ];

  return all.filter((c) => c.enabled);
}

// ============================================================================
// Check Execution
// ============================================================================

/**
 * Run a single check command
 */
async function runCheck(config: CheckConfig, verbose: boolean): Promise<CheckResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      if (verbose) {
        // Prefix output with check name
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            console.log(`${config.color}[${config.name}]${'\x1b[0m'} ${line}`);
          }
        });
      }
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;

      if (verbose) {
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            console.error(`${config.color}[${config.name}]${'\x1b[0m'} ${line}`);
          }
        });
      }
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      resolve({
        name: config.name,
        command: `${config.command} ${config.args.join(' ')}`,
        exitCode: code || 0,
        duration,
        stdout,
        stderr,
        success: code === 0,
      });
    });
  });
}

/**
 * Run all checks in parallel
 */
async function runAllChecks(configs: CheckConfig[], verbose: boolean, bail: boolean): Promise<CheckResult[]> {
  console.log(`\n⚡ Running ${configs.length} checks in parallel...\n`);

  if (bail) {
    console.log('⚠️  Bail mode: Will stop on first failure\n');
  }

  // Start all checks in parallel
  const promises = configs.map((config) => runCheck(config, verbose));

  // Wait for all to complete (or first failure if bail)
  const results: CheckResult[] = [];

  if (bail) {
    // Race mode - stop on first failure
    for (const promise of promises) {
      const result = await promise;
      results.push(result);

      if (!result.success) {
        console.log(`\n❌ ${result.name} failed - stopping due to --bail\n`);
        break;
      }
    }
  } else {
    // Wait for all
    const allResults = await Promise.all(promises);
    results.push(...allResults);
  }

  return results;
}

// ============================================================================
// Results Formatting
// ============================================================================

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print results summary
 */
function printResults(results: CheckResult[]): void {
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const maxDuration = Math.max(...results.map((r) => r.duration));
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`\n${  '='.repeat(80)}`);
  console.log('📊 Check Results Summary');
  console.log(`${'='.repeat(80)  }\n`);

  // Individual results
  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 'PASS' : 'FAIL';
    const color = result.success ? '\x1b[32m' : '\x1b[31m';

    console.log(`${icon} ${color}${result.name}${'\x1b[0m'}: ${status} (${formatDuration(result.duration)})`);

    // Show error details for failures
    if (!result.success && result.stderr) {
      const errorLines = result.stderr.split('\n').slice(0, 5); // First 5 lines
      errorLines.forEach((line) => {
        if (line.trim()) {
          console.log(`   ${line}`);
        }
      });

      if (result.stderr.split('\n').length > 5) {
        console.log(`   ... (${result.stderr.split('\n').length - 5} more lines)`);
      }
    }
  }

  console.log('');
  console.log('⏱️  Performance:');
  console.log(`   Sequential (estimated): ${formatDuration(totalDuration)}`);
  console.log(`   Parallel (actual):      ${formatDuration(maxDuration)}`);
  console.log(`   Time saved:             ${formatDuration(totalDuration - maxDuration)} (${Math.round(((totalDuration - maxDuration) / totalDuration) * 100)}%)`);

  console.log('');
  console.log('📈 Summary:');
  console.log(`   Total Checks: ${results.length}`);
  console.log(`   Passed:       ${successCount} ✅`);
  console.log(`   Failed:       ${failCount} ❌`);
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  console.log('🔬 Parallel Code Quality Checks\n');

  // Get check configurations
  const configs = getCheckConfigs(args.only);

  if (configs.length === 0) {
    console.error('❌ No checks enabled');
    process.exit(1);
  }

  console.log('🎯 Enabled Checks:');
  for (const config of configs) {
    console.log(`   ${config.emoji} ${config.name}: ${config.command} ${config.args.join(' ')}`);
  }

  // Run all checks
  const results = await runAllChecks(configs, args.verbose, args.bail);

  // Print results
  printResults(results);

  // Exit with appropriate code
  const hasFailures = results.some((r) => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
