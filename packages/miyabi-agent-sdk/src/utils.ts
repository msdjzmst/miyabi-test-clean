/**
 * Miyabi Agent SDK - Utility Functions
 *
 * This module provides utility functions for agent operations.
 */

import type { AgentContext, AgentConfig } from './types';

/**
 * Create agent context from environment variables
 */
export function createAgentContext(config: AgentConfig): AgentContext {
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const token = process.env.GITHUB_TOKEN;
  const issueNumber = process.env.ISSUE_NUMBER
    ? parseInt(process.env.ISSUE_NUMBER, 10)
    : undefined;
  const workdir = process.env.GITHUB_WORKSPACE || process.cwd();

  if (!owner || !repo || !token) {
    throw new Error(
      'Missing required environment variables: GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY, GITHUB_TOKEN'
    );
  }

  return {
    owner,
    repo,
    token,
    issueNumber,
    workdir,
    config,
  };
}

/**
 * Validate agent context
 */
export function validateContext(context: AgentContext): void {
  const required = ['owner', 'repo', 'token', 'workdir'];
  const missing = required.filter((key) => !context[key as keyof AgentContext]);

  if (missing.length > 0) {
    throw new Error(
      `Invalid agent context: missing required fields: ${missing.join(', ')}`
    );
  }

  if (!context.config || !context.config.name) {
    throw new Error('Invalid agent context: config.name is required');
  }
}

/**
 * Parse issue number from various formats
 */
export function parseIssueNumber(input: string): number | undefined {
  // Try direct number
  const direct = parseInt(input, 10);
  if (!isNaN(direct)) {
    return direct;
  }

  // Try extracting from URL
  const urlMatch = input.match(/\/issues\/(\d+)/);
  if (urlMatch) {
    return parseInt(urlMatch[1], 10);
  }

  // Try extracting from #123 format
  const hashMatch = input.match(/#(\d+)/);
  if (hashMatch) {
    return parseInt(hashMatch[1], 10);
  }

  return undefined;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Extract labels from issue body
 */
export function extractLabelsFromBody(body: string): string[] {
  const labelPattern = /(?:^|\n)(?:Labels?|ラベル):\s*(.+?)(?:\n|$)/i;
  const match = body.match(labelPattern);

  if (!match) {
    return [];
  }

  return match[1]
    .split(/[,、]/)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * Extract priority from issue body or labels
 */
export function extractPriority(
  body: string,
  labels: string[]
): number {
  // Check labels first
  const priorityLabel = labels.find((l) =>
    /^priority[:-]?\s*(\d+|high|medium|low)/i.test(l)
  );

  if (priorityLabel) {
    const match = priorityLabel.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Map text to number
    if (/high/i.test(priorityLabel)) return 1;
    if (/medium/i.test(priorityLabel)) return 2;
    if (/low/i.test(priorityLabel)) return 3;
  }

  // Check body
  const bodyPattern = /(?:^|\n)(?:Priority|優先度):\s*(.+?)(?:\n|$)/i;
  const match = body.match(bodyPattern);

  if (match) {
    const value = match[1].trim().toLowerCase();
    if (/high|高/i.test(value)) return 1;
    if (/medium|中/i.test(value)) return 2;
    if (/low|低/i.test(value)) return 3;

    const num = parseInt(value, 10);
    if (!isNaN(num)) return num;
  }

  // Default to medium priority
  return 2;
}
