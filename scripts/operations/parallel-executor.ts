#!/usr/bin/env node
/**
 * Parallel Executor - CLI for Autonomous Agent Execution
 *
 * Usage:
 *   npm run agents:parallel:exec -- --issue 123
 *   npm run agents:parallel:exec -- --issues 123,124,125 --concurrency 3
 *   npm run agents:parallel:exec -- --help
 */

import { CoordinatorAgent } from '@miyabi/coding-agents/coordinator/coordinator-agent';
import type { AgentConfig, Issue, Task } from '@miyabi/coding-agents/types/index';
import type { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { getGitHubTokenSync } from './github-token-helper';
import { getGitHubClient, withGitHubCache } from '../../utils/api-client';
import { logConcurrencyRecommendation, getSafeConcurrency } from '../../utils/system-optimizer';

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIArgs {
  issues?: number[];
  concurrency?: number; // Made optional - will be auto-detected if not specified
  dryRun: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    concurrency: undefined, // Auto-detect optimal concurrency
    dryRun: false,
    logLevel: 'info',
    help: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--issue' || arg === '-i') {
      const issueNum = parseInt(process.argv[++i]);
      args.issues = [issueNum];
    } else if (arg === '--issues') {
      const issueNums = process.argv[++i].split(',').map(n => parseInt(n.trim()));
      args.issues = issueNums;
    } else if (arg === '--concurrency' || arg === '-c') {
      args.concurrency = parseInt(process.argv[++i]);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--log-level') {
      args.logLevel = process.argv[++i] as any;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Autonomous Operations - Parallel Executor

Usage:
  npm run agents:parallel:exec -- [options]

Options:
  --issue, -i <number>          Execute single issue
  --issues <n1,n2,...>          Execute multiple issues
  --concurrency, -c <number>    Number of parallel tasks (default: auto-detect based on CPU/memory)
  --dry-run                     Simulate execution without making changes
  --log-level <level>           Log level: debug, info, warn, error (default: info)
  --help, -h                    Show this help message

Examples:
  # Execute single issue
  npm run agents:parallel:exec -- --issue 123

  # Execute multiple issues with higher concurrency
  npm run agents:parallel:exec -- --issues 123,124,125 --concurrency 3

  # Dry run (no changes)
  npm run agents:parallel:exec -- --issue 123 --dry-run

Environment Variables:
  GITHUB_TOKEN              GitHub personal access token (required)
  DEVICE_IDENTIFIER         Device name for logs (default: hostname)
  REPOSITORY                GitHub repository (owner/repo)

GitHub Actions:
  ISSUE_NUMBER              Issue number to process (set by workflow)

Execution Mode:
  This executor uses Git Worktree for parallel execution.
  Each issue is processed in a separate worktree with Claude Code integration.
  `);
}

// ============================================================================
// Configuration
// ============================================================================

function loadConfig(): AgentConfig {
  // Load from .env if exists (for backward compatibility)
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  }

  // Get GitHub token with priority: gh CLI > environment variable
  let githubToken: string;
  try {
    githubToken = getGitHubTokenSync();
  } catch (error) {
    console.error('❌ Error: Failed to obtain GitHub token');
    console.error('   ', (error as Error).message);
    process.exit(1);
  }

  return {
    deviceIdentifier: process.env.DEVICE_IDENTIFIER || require('os').hostname(),
    githubToken,
    useTaskTool: false,
    useWorktree: true, // Enable Worktree-based parallel execution
    worktreeBasePath: '.worktrees',
    logDirectory: '.ai/logs',
    reportDirectory: '.ai/parallel-reports',
    techLeadGithubUsername: process.env.TECH_LEAD_GITHUB,
    firebaseProductionProject: process.env.FIREBASE_PROD_PROJECT,
    firebaseStagingProject: process.env.FIREBASE_STAGING_PROJECT,
  };
}

// ============================================================================
// GitHub API
// ============================================================================

async function fetchIssue(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<Issue | null> {
  try {
    // Use LRU cache to avoid repeated API calls
    const cacheKey = `issue:${owner}/${repo}/${issueNumber}`;

    const { data } = await withGitHubCache(cacheKey, async () => octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    }));

    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state as 'open' | 'closed',
      labels: data.labels.map((l: any) => typeof l === 'string' ? l : l.name),
      assignee: data.assignee?.login,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      url: data.html_url,
    };
  } catch (error) {
    console.error(`❌ Failed to fetch issue #${issueNumber}:`, (error as Error).message);
    return null;
  }
}

