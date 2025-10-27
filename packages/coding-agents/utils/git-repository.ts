/**
 * GitRepository - Shared utility for Git repository operations
 *
 * Consolidates duplicate repository parsing logic used across:
 * - IssueAgent
 * - PRAgent
 *
 * This utility provides consistent repository information extraction from git remote.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RepositoryInfo {
  owner: string;
  repo: string;
  remoteUrl: string;
}

export class GitRepository {
  /**
   * Parse repository owner and name from git remote
   * Supports both HTTPS and SSH URLs:
   * - HTTPS: https://github.com/owner/repo.git
   * - SSH: git@github.com:owner/repo.git
   */
  static async parse(): Promise<RepositoryInfo> {
    try {
      const remoteUrl = await this.getRemoteUrl();
      const { owner, repo } = this.parseGitUrl(remoteUrl);

      return { owner, repo, remoteUrl };
    } catch (error) {
      throw new Error(`Failed to parse repository: ${(error as Error).message}`);
    }
  }

  /**
   * Get git remote URL for origin
   */
  private static async getRemoteUrl(): Promise<string> {
    try {
      const { stdout } = await execAsync('git remote get-url origin');
      return stdout.trim();
    } catch (error) {
      throw new Error('Failed to get git remote URL. Make sure you are in a git repository.');
    }
  }

  /**
   * Parse GitHub URL into owner and repo
   * Supports both HTTPS and SSH formats
   */
  private static parseGitUrl(url: string): { owner: string; repo: string } {
    // Remove trailing .git if present
    const cleanUrl = url.replace(/\.git$/, '');

    // Try HTTPS format: https://github.com/owner/repo
    const httpsMatch = cleanUrl.match(/https?:\/\/github\.com\/([^/]+)\/([^/]+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    // Try SSH format: git@github.com:owner/repo
    const sshMatch = cleanUrl.match(/git@github\.com:([^/]+)\/(.+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    throw new Error(`Unable to parse GitHub URL: ${url}`);
  }

  /**
   * Get current branch name
   */
  static async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      return stdout.trim();
    } catch (error) {
      throw new Error('Failed to get current branch');
    }
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  static async isClean(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      return stdout.trim() === '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get repository root directory
   */
  static async getRoot(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel');
      return stdout.trim();
    } catch (error) {
      throw new Error('Failed to get repository root');
    }
  }
}
