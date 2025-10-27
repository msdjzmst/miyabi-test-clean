/**
 * Miyabi Auth Command
 *
 * OAuth-based authentication for secure GitHub access
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { githubOAuth } from '../auth/github-oauth';
import {
  saveCredentials,
  loadCredentials,
  deleteCredentials,
  verifyToken,
} from '../auth/credentials';
import { Octokit } from '@octokit/rest';

/**
 * Login command - OAuth Device Flow
 */
export async function authLogin(): Promise<void> {
  console.log(chalk.cyan.bold('\n🔐 GitHub OAuth Login\n'));

  // Check if already logged in
  const existing = loadCredentials();
  if (existing) {
    console.log(chalk.yellow('You are already logged in.'));
    console.log(chalk.gray('Run `miyabi auth status` to check your authentication.\n'));

    // Ask if user wants to re-authenticate
    // For now, just show message (can add interactive prompt later)
    console.log(chalk.white('To re-authenticate, first run: miyabi auth logout\n'));
    return;
  }

  // Start OAuth flow
  const token = await githubOAuth();

  // Save to credentials file
  saveCredentials(token);

  // Show authenticated user info
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();

    console.log(chalk.green.bold('\n✅ Successfully authenticated!\n'));
    console.log(chalk.white(`Logged in as: ${chalk.cyan(user.login)}`));
    console.log(chalk.gray(`User ID: ${user.id}`));
    console.log(chalk.gray(`Profile: ${user.html_url}\n`));

    // Show next steps
    console.log(chalk.cyan.bold('🚀 Next Steps:\n'));
    console.log(chalk.white('  1. Check available agents:'));
    console.log(chalk.gray('     miyabi agent list\n'));
    console.log(chalk.white('  2. Run an agent:'));
    console.log(chalk.gray('     miyabi agent run codegen --issue=123\n'));
    console.log(chalk.white('  3. Check project status:'));
    console.log(chalk.gray('     miyabi status\n'));
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Could not fetch user info\n'));
  }
}

/**
 * Logout command - Delete credentials
 */
export async function authLogout(): Promise<void> {
  console.log(chalk.cyan.bold('\n🔓 GitHub Logout\n'));

  const existing = loadCredentials();
  if (!existing) {
    console.log(chalk.yellow('You are not logged in.\n'));
    return;
  }

  deleteCredentials();
  console.log(chalk.green('✅ Successfully logged out.\n'));
}

/**
 * Status command - Check authentication status
 */
export async function authStatus(): Promise<void> {
  console.log(chalk.cyan.bold('\n📊 Authentication Status\n'));

  // Check environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    console.log(chalk.yellow('⚠️  Using GITHUB_TOKEN from environment variable'));
    console.log(chalk.gray('   (OAuth credentials will be ignored)\n'));

    // Verify environment token
    const isValid = await verifyToken(envToken);
    if (isValid) {
      console.log(chalk.green('✓ Token is valid\n'));
    } else {
      console.log(chalk.red('✗ Token is invalid or expired\n'));
    }
    return;
  }

  // Check credentials file
  const credentials = loadCredentials();
  if (!credentials) {
    console.log(chalk.yellow('Not authenticated.'));
    console.log(chalk.gray('Run `miyabi auth login` to authenticate.\n'));
    return;
  }

  // Verify token
  console.log(chalk.gray('Verifying token...'));
  const isValid = await verifyToken(credentials.github_token);

  if (!isValid) {
    console.log(chalk.red('\n✗ Token is invalid or expired'));
    console.log(chalk.gray('Run `miyabi auth login` to re-authenticate.\n'));
    return;
  }

  // Show authenticated user info
  try {
    const octokit = new Octokit({ auth: credentials.github_token });
    const { data: user } = await octokit.users.getAuthenticated();

    console.log(chalk.green('✓ Authenticated\n'));
    console.log(chalk.white(`User: ${chalk.cyan(user.login)}`));
    console.log(chalk.gray(`ID: ${user.id}`));
    console.log(chalk.gray(`Created: ${credentials.created_at}`));
    console.log(chalk.gray(`Profile: ${user.html_url}\n`));
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Could not fetch user info\n'));
  }
}

/**
 * Register auth command
 */
export function registerAuthCommand(program: Command): void {
  const auth = program
    .command('auth')
    .description('🔐 GitHub authentication management');

  auth
    .command('login')
    .description('Login with GitHub OAuth')
    .action(async () => {
      try {
        await authLogin();
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}\n`));
        }
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Logout and remove credentials')
    .action(async () => {
      try {
        await authLogout();
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}\n`));
        }
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        await authStatus();
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}\n`));
        }
        process.exit(1);
      }
    });
}