function parseRepository(): { owner: string; repo: string } {
  const repository = process.env.REPOSITORY || process.env.GITHUB_REPOSITORY;

  if (repository && repository.includes('/')) {
    const [owner, repo] = repository.split('/');
    return { owner, repo };
  }

  // Try to parse from git remote
  try {
    const { execSync } = require('child_process');
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Parse git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (error) {
    // Ignore
  }

  console.error('❌ Could not determine repository. Set REPOSITORY env var (owner/repo)');
  process.exit(1);
}

// ============================================================================
// Main Execution
// ============================================================================

interface ExecutionResult {
  issueNumber: number;
  status: 'success' | 'failed';
  duration?: number;
  error?: string;
}

async function executeIssue(
  agent: CoordinatorAgent,
  issue: Issue,
  dryRun: boolean,
): Promise<ExecutionResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Executing Issue #${issue.number}: ${issue.title}`);
  console.log(`${'='.repeat(80)}\n`);

  const startTime = Date.now();

  // Create a task for the CoordinatorAgent
  const task: Task = {
    id: `issue-${issue.number}`,
    title: issue.title,
    description: issue.body,
    type: 'feature', // Will be determined by IssueAgent
    priority: 1,
    severity: 'Sev.3-Medium',
    impact: 'Medium',
    assignedAgent: 'CoordinatorAgent',
    dependencies: [],
    estimatedDuration: 60,
    status: 'idle',
    metadata: {
      issueNumber: issue.number,
      issueUrl: issue.url,
      dryRun,
    },
  };

  try {
    const result = await agent.execute(task);
    const duration = Date.now() - startTime;

    if (result.status === 'success') {
      console.log(`\n✅ Issue #${issue.number} completed successfully`);
      console.log(`   Duration: ${duration}ms`);
      return { issueNumber: issue.number, status: 'success', duration };
    } else {
      console.error(`\n❌ Issue #${issue.number} failed:`, result.error);
      return { issueNumber: issue.number, status: 'failed', error: result.error };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = (error as Error).message;
    console.error(`\n❌ Issue #${issue.number} execution error:`, errorMsg);
    return { issueNumber: issue.number, status: 'failed', duration, error: errorMsg };
  }
}

/**
 * Execute issues incrementally - yields results as they complete
 * Allows for immediate processing of completed tasks
 */
async function* executeIssuesIncrementally(
  agent: CoordinatorAgent,
  issues: Issue[],
  concurrency: number,
  dryRun: boolean,
): AsyncGenerator<ExecutionResult, void, unknown> {
  const executing: Array<{ promise: Promise<ExecutionResult>; id: symbol }> = [];

  for (const issue of issues) {
    const id = Symbol(issue.number);
    const promise = executeIssue(agent, issue, dryRun);
    executing.push({ promise, id });

    // Wait if we've reached concurrency limit
    if (executing.length >= concurrency) {
      // Wait for the first promise to complete and remove it
      const result = await Promise.race(executing.map(e => e.promise.then(r => ({ result: r, id: e.id }))));
      const idx = executing.findIndex(e => e.id === result.id);
      if (idx >= 0) {executing.splice(idx, 1);}
      yield result.result; // Yield completed result immediately
    }
  }

  // Yield all remaining results as they complete
  while (executing.length > 0) {
    const result = await Promise.race(executing.map(e => e.promise.then(r => ({ result: r, id: e.id }))));
    const idx = executing.findIndex(e => e.id === result.id);
    if (idx >= 0) {executing.splice(idx, 1);}
    yield result.result;
  }
}

/**
 * Execute issues in parallel with concurrency control (backwards compatible)
 * Uses incremental processing under the hood
 */
async function executeIssuesInParallel(
  agent: CoordinatorAgent,
  issues: Issue[],
  concurrency: number,
  dryRun: boolean,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  // Use incremental processing and collect all results
  for await (const result of executeIssuesIncrementally(agent, issues, concurrency, dryRun)) {
    results.push(result);

    // Log completion in real-time
    if (result.status === 'success') {
      console.log(`✅ Completed #${result.issueNumber} (${(result.duration! / 1000).toFixed(2)}s)`);
    } else {
      console.log(`❌ Failed #${result.issueNumber}: ${result.error}`);
    }
  }

  return results;
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('🤖 Autonomous Operations - Parallel Executor\n');

  // Load configuration
  const config = loadConfig();
  console.log('✅ Configuration loaded');
  console.log(`   Device: ${config.deviceIdentifier}`);
  console.log(`   Log Directory: ${config.logDirectory}`);
  console.log(`   Report Directory: ${config.reportDirectory}`);

  // Determine optimal concurrency
  const concurrency = getSafeConcurrency(args.concurrency);

  // Show system resources and concurrency recommendation
  if (!args.concurrency) {
    console.log('\n💡 Auto-detecting optimal concurrency...');
    logConcurrencyRecommendation();
  } else {
    console.log(`\n✅ Using concurrency: ${concurrency}`);
    if (concurrency !== args.concurrency) {
      console.log(`   (adjusted from requested ${args.concurrency} based on system resources)`);
    }
    console.log('');
  }

  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   Dry Run: ${args.dryRun ? 'Yes' : 'No'}\n`);

  // Parse repository
  const { owner, repo } = parseRepository();
  console.log(`✅ Repository: ${owner}/${repo}\n`);

  // Get singleton Octokit client with connection pooling
  const octokit = getGitHubClient(config.githubToken);

  // Get issue numbers
  let issueNumbers = args.issues;

  if (!issueNumbers || issueNumbers.length === 0) {
    // Check for ISSUE_NUMBER env var (GitHub Actions)
    const envIssueNumber = process.env.ISSUE_NUMBER;
    if (envIssueNumber) {
      issueNumbers = [parseInt(envIssueNumber)];
    } else {
      console.error('❌ No issues specified. Use --issue or --issues flag.\n');
      printHelp();
      process.exit(1);
    }
  }

  console.log(`📋 Processing ${issueNumbers.length} issue(s): ${issueNumbers.join(', ')}\n`);

  // Fetch all issues in parallel (5-10x faster)
  console.log('📥 Fetching issues in parallel...');
  const issuePromises = issueNumbers.map(issueNumber =>
    fetchIssue(octokit, owner, repo, issueNumber),
  );

  const fetchedIssues = await Promise.all(issuePromises);
  const issues: Issue[] = fetchedIssues.filter((issue): issue is Issue => issue !== null);

  for (const issue of issues) {
    console.log(`✅ Fetched Issue #${issue.number}: ${issue.title}`);
  }

  if (issues.length === 0) {
    console.error('\n❌ No valid issues found');
    process.exit(1);
  }

  console.log('');

  // Create CoordinatorAgent
  const agent = new CoordinatorAgent(config);

  // Execute issues in parallel with concurrency control
  console.log(`🚀 Executing ${issues.length} issues with concurrency=${concurrency}...\n`);

  const results = await executeIssuesInParallel(agent, issues, concurrency, args.dryRun);

  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 All issues processed');
  console.log(`${'='.repeat(80)}\n`);

  // Calculate statistics
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const avgDuration = results.length > 0 ? totalDuration / results.length : 0;

  console.log('📊 Execution Summary:');
  console.log(`   Total Issues: ${issues.length}`);
  console.log(`   Completed: ${successCount} ✅`);
  console.log(`   Failed: ${failedCount} ❌`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Average Duration: ${(avgDuration / 1000).toFixed(2)}s per issue`);
  console.log(`   Concurrency: ${concurrency}`);
  console.log('');

  // List failed issues if any
  if (failedCount > 0) {
    console.log('❌ Failed Issues:');
    results.filter(r => r.status === 'failed').forEach(result => {
      console.log(`   #${result.issueNumber}: ${result.error}`);
    });
    console.log('');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

// Run main
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
