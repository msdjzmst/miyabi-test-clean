/**
 * GitHub Token Helper
 *
 * Securely retrieves GitHub token with the following priority:
 * 1. gh CLI authentication (recommended)
 * 2. GITHUB_TOKEN environment variable (fallback for CI/CD)
 * 3. Throws error if neither is available
 */

import { execSync } from 'child_process';

/**
 * Get GitHub token with priority: gh CLI > environment variable
 * @returns GitHub personal access token
 * @throws Error if no valid token is found
 */
export async function getGitHubToken(): Promise<string> {
  // Priority 1: Try gh CLI authentication
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();

    if (token && (token.startsWith('ghp_') || token.startsWith('github_pat_') || token.startsWith('gho_'))) {
      console.log('✅ Using GitHub token from gh CLI');
      return token;
    }
  } catch (error) {
    // gh CLI not available or not authenticated, try fallback
  }

  // Priority 2: Check environment variable (for CI/CD)
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    if (envToken.startsWith('ghp_') || envToken.startsWith('github_pat_') || envToken.startsWith('gho_')) {
      console.log('✅ Using GitHub token from GITHUB_TOKEN environment variable');
      return envToken;
    } else {
      console.warn('⚠️  GITHUB_TOKEN environment variable found but format looks invalid');
    }
  }

  // No valid token found
  throw new Error(
    'GitHub token not found. Please authenticate using one of these methods:\n' +
    '  1. Run: gh auth login (recommended)\n' +
    '  2. Set GITHUB_TOKEN environment variable\n' +
    '  3. Create .env file with GITHUB_TOKEN=ghp_xxx',
  );
}

/**
 * Synchronous version of getGitHubToken for compatibility
 * @returns GitHub personal access token
 * @throws Error if no valid token is found
 */
export function getGitHubTokenSync(): string {
  // Priority 1: Try gh CLI authentication
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (token && (token.startsWith('ghp_') || token.startsWith('github_pat_') || token.startsWith('gho_'))) {
      return token;
    }
  } catch (error) {
    // gh CLI not available, try fallback
  }

  // Priority 2: Check environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken && (envToken.startsWith('ghp_') || envToken.startsWith('github_pat_') || envToken.startsWith('gho_'))) {
    return envToken;
  }

  // No valid token found
  throw new Error(
    'GitHub token not found. Please authenticate using:\n' +
    '  gh auth login  (or)  export GITHUB_TOKEN=ghp_xxx',
  );
}

/**
 * Check if gh CLI is available and authenticated
 * @returns true if gh CLI is authenticated
 */
export function isGhCliAuthenticated(): boolean {
  try {
    execSync('gh auth status', {
      encoding: 'utf-8',
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate token format (basic check)
 * @param token GitHub token to validate
 * @returns true if token format looks valid
 */
export function isValidTokenFormat(token: string): boolean {
  return token.startsWith('ghp_') || token.startsWith('github_pat_') || token.startsWith('gho_');
}
