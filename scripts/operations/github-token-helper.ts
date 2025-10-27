/**
 * GitHub Token Helper
 *
 * Provides utilities for obtaining GitHub authentication tokens
 * with priority: gh CLI > environment variable
 */

import { execSync } from 'child_process';

/**
 * Get GitHub token synchronously
 *
 * Priority:
 * 1. GitHub CLI (gh auth token)
 * 2. GITHUB_TOKEN environment variable
 * 3. GH_TOKEN environment variable
 *
 * @returns GitHub personal access token
 * @throws Error if no token is found
 */
export function getGitHubTokenSync(): string {
  // Try GitHub CLI first (most secure)
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
    }).trim();

    if (token && token.length > 0) {
      return token;
    }
  } catch (error) {
    // gh CLI not available or not authenticated, continue to env vars
  }

  // Try GITHUB_TOKEN environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // Try GH_TOKEN environment variable (alternative)
  if (process.env.GH_TOKEN) {
    return process.env.GH_TOKEN;
  }

  // No token found
  throw new Error(
    'GitHub token not found. Please either:\n' +
    '  1. Authenticate with GitHub CLI: gh auth login\n' +
    '  2. Set GITHUB_TOKEN environment variable\n' +
    '  3. Set GH_TOKEN environment variable',
  );
}

/**
 * Get GitHub token asynchronously
 *
 * @returns Promise resolving to GitHub personal access token
 * @throws Error if no token is found
 */
export async function getGitHubToken(): Promise<string> {
  return getGitHubTokenSync();
}

/**
 * Check if GitHub token is available
 *
 * @returns true if a token can be obtained
 */
export function hasGitHubToken(): boolean {
  try {
    getGitHubTokenSync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate GitHub token format
 *
 * @param token Token to validate
 * @returns true if token format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  // GitHub tokens typically start with ghp_, gho_, ghu_, ghs_, or ghr_
  // Classic tokens are 40 characters hex
  const modernToken = /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+$/.test(token);
  const classicToken = /^[a-f0-9]{40}$/.test(token);

  return modernToken || classicToken;
}
