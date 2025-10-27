/**
 * Health check and diagnostics command
 * Validates system setup and provides actionable fixes
 */

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';
import { Octokit } from '@octokit/rest';
import { getGitHubToken } from '../utils/github-token';

/**
 * Get GitHub token without throwing error
 */
async function getGitHubTokenSafe(): Promise<string | null> {
  try {
    return await getGitHubToken();
  } catch {
    return null;
  }
}

export interface DoctorOptions {
  json?: boolean;
  verbose?: boolean;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
  details?: string;
}

export interface DoctorResult {
  checks: HealthCheck[];
  summary: {
    passed: number;
    warned: number;
    failed: number;
    total: number;
  };
  overallStatus: 'healthy' | 'issues' | 'critical';
}

/**
 * Run health check diagnostics
 */
export async function doctor(options: DoctorOptions = {}): Promise<void> {
  if (!options.json) {
    console.log(chalk.cyan.bold('\n🩺 Miyabi Health Check\n'));
  }

  const spinner = options.json ? null : ora('Running diagnostics...').start();

  try {
    const checks: HealthCheck[] = [];

    // 1. Check Node.js version
    checks.push(await checkNodeVersion());

    // 2. Check Git installation
    checks.push(await checkGit());

    // 3. Check GitHub CLI
    checks.push(await checkGitHubCLI());

    // 4. Check GITHUB_TOKEN
    checks.push(await checkGitHubToken());

    // 5. Check token permissions
    const tokenCheck = checks.find((c) => c.name === 'GITHUB_TOKEN');
    if (tokenCheck?.status === 'pass') {
      checks.push(await checkTokenPermissions());
    }

    // 6. Check network connectivity
    checks.push(await checkNetworkConnectivity());

    // 7. Check repository configuration (if in git repo)
    const repoCheck = await checkRepositoryConfig();
    if (repoCheck) {
      checks.push(repoCheck);
    }

    // 8. Check .miyabi.yml (if exists)
    const configCheck = await checkMiyabiConfig();
    if (configCheck) {
      checks.push(configCheck);
    }

    // 9. Check Claude Code environment
    checks.push(checkClaudeCodeEnvironment());

    spinner?.stop();

    // Calculate summary
    const summary = {
      passed: checks.filter((c) => c.status === 'pass').length,
      warned: checks.filter((c) => c.status === 'warn').length,
      failed: checks.filter((c) => c.status === 'fail').length,
      total: checks.length,
    };

    const overallStatus: 'healthy' | 'issues' | 'critical' =
      summary.failed > 0 ? 'critical' : summary.warned > 0 ? 'issues' : 'healthy';

    const result: DoctorResult = {
      checks,
      summary,
      overallStatus,
    };

    // Output results
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayResults(result, options.verbose);
    }

    // Exit with appropriate code
    if (overallStatus === 'critical') {
      process.exit(1);
    }
  } catch (error) {
    spinner?.fail('Diagnostics failed');
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<HealthCheck> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 18) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: `${version} (OK)`,
      details: `Node.js ${version} meets minimum requirement (≥18)`,
    };
  } else {
    return {
      name: 'Node.js',
      status: 'fail',
      message: `${version} (Outdated)`,
      suggestion: 'Upgrade to Node.js 18 or higher: https://nodejs.org',
      details: `Node.js ${version} is below minimum requirement (≥18)`,
    };
  }
}

/**
 * Check Git installation
 */
async function checkGit(): Promise<HealthCheck> {
  try {
    const version = execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    return {
      name: 'Git',
      status: 'pass',
      message: `${version} (OK)`,
      details: 'Git is installed and accessible',
    };
  } catch (error) {
    return {
      name: 'Git',
      status: 'fail',
      message: 'Not installed',
      suggestion: 'Install Git: https://git-scm.com/downloads',
      details: 'Git is required for repository operations',
    };
  }
}

/**
 * Check GitHub CLI
 */
async function checkGitHubCLI(): Promise<HealthCheck> {
  try {
    const version = execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' })
      .split('\n')[0]
      .trim();

    // Check if authenticated
    try {
      execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
      return {
        name: 'GitHub CLI',
        status: 'pass',
        message: `${version} (Authenticated)`,
        details: 'GitHub CLI is installed and authenticated',
      };
    } catch {
      return {
        name: 'GitHub CLI',
        status: 'warn',
        message: `${version} (Not authenticated)`,
        suggestion: "Run 'gh auth login' to authenticate",
        details: 'GitHub CLI is installed but not authenticated',
      };
    }
  } catch (error) {
    return {
      name: 'GitHub CLI',
      status: 'warn',
      message: 'Not installed',
      suggestion: 'Install GitHub CLI: https://cli.github.com',
      details: 'GitHub CLI provides easier authentication (recommended but optional)',
    };
  }
}

