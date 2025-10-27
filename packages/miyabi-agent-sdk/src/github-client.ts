/**
 * Miyabi Agent SDK - GitHub Client Helper
 *
 * This module provides helper functions for interacting with GitHub API.
 * All API calls are automatically wrapped with retry logic for resilience.
 */

import type { GitHubIssue } from './types';
import { withRetry, type GitHubRetryConfig } from './retry-config';

/**
 * GitHub client options
 */
export interface GitHubClientOptions {
  owner: string;
  repo: string;
  token: string;
  /** Optional retry configuration (uses defaults if not specified) */
  retryConfig?: Partial<GitHubRetryConfig>;
}

/**
 * Simplified GitHub client for agent operations
 * Note: This is a lightweight wrapper. For full functionality,
 * use @octokit/rest directly in your agent implementation.
 *
 * All API calls are automatically wrapped with retry logic for resilience
 * against transient failures (rate limits, network errors, server errors).
 */
export class GitHubClient {
  private options: GitHubClientOptions;
  private retryConfig?: Partial<GitHubRetryConfig>;

  constructor(options: GitHubClientOptions) {
    this.options = options;
    this.retryConfig = options.retryConfig;
  }

  /**
   * Get GitHub API base URL
   */
  get apiUrl(): string {
    return 'https://api.github.com';
  }

  /**
   * Get repository full name
   */
  get repoFullName(): string {
    return `${this.options.owner}/${this.options.repo}`;
  }

  /**
   * Create authorization header
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.options.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch issue data (with automatic retry on transient failures)
   */
  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    return withRetry(async () => {
      const url = `${this.apiUrl}/repos/${this.repoFullName}/issues/${issueNumber}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error: any = new Error(
          `Failed to fetch issue #${issueNumber}: ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      return this.mapIssueResponse(data);
    }, this.retryConfig);
  }

  /**
   * Create issue comment (with automatic retry on transient failures)
   */
  async createComment(issueNumber: number, body: string): Promise<void> {
    return withRetry(async () => {
      const url = `${this.apiUrl}/repos/${this.repoFullName}/issues/${issueNumber}/comments`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const error: any = new Error(
          `Failed to create comment on issue #${issueNumber}: ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }
    }, this.retryConfig);
  }

  /**
   * Add labels to issue (with automatic retry on transient failures)
   */
  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    return withRetry(async () => {
      const url = `${this.apiUrl}/repos/${this.repoFullName}/issues/${issueNumber}/labels`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ labels }),
      });

      if (!response.ok) {
        const error: any = new Error(
          `Failed to add labels to issue #${issueNumber}: ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }
    }, this.retryConfig);
  }

  /**
   * Remove label from issue (with automatic retry on transient failures)
   */
  async removeLabel(issueNumber: number, label: string): Promise<void> {
    return withRetry(async () => {
      const url = `${this.apiUrl}/repos/${this.repoFullName}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok && response.status !== 404) {
        const error: any = new Error(
          `Failed to remove label from issue #${issueNumber}: ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }
    }, this.retryConfig);
  }

  /**
   * Close issue (with automatic retry on transient failures)
   */
  async closeIssue(issueNumber: number): Promise<void> {
    return withRetry(async () => {
      const url = `${this.apiUrl}/repos/${this.repoFullName}/issues/${issueNumber}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ state: 'closed' }),
      });

      if (!response.ok) {
        const error: any = new Error(
          `Failed to close issue #${issueNumber}: ${response.statusText}`
        );
        error.status = response.status;
        throw error;
      }
    }, this.retryConfig);
  }

  /**
   * Map GitHub API issue response to GitHubIssue type
   */
  private mapIssueResponse(data: any): GitHubIssue {
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state,
      labels: data.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
      assignees: data.assignees.map((a: any) => a.login),
      author: data.user.login,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
