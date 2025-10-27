/**
 * status command - Check agent status and activity
 * AI-friendly with --json output support
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { Octokit } from '@octokit/rest';
import {
  isJsonMode,
  outputSuccess,
  outputError,
  logVerbose,
  getGitHubToken
} from '../utils/agent-output';

export interface StatusOptions {
  watch?: boolean;
  json?: boolean;
}

export interface StatusData {
  repository: {
    owner: string;
    name: string;
    url: string;
  };
  issues: {
    total: number;
    byState: {
      pending: number;
      analyzing: number;
      implementing: number;
      reviewing: number;
      blocked: number;
      paused: number;
    };
  };
  pullRequests: Array<{
    number: number;
    title: string;
    url: string;
    createdAt: string;
  }>;
  summary: {
    totalOpen: number;
    activeAgents: number;
    blocked: number;
  };
}

export async function status(options: StatusOptions = {}) {
  logVerbose('Starting status check...');

  const token = getGitHubToken();
  const octokit = new Octokit({ auth: token });

  // Get current repository
  const repo = await getCurrentRepo();

  if (!repo) {
    // Use appropriate exit code (will be mapped to VALIDATION_ERROR = 3)
    const output = {
      success: false,
      error: {
        code: 'NO_GIT_REPOSITORY',
        message: 'Not a git repository or no origin remote found',
        recoverable: true,
        suggestion: 'Run this command inside a git repository with a GitHub remote'
      },
      timestamp: new Date().toISOString()
    };

    if (isJsonMode() || options.json) {
      console.error(JSON.stringify(output, null, 2));
    } else {
      console.error(`❌ ${output.error.message}`);
      if (output.error.suggestion) {
        console.error(`\n💡 ${output.error.suggestion}`);
      }
    }
    process.exit(3); // VALIDATION_ERROR
  }

  logVerbose(`Repository: ${repo.owner}/${repo.name}`);

  try {
    // Fetch status
    const statusData = await getStatusData(octokit, repo.owner, repo.name);

    if (isJsonMode() || options.json) {
      outputSuccess(statusData, 'Status retrieved successfully');
    } else {
      displayStatusHuman(statusData);

      if (options.watch) {
        console.log(chalk.gray('\n👀 Watch mode active (refreshing every 10s)...'));
        console.log(chalk.gray('Press Ctrl+C to exit\n'));

        setInterval(async () => {
          console.clear();
          try {
            const data = await getStatusData(octokit, repo.owner, repo.name);
            displayStatusHuman(data);
          } catch (error) {
            console.log(chalk.red('\n⚠️  ステータスの取得に失敗しました'));
            if (error instanceof Error) {
              console.log(chalk.gray(`原因: ${error.message}\n`));
            }
          }
        }, 10000);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        outputError(
          'REPOSITORY_NOT_FOUND',
          'Repository not found or no access',
          true,
          'Check repository permissions and GITHUB_TOKEN scope'
        );
      }
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        outputError(
          'AUTH_INVALID_TOKEN',
          'Authentication failed - token is invalid',
          true,
          'Generate a new GITHUB_TOKEN: https://github.com/settings/tokens'
        );
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        outputError(
          'AUTH_INSUFFICIENT_PERMISSIONS',
          'Access denied - insufficient permissions',
          true,
          'Ensure GITHUB_TOKEN has repo scope'
        );
      }
      outputError(
        'NETWORK_ERROR',
        `Failed to fetch status: ${error.message}`,
        true,
        'Check network connection and GitHub API status'
      );
    }
    throw error;
  }
}

async function getCurrentRepo(): Promise<{ owner: string; name: string } | null> {
  try {
    const { execSync } = await import('child_process');
    // Suppress stderr in JSON mode to avoid polluting output
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();

    logVerbose(`Remote URL: ${remoteUrl}`);

    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);

    if (match) {
      return { owner: match[1], name: match[2] };
    }
  } catch (error) {
    logVerbose('Failed to get git remote', error);
    return null;
  }

  return null;
}

async function getStatusData(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<StatusData> {
  logVerbose(`Fetching issues for ${owner}/${repo}...`);

  // Fetch open issues
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  logVerbose(`Found ${issues.length} open issues`);

  // Count by state
  const states = {
    pending: 0,
    analyzing: 0,
    implementing: 0,
    reviewing: 0,
    blocked: 0,
    paused: 0,
  };

  for (const issue of issues) {
    for (const label of issue.labels) {
      const labelName = typeof label === 'string' ? label : label.name || '';

      if (labelName.includes('state:pending')) states.pending++;
      else if (labelName.includes('state:analyzing')) states.analyzing++;
      else if (labelName.includes('state:implementing')) states.implementing++;
      else if (labelName.includes('state:reviewing')) states.reviewing++;
      else if (labelName.includes('state:blocked')) states.blocked++;
      else if (labelName.includes('state:paused')) states.paused++;
    }
  }

  // Fetch recent PRs
  logVerbose('Fetching recent pull requests...');

  const { data: recentPRs } = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'desc',
    per_page: 5,
  });

  logVerbose(`Found ${recentPRs.length} open pull requests`);

  const totalActive = states.analyzing + states.implementing + states.reviewing;

  return {
    repository: {
      owner,
      name: repo,
      url: `https://github.com/${owner}/${repo}`,
    },
    issues: {
      total: issues.length,
      byState: states,
    },
    pullRequests: recentPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      createdAt: pr.created_at,
    })),
    summary: {
      totalOpen: issues.length,
      activeAgents: totalActive,
      blocked: states.blocked,
    },
  };
}

function displayStatusHuman(data: StatusData) {
  console.log(
    chalk.cyan.bold(`\n📊 Agentic OS Status - ${data.repository.owner}/${data.repository.name}\n`)
  );

  // Display table
  const table = new Table({
    head: ['State', 'Count', 'Status'],
    style: { head: ['cyan'] },
  });

  table.push(
    [
      '📥 Pending',
      data.issues.byState.pending.toString(),
      data.issues.byState.pending > 0 ? '⏳ Waiting' : '✓ Clear',
    ],
    [
      '🔍 Analyzing',
      data.issues.byState.analyzing.toString(),
      data.issues.byState.analyzing > 0 ? '🔄 Active' : '✓ Clear',
    ],
    [
      '🏗️  Implementing',
      data.issues.byState.implementing.toString(),
      data.issues.byState.implementing > 0 ? '⚡ Working' : '✓ Clear',
    ],
    [
      '👀 Reviewing',
      data.issues.byState.reviewing.toString(),
      data.issues.byState.reviewing > 0 ? '🔍 Checking' : '✓ Clear',
    ],
    [
      '🚫 Blocked',
      data.issues.byState.blocked.toString(),
      data.issues.byState.blocked > 0 ? '⚠️  Needs help' : '✓ Clear',
    ],
    [
      '⏸️  Paused',
      data.issues.byState.paused.toString(),
      data.issues.byState.paused > 0 ? '💤 Sleeping' : '✓ Clear',
    ]
  );

  console.log(table.toString());

  // Recent activity
  if (data.pullRequests.length > 0) {
    console.log(chalk.cyan('\n📝 Recent Pull Requests:\n'));

    for (const pr of data.pullRequests) {
      console.log(chalk.white(`  #${pr.number} ${pr.title}`));
      console.log(chalk.gray(`    ${pr.url}\n`));
    }
  }

  // Summary
  console.log(chalk.cyan('📈 Summary:\n'));
  console.log(chalk.white(`  Total open Issues: ${data.summary.totalOpen}`));
  console.log(chalk.white(`  Active agents: ${data.summary.activeAgents}`));
  console.log(chalk.white(`  Blocked: ${data.summary.blocked}`));
  console.log();
}