/**
 * Check GITHUB_TOKEN
 */
async function checkGitHubToken(): Promise<HealthCheck> {
  try {
    const token = await getGitHubTokenSafe();
    if (token) {
      // Validate token format
      if (token.startsWith('ghp_') || token.startsWith('github_pat_')) {
        return {
          name: 'GITHUB_TOKEN',
          status: 'pass',
          message: 'Valid token format',
          details: 'GitHub Personal Access Token is set and has valid format',
        };
      } else {
        return {
          name: 'GITHUB_TOKEN',
          status: 'warn',
          message: 'Unusual token format',
          suggestion: 'Verify your token is a valid GitHub Personal Access Token',
          details: 'Token does not match expected format (ghp_* or github_pat_*)',
        };
      }
    } else {
      return {
        name: 'GITHUB_TOKEN',
        status: 'fail',
        message: 'Not set',
        suggestion: "Set GITHUB_TOKEN environment variable or run 'gh auth login'",
        details: 'GitHub token is required for API operations',
      };
    }
  } catch (error) {
    return {
      name: 'GITHUB_TOKEN',
      status: 'fail',
      message: 'Error checking token',
      suggestion: 'Verify your GitHub authentication setup',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check token permissions
 */
async function checkTokenPermissions(): Promise<HealthCheck> {
  try {
    const token = await getGitHubTokenSafe();
    if (!token) {
      return {
        name: 'Token Permissions',
        status: 'fail',
        message: 'No token to check',
        details: 'Cannot check permissions without a token',
      };
    }

    const octokit = new Octokit({ auth: token });

    // Get token scopes from API
    const { headers } = await octokit.rest.users.getAuthenticated();
    const scopes = (headers['x-oauth-scopes'] || '').split(',').map((s) => s.trim());

    // Required scopes
    const required = ['repo', 'workflow'];
    const recommended = ['project', 'write:packages'];

    const missingRequired = required.filter((s) => !scopes.includes(s));
    const missingRecommended = recommended.filter((s) => !scopes.includes(s));

    if (missingRequired.length === 0 && missingRecommended.length === 0) {
      return {
        name: 'Token Permissions',
        status: 'pass',
        message: 'All required and recommended scopes present',
        details: `Scopes: ${scopes.join(', ')}`,
      };
    } else if (missingRequired.length === 0) {
      return {
        name: 'Token Permissions',
        status: 'warn',
        message: `Missing recommended scopes: ${missingRecommended.join(', ')}`,
        suggestion: 'Add recommended scopes for full functionality: https://github.com/settings/tokens',
        details: `Current scopes: ${scopes.join(', ')}`,
      };
    } else {
      return {
        name: 'Token Permissions',
        status: 'fail',
        message: `Missing required scopes: ${missingRequired.join(', ')}`,
        suggestion: 'Update token with required scopes: https://github.com/settings/tokens',
        details: `Current scopes: ${scopes.join(', ')}`,
      };
    }
  } catch (error) {
    return {
      name: 'Token Permissions',
      status: 'warn',
      message: 'Unable to verify permissions',
      suggestion: 'Verify token has repo and workflow scopes',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check network connectivity to GitHub API
 */
async function checkNetworkConnectivity(): Promise<HealthCheck> {
  try {
    const token = await getGitHubTokenSafe();
    const octokit = new Octokit({ auth: token || undefined });

    // Try to fetch rate limit (lightweight request)
    await octokit.rest.rateLimit.get();

    return {
      name: 'Network Connectivity',
      status: 'pass',
      message: 'GitHub API accessible',
      details: 'Successfully connected to GitHub API',
    };
  } catch (error) {
    return {
      name: 'Network Connectivity',
      status: 'fail',
      message: 'Cannot reach GitHub API',
      suggestion: 'Check internet connection and firewall settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check repository configuration
 */
async function checkRepositoryConfig(): Promise<HealthCheck | null> {
  try {
    // Check if we're in a git repository
    const gitDir = execSync('git rev-parse --git-dir', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    if (!gitDir) return null;

    // Get remote URL
    try {
      const remoteUrl = execSync('git remote get-url origin', {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();

      return {
        name: 'Repository',
        status: 'pass',
        message: 'Git repository detected',
        details: `Remote: ${remoteUrl}`,
      };
    } catch {
      return {
        name: 'Repository',
        status: 'warn',
        message: 'No remote configured',
        suggestion: 'Add remote: git remote add origin <url>',
        details: 'Local git repository without remote',
      };
    }
  } catch {
    return null; // Not in a git repository
  }
}

/**
 * Check .miyabi.yml configuration
 */
async function checkMiyabiConfig(): Promise<HealthCheck | null> {
  const configPath = join(process.cwd(), '.miyabi.yml');

  if (!existsSync(configPath)) {
    return null; // Config file doesn't exist (optional)
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content);

    // Validate structure
    if (!config || typeof config !== 'object') {
      return {
        name: '.miyabi.yml',
        status: 'fail',
        message: 'Invalid configuration',
        suggestion: 'Fix .miyabi.yml syntax errors',
        details: 'Configuration file is not valid YAML or is empty',
      };
    }

    return {
      name: '.miyabi.yml',
      status: 'pass',
      message: 'Valid configuration',
      details: 'Configuration file parsed successfully',
    };
  } catch (error) {
    return {
      name: '.miyabi.yml',
      status: 'fail',
      message: 'Parse error',
      suggestion: 'Fix .miyabi.yml syntax errors',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Claude Code environment
 */
function checkClaudeCodeEnvironment(): HealthCheck {
  const isClaudeCode =
    process.env.CLAUDE_CODE === 'true' ||
    process.env.ANTHROPIC_CLI === 'true' ||
    process.env.TERM_PROGRAM === 'Claude' ||
    !!process.env.ANTHROPIC_API_KEY;

  if (isClaudeCode) {
    return {
      name: 'Claude Code',
      status: 'pass',
      message: 'Environment detected',
      details: 'Running in Claude Code environment',
    };
  } else {
    return {
      name: 'Claude Code',
      status: 'pass',
      message: 'Standard terminal',
      details: 'Not running in Claude Code (this is OK)',
    };
  }
}

/**
 * Display results in human-readable format
 */
function displayResults(result: DoctorResult, verbose?: boolean): void {
  console.log('');

  // Display each check
  for (const check of result.checks) {
    let icon: string;
    let color: typeof chalk.green;

    switch (check.status) {
      case 'pass':
        icon = '✓';
        color = chalk.green;
        break;
      case 'warn':
        icon = '⚠';
        color = chalk.yellow;
        break;
      case 'fail':
        icon = '✗';
        color = chalk.red;
        break;
    }

    console.log(color(`  ${icon} ${check.name}: ${check.message}`));

    if (verbose && check.details) {
      console.log(chalk.gray(`    ${check.details}`));
    }

    if (check.suggestion) {
      console.log(chalk.gray(`    💡 ${check.suggestion}`));
    }

    console.log('');
  }

  // Display summary
  console.log(chalk.cyan.bold('Summary:'));
  console.log(chalk.green(`  ✓ ${result.summary.passed} checks passed`));
  if (result.summary.warned > 0) {
    console.log(chalk.yellow(`  ⚠ ${result.summary.warned} warnings`));
  }
  if (result.summary.failed > 0) {
    console.log(chalk.red(`  ✗ ${result.summary.failed} checks failed`));
  }
  console.log(chalk.gray(`  ${result.summary.total} total checks\n`));

  // Overall status
  switch (result.overallStatus) {
    case 'healthy':
      console.log(chalk.green.bold('✓ Overall: Healthy\n'));
      break;
    case 'issues':
      console.log(chalk.yellow.bold('⚠ Overall: Issues detected (but not critical)\n'));
      break;
    case 'critical':
      console.log(chalk.red.bold('✗ Overall: Critical issues found\n'));
      break;
  }

  // Next steps
  if (result.summary.failed > 0 || result.summary.warned > 0) {
    console.log(chalk.cyan.bold('Next Steps:'));
    console.log(
      chalk.gray('  1. Review the suggestions above to fix issues')
    );
    console.log(chalk.gray('  2. Run this command again to verify fixes'));
    console.log(chalk.gray('  3. For help: https://github.com/ShunsukeHayashi/Miyabi/issues\n'));
  }
}
