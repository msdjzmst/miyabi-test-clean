/**
 * Agent Verification Script
 *
 * Verifies that all Agent implementations pass lint, typecheck, and test requirements.
 *
 * Usage:
 *   npm run agents:verify                    # Verify all agents
 *   npm run agents:verify -- --agent codegen # Verify specific agent
 *   npm run agents:verify -- --verbose       # Detailed output
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = One or more checks failed
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

interface VerificationResult {
  agent: string;
  lint: boolean;
  typecheck: boolean;
  test: boolean;
  passed: boolean;
  errors: string[];
}

interface VerificationOptions {
  agent?: string;
  verbose?: boolean;
  bail?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): VerificationOptions {
  const args = process.argv.slice(2);
  const options: VerificationOptions = {
    verbose: false,
    bail: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && i + 1 < args.length) {
      options.agent = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    } else if (args[i] === '--bail') {
      options.bail = true;
    }
  }

  return options;
}

/**
 * Get list of all agents to verify
 */
function getAgentList(specificAgent?: string): string[] {
  const agentsDir = path.join(projectRoot, 'agents');

  if (specificAgent) {
    return [specificAgent];
  }

  // List of coding agents (based on directory structure)
  const codingAgents = [
    'coordinator',
    'codegen',
    'review',
    'issue',
    'pr',
    'deployment',
  ];

  return codingAgents.filter(agent => {
    const agentPath = path.join(agentsDir, agent);
    return fs.existsSync(agentPath);
  });
}

/**
 * Execute a command and capture output
 */
function executeCommand(
  command: string,
  options: { cwd?: string; silent?: boolean } = {},
): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd: options.cwd || projectRoot,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: output || '' };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || error.message || 'Command failed',
    };
  }
}

/**
 * Run ESLint on agent files
 */
function verifyLint(agent: string, verbose: boolean): { passed: boolean; error?: string } {
  if (verbose) {
    console.log(`  🔍 Running ESLint on ${agent}...`);
  }

  const agentPath = path.join(projectRoot, 'agents', agent);

  if (!fs.existsSync(agentPath)) {
    return { passed: false, error: `Agent directory not found: ${agentPath}` };
  }

  const result = executeCommand(
    `npx eslint "${agentPath}/**/*.ts" --ext .ts`,
    { silent: !verbose },
  );

  if (!result.success) {
    return { passed: false, error: result.output };
  }

  if (verbose) {
    console.log(`  ✅ ESLint passed`);
  }

  return { passed: true };
}

/**
 * Run TypeScript type checking
 */
function verifyTypecheck(_agent: string, verbose: boolean): { passed: boolean; error?: string } {
  if (verbose) {
    console.log(`  🔍 Running TypeScript type check...`);
  }

  // Run tsc on the entire project (agents share types)
  const result = executeCommand(
    'npx tsc --noEmit',
    { silent: !verbose },
  );

  if (!result.success) {
    return { passed: false, error: result.output };
  }

  if (verbose) {
    console.log(`  ✅ Type check passed`);
  }

  return { passed: true };
}

/**
 * Run Vitest tests for agent
 */
function verifyTests(agent: string, verbose: boolean): { passed: boolean; error?: string } {
  if (verbose) {
    console.log(`  🔍 Running tests for ${agent}...`);
  }

  // Run tests matching agent name pattern
  const result = executeCommand(
    `npx vitest run --reporter=verbose --run tests/**/*${agent}*.test.ts`,
    { silent: !verbose },
  );

  if (!result.success) {
    // Check if no tests found (this is OK for some agents)
    if (result.output.includes('No test files found')) {
      if (verbose) {
        console.log(`  ⚠️  No tests found for ${agent}`);
      }
      return { passed: true };
    }

    return { passed: false, error: result.output };
  }

  if (verbose) {
    console.log(`  ✅ Tests passed`);
  }

  return { passed: true };
}

/**
 * Verify a single agent
 */
function verifyAgent(agent: string, options: VerificationOptions): VerificationResult {
  console.log(`\n📦 Verifying ${agent}Agent...`);

  const result: VerificationResult = {
    agent,
    lint: false,
    typecheck: false,
    test: false,
    passed: false,
    errors: [],
  };

  // Run lint
  const lintResult = verifyLint(agent, options.verbose || false);
  result.lint = lintResult.passed;
  if (!lintResult.passed && lintResult.error) {
    result.errors.push(`Lint error: ${lintResult.error}`);
    if (options.bail) {return result;}
  }

  // Run typecheck
  const typecheckResult = verifyTypecheck(agent, options.verbose || false);
  result.typecheck = typecheckResult.passed;
  if (!typecheckResult.passed && typecheckResult.error) {
    result.errors.push(`Type error: ${typecheckResult.error}`);
    if (options.bail) {return result;}
  }

  // Run tests
  const testResult = verifyTests(agent, options.verbose || false);
  result.test = testResult.passed;
  if (!testResult.passed && testResult.error) {
    result.errors.push(`Test error: ${testResult.error}`);
    if (options.bail) {return result;}
  }

  // Overall pass/fail
  result.passed = result.lint && result.typecheck && result.test;

  return result;
}

/**
 * Print verification summary
 */
function printSummary(results: VerificationResult[]): void {
  console.log(`\n${  '='.repeat(60)}`);
  console.log('📊 Agent Verification Summary\n');

  const maxAgentLength = Math.max(...results.map(r => r.agent.length));

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const agent = result.agent.padEnd(maxAgentLength);
    const checks = [
      result.lint ? '✓ lint' : '✗ lint',
      result.typecheck ? '✓ type' : '✗ type',
      result.test ? '✓ test' : '✗ test',
    ].join(' | ');

    console.log(`${status} ${agent}  ${checks}`);

    if (!result.passed && result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`       └─ ${error.split('\n')[0]}`);
      }
    }
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  console.log(`\n${  '='.repeat(60)}`);
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`${'='.repeat(60)  }\n`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 Agent Verification Tool\n');

  const options = parseArgs();
  const agentList = getAgentList(options.agent);

  console.log(`Agents to verify: ${agentList.join(', ')}`);

  const results: VerificationResult[] = [];

  for (const agent of agentList) {
    const result = verifyAgent(agent, options);
    results.push(result);

    if (options.bail && !result.passed) {
      console.log(`\n❌ Verification failed for ${agent}Agent, bailing out.`);
      break;
    }
  }

  printSummary(results);

  // Exit with non-zero code if any agent failed
  const failed = results.some(r => !r.passed);
  process.exit(failed ? 1 : 0);
}

// Run the script
main().catch((error) => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});
