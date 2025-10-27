/**
 * Git Worktree Manager
 *
 * Manages Git worktrees for parallel issue processing.
 * Each issue gets its own worktree, enabling true parallel development.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface WorktreeInfo {
  path: string;
  branch: string;
  issueNumber: number;
}

export class WorktreeManager {
  private basePath: string;
  private worktrees: Map<number, WorktreeInfo> = new Map();

  constructor(basePath: string = '.worktrees') {
    this.basePath = path.resolve(basePath);
  }

  /**
   * Create a new worktree for an issue
   */
  async createWorktree(issueNumber: number): Promise<WorktreeInfo> {
    const branch = `issue-${issueNumber}`;
    const worktreePath = path.join(this.basePath, `issue-${issueNumber}`);

    // Ensure base directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }

    // Remove existing worktree if it exists
    if (fs.existsSync(worktreePath)) {
      await this.removeWorktree(issueNumber);
    }

    try {
      // Create worktree with new branch
      execSync(`git worktree add -b ${branch} "${worktreePath}" HEAD`, {
        stdio: 'pipe',
      });

      const info: WorktreeInfo = {
        path: worktreePath,
        branch,
        issueNumber,
      };

      this.worktrees.set(issueNumber, info);
      return info;
    } catch (error) {
      throw new Error(
        `Failed to create worktree for issue #${issueNumber}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(issueNumber: number): Promise<void> {
    await Promise.resolve(); // Ensure async for consistency
    const info = this.worktrees.get(issueNumber);
    if (!info) {
      // Try to remove by path even if not in map
      const worktreePath = path.join(this.basePath, `issue-${issueNumber}`);
      if (fs.existsSync(worktreePath)) {
        try {
          execSync(`git worktree remove "${worktreePath}" --force`, {
            stdio: 'pipe',
          });
        } catch (error) {
          // Ignore errors
        }
      }
      return;
    }

    try {
      execSync(`git worktree remove "${info.path}" --force`, {
        stdio: 'pipe',
      });
      this.worktrees.delete(issueNumber);
    } catch (error) {
      console.warn(
        `Warning: Failed to remove worktree for issue #${issueNumber}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get worktree info for an issue
   */
  getWorktree(issueNumber: number): WorktreeInfo | undefined {
    return this.worktrees.get(issueNumber);
  }

  /**
   * List all managed worktrees
   */
  listWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * Execute a command in a worktree
   */
  async execInWorktree(
    issueNumber: number,
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    await Promise.resolve(); // Ensure async for consistency
    const info = this.worktrees.get(issueNumber);
    if (!info) {
      throw new Error(`Worktree not found for issue #${issueNumber}`);
    }

    try {
      const stdout = execSync(command, {
        cwd: info.path,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      return { stdout, stderr: '' };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
      };
    }
  }

  /**
   * Clean up all worktrees
   */
  async cleanup(): Promise<void> {
    const issues = Array.from(this.worktrees.keys());
    for (const issueNumber of issues) {
      await this.removeWorktree(issueNumber);
    }

    // Remove base directory if empty
    try {
      if (fs.existsSync(this.basePath)) {
        const files = fs.readdirSync(this.basePath);
        if (files.length === 0) {
          fs.rmdirSync(this.basePath);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Get all existing worktrees from git
   */
  static listAllWorktrees(): Array<{ path: string; branch: string }> {
    try {
      const output = execSync('git worktree list --porcelain', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const worktrees: Array<{ path: string; branch: string }> = [];
      const lines = output.split('\n');
      let currentWorktree: any = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentWorktree.path = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line
            .substring('branch '.length)
            .replace('refs/heads/', '');
          worktrees.push({ ...currentWorktree });
          currentWorktree = {};
        }
      }

      return worktrees;
    } catch (error) {
      return [];
    }
  }

  /**
   * Prune stale worktrees
   */
  static pruneWorktrees(): void {
    try {
      execSync('git worktree prune', { stdio: 'pipe' });
    } catch (error) {
      // Ignore errors
    }
  }
}
