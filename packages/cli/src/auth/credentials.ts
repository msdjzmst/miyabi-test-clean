/**
 * Credentials Storage - Global Token Management
 *
 * Stores GitHub OAuth tokens in ~/.miyabi/credentials.json
 * Provides secure token storage and retrieval
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Octokit } from '@octokit/rest';
import chalk from 'chalk';

export interface Credentials {
  github_token: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get credentials directory path
 */
function getCredentialsDir(): string {
  return path.join(os.homedir(), '.miyabi');
}

/**
 * Get credentials file path
 */
function getCredentialsPath(): string {
  return path.join(getCredentialsDir(), 'credentials.json');
}

/**
 * Ensure credentials directory exists
 */
function ensureCredentialsDir(): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // rwx------ (owner only)
  }
}

/**
 * Save credentials to file
 */
export function saveCredentials(token: string): void {
  ensureCredentialsDir();

  const credentials: Credentials = {
    github_token: token,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const credPath = getCredentialsPath();
  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), {
    encoding: 'utf-8',
    mode: 0o600, // rw------- (owner only)
  });

  console.log(chalk.gray(`✓ Credentials saved to ${credPath}`));
}

/**
 * Load credentials from file
 */
export function loadCredentials(): Credentials | null {
  const credPath = getCredentialsPath();

  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(credPath, 'utf-8');
    const credentials = JSON.parse(content) as Credentials;

    if (!credentials.github_token) {
      console.log(chalk.yellow('⚠️  Invalid credentials file'));
      return null;
    }

    return credentials;
  } catch (error) {
    console.log(chalk.red(`Failed to load credentials: ${error}`));
    return null;
  }
}

/**
 * Delete credentials file
 */
export function deleteCredentials(): void {
  const credPath = getCredentialsPath();

  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath);
    console.log(chalk.gray(`✓ Credentials deleted from ${credPath}`));
  }
}

/**
 * Get GitHub token from credentials or environment
 */
export function getGitHubToken(): string | null {
  // 1. Check environment variable (backward compatibility)
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    return envToken;
  }

  // 2. Check credentials file
  const credentials = loadCredentials();
  if (credentials) {
    return credentials.github_token;
  }

  return null;
}

/**
 * Verify token is valid and has access to repository
 */
export async function verifyTokenAccess(
  token: string,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });

    // Check user authentication
    await octokit.users.getAuthenticated();

    // Check repository access
    await octokit.repos.get({ owner, repo });

    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.yellow(`⚠️  Token verification failed: ${error.message}`));
    }
    return false;
  }
}

/**
 * Verify token is valid
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.users.getAuthenticated();
    return true;
  } catch (error) {
    return false;
  }
}
