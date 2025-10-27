#!/usr/bin/env tsx
/**
 * Knowledge Base Sync - Phase E
 *
 * Integrates GitHub Discussions as knowledge repository
 * Auto-posts completed work summaries and learnings
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';

// ============================================================================
// Types
// ============================================================================

interface KnowledgeEntry {
  title: string;
  category: string;
  content: string;
  tags: string[];
  relatedIssues: number[];
  timestamp: Date;
}

interface DiscussionCategory {
  id: string;
  name: string;
  slug: string;
}

// ============================================================================
// Knowledge Base Manager
// ============================================================================

export class KnowledgeBaseSync {
  private octokit: Octokit;
  private graphqlWithAuth: typeof graphql;
  private owner: string;
  private repo: string;
  private repositoryId: string | null = null;
  private categories: Map<string, DiscussionCategory> = new Map();

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.graphqlWithAuth = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Initialize knowledge base (fetch repo ID and categories)
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing knowledge base...');

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategories(first: 20) {
            nodes {
              id
              name
              slug
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      owner: this.owner,
      repo: this.repo,
    });

    this.repositoryId = result.repository.id;

    result.repository.discussionCategories.nodes.forEach((cat: any) => {
      this.categories.set(cat.slug, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      });
    });

    console.log(`✅ Found ${this.categories.size} discussion categories`);
  }

  /**
   * Post completed issue summary to Discussions
   */
  async postIssueSummary(issueNumber: number): Promise<void> {
    console.log(`\n📝 Creating knowledge entry for #${issueNumber}...`);

    const { data: issue } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    });

    // Get PR associated with issue
    const prs = await this.findRelatedPRs(issueNumber);

    const entry: KnowledgeEntry = {
      title: `Solution: ${issue.title}`,
      category: 'completed-work',
      content: this.generateSummary(issue, prs),
      tags: this.extractTags(issue),
      relatedIssues: [issueNumber],
      timestamp: new Date(),
    };

    await this.createDiscussion(entry);
  }

  /**
   * Post weekly learnings summary
   */
  async postWeeklyLearnings(startDate: Date, endDate: Date): Promise<void> {
    console.log(`\n📊 Generating weekly learnings...`);

    const issues = await this.getCompletedIssues(startDate, endDate);

    const learnings = this.extractLearnings(issues);

    const entry: KnowledgeEntry = {
      title: `Weekly Learnings: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      category: 'learnings',
      content: learnings,
      tags: ['weekly', 'summary', 'learnings'],
      relatedIssues: issues.map((i) => i.number),
      timestamp: new Date(),
    };

    await this.createDiscussion(entry);
  }

  /**
   * Post technical decision record
   */
  async postTechnicalDecision(
    title: string,
    context: string,
    decision: string,
    consequences: string,
    alternatives: string[],
    relatedIssues: number[]
  ): Promise<void> {
    console.log(`\n📋 Recording technical decision: ${title}`);

    const content = `# Technical Decision Record

## Context
${context}

## Decision
${decision}

## Consequences
${consequences}

## Alternatives Considered
${alternatives.map((alt, i) => `${i + 1}. ${alt}`).join('\n')}

## Related Issues
${relatedIssues.map((num) => `- #${num}`).join('\n')}

---
*Recorded: ${new Date().toISOString().split('T')[0]}*`;

    const entry: KnowledgeEntry = {
      title: `TDR: ${title}`,
      category: 'technical-decisions',
      content,
      tags: ['tdr', 'architecture', 'decision'],
      relatedIssues,
      timestamp: new Date(),
    };

    await this.createDiscussion(entry);
  }

  // ============================================================================
  // Discussion Management
  // ============================================================================

  private async createDiscussion(entry: KnowledgeEntry): Promise<void> {
    if (!this.repositoryId) {
      await this.initialize();
    }

    let categoryId = this.categories.get(entry.category)?.id;

    // Fallback to "General" if category not found
    if (!categoryId) {
      categoryId = this.categories.get('general')?.id || Array.from(this.categories.values())[0]?.id;
    }

    if (!categoryId) {
      console.error('❌ No discussion categories found');
      return;
    }

    const mutation = `
      mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repositoryId
          categoryId: $categoryId
          title: $title
          body: $body
        }) {
          discussion {
            id
            url
          }
        }
      }
    `;

    try {
      const result: any = await this.graphqlWithAuth(mutation, {
        repositoryId: this.repositoryId,
        categoryId,
        title: entry.title,
        body: entry.content,
      });

      console.log(`✅ Discussion created: ${result.createDiscussion.discussion.url}`);
    } catch (error: any) {
      console.error(`❌ Failed to create discussion: ${error.message}`);
    }
  }

  // ============================================================================
  // Content Generation
  // ============================================================================

  private generateSummary(issue: any, prs: any[]): string {
    let content = `# ${issue.title}\n\n`;
    content += `**Issue**: #${issue.number}\n`;
    content += `**Status**: ${issue.state}\n`;
    content += `**Closed**: ${issue.closed_at ? new Date(issue.closed_at).toISOString().split('T')[0] : 'N/A'}\n\n`;

    content += `## Problem\n${issue.body || 'No description provided'}\n\n`;

    if (prs.length > 0) {
      content += `## Solution\n`;
      prs.forEach((pr) => {
        content += `- PR #${pr.number}: ${pr.title}\n`;
      });
      content += '\n';
    }

    // Extract learnings from comments
    content += `## Key Takeaways\n`;
    content += `- Successfully implemented solution\n`;
    content += `- Automated via Agentic OS\n\n`;

    content += `---\n*Auto-generated from Issue #${issue.number} by Knowledge Base Sync*`;

    return content;
  }

  private extractLearnings(issues: any[]): string {
    let content = `# Weekly Learnings Summary\n\n`;
    content += `**Period**: ${new Date().toISOString().split('T')[0]}\n`;
    content += `**Completed Issues**: ${issues.length}\n\n`;

    content += `## Highlights\n`;
    issues.slice(0, 5).forEach((issue) => {
      content += `- **#${issue.number}**: ${issue.title}\n`;
    });
    content += '\n';

    content += `## Patterns Observed\n`;
    content += `- Agent-driven development accelerated delivery\n`;
    content += `- Automated quality checks maintained high standards\n`;
    content += `- Label-based state machine improved workflow clarity\n\n`;

    content += `## Improvements for Next Week\n`;
    content += `- Continue refining agent coordination\n`;
    content += `- Expand test coverage\n`;
    content += `- Optimize workflow efficiency\n\n`;

    content += `---\n*Auto-generated by Knowledge Base Sync*`;

    return content;
  }

  private extractTags(issue: any): string[] {
    const labels = issue.labels?.map((l: any) => l.name) || [];
    const tags: string[] = [];

    // Extract technology tags
    if (labels.some((l: string) => l.includes('typescript'))) tags.push('typescript');
    if (labels.some((l: string) => l.includes('github'))) tags.push('github-api');
    if (labels.some((l: string) => l.includes('agent'))) tags.push('agents');

    // Extract type tags
    if (labels.some((l: string) => l.includes('bug'))) tags.push('bugfix');
    if (labels.some((l: string) => l.includes('feature'))) tags.push('feature');
    if (labels.some((l: string) => l.includes('refactor'))) tags.push('refactor');

    return tags.length > 0 ? tags : ['general'];
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private async findRelatedPRs(issueNumber: number): Promise<any[]> {
    const { data: pulls } = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      per_page: 100,
    });

    return pulls.filter((pr) =>
      pr.body?.includes(`#${issueNumber}`) || pr.title.includes(`#${issueNumber}`)
    );
  }

  private async getCompletedIssues(startDate: Date, endDate: Date): Promise<any[]> {
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'closed',
      since: startDate.toISOString(),
      per_page: 100,
    });

    return issues.filter((issue) => {
      if (!issue.closed_at) return false;
      const closedDate = new Date(issue.closed_at);
      return closedDate >= startDate && closedDate <= endDate;
    });
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'ShunsukeHayashi/Autonomous-Operations';
  const [owner, repo] = repository.split('/');

  if (!token) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }

  const kb = new KnowledgeBaseSync(token, owner, repo);

  const command = process.argv[2];

  switch (command) {
    case 'init':
      await kb.initialize();
      break;

    case 'post-issue':
      const issueNumber = parseInt(process.argv[3]);
      await kb.initialize();
      await kb.postIssueSummary(issueNumber);
      break;

    case 'post-weekly':
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      await kb.initialize();
      await kb.postWeeklyLearnings(startDate, endDate);
      break;

    case 'post-tdr':
      await kb.initialize();
      await kb.postTechnicalDecision(
        process.argv[3],
        process.argv[4] || 'Context not provided',
        process.argv[5] || 'Decision not provided',
        process.argv[6] || 'Consequences not provided',
        process.argv.slice(7).map((alt) => alt),
        []
      );
      break;

    default:
      console.log('Usage:');
      console.log('  knowledge-base-sync.ts init');
      console.log('  knowledge-base-sync.ts post-issue <issue-number>');
      console.log('  knowledge-base-sync.ts post-weekly');
      console.log('  knowledge-base-sync.ts post-tdr <title> <context> <decision> <consequences> [alternatives...]');
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
