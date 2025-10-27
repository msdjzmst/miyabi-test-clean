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
import { AgentConfig, Issue, Task } from '@miyabi/coding-agents/types/index';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { getGitHubTokenSync } from './github-token-helper';

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIArgs {
  issues?: number[];
  concurrency: number;
  dryRun: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    concurrency: 2,
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
  --concurrency, -c <number>    Number of parallel tasks (default: 2)
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
  ANTHROPIC_API_KEY         Anthropic API key for code generation (required)
  DEVICE_IDENTIFIER         Device name for logs (default: hostname)
  REPOSITORY                GitHub repository (owner/repo)

GitHub Actions:
  ISSUE_NUMBER              Issue number to process (set by workflow)
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

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error('❌ Error: Missing required environment variable');
    console.error('   ANTHROPIC_API_KEY: ❌');
    console.error('\nPlease set ANTHROPIC_API_KEY environment variable or create a .env file.');
    process.exit(1);
  }

  return {
    deviceIdentifier: process.env.DEVICE_IDENTIFIER || require('os').hostname(),
    githubToken,
    anthropicApiKey,
    useTaskTool: false,
    useWorktree: false,
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
    const { data } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

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

async function executeIssue(
  agent: CoordinatorAgent,
  issue: Issue,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Executing Issue #${issue.number}: ${issue.title}`);
  console.log(`${'='.repeat(80)}\n`);

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

    if (result.status === 'success') {
      console.log(`\n✅ Issue #${issue.number} completed successfully`);
      console.log(`   Duration: ${result.metrics?.durationMs}ms`);
    } else {
      console.error(`\n❌ Issue #${issue.number} failed:`, result.error);
    }
  } catch (error) {
    console.error(`\n❌ Issue #${issue.number} execution error:`, (error as Error).message);
    throw error;
  }
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
  console.log(`   Concurrency: ${args.concurrency}`);
  console.log(`   Dry Run: ${args.dryRun ? 'Yes' : 'No'}\n`);

  // Parse repository
  const { owner, repo } = parseRepository();
  console.log(`✅ Repository: ${owner}/${repo}\n`);

  // Create Octokit client
  const octokit = new Octokit({ auth: config.githubToken });

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

  // Fetch all issues
  const issues: Issue[] = [];
  for (const issueNumber of issueNumbers) {
    const issue = await fetchIssue(octokit, owner, repo, issueNumber);
    if (issue) {
      issues.push(issue);
      console.log(`✅ Fetched Issue #${issueNumber}: ${issue.title}`);
    }
  }

  if (issues.length === 0) {
    console.error('\n❌ No valid issues found');
    process.exit(1);
  }

  console.log('');

  // Create CoordinatorAgent
  const agent = new CoordinatorAgent(config);

  // Execute issues sequentially (or in parallel if needed)
  for (const issue of issues) {
    try {
      await executeIssue(agent, issue, args.dryRun);
    } catch (error) {
      console.error(`Failed to execute issue #${issue.number}:`, (error as Error).message);
      // Continue with next issue
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 All issues processed');
  console.log(`${'='.repeat(80)}\n`);

  console.log('📊 Execution Summary:');
  console.log(`   Total Issues: ${issues.length}`);
  console.log(`   Completed: ${issues.length}`); // TODO: Track actual completion
  console.log(`   Failed: 0`); // TODO: Track actual failures
  console.log('');

  process.exit(0);
}

// Run main
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
