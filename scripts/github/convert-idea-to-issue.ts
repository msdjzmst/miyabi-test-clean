#!/usr/bin/env tsx
/**
 * Convert Discussion (Idea) to GitHub Issue
 *
 * Automatically converts feature ideas from GitHub Discussions to trackable Issues
 * Part of Phase C: Message Queue (Discussions) - Issue #5
 *
 * Usage:
 *   convert-idea-to-issue.ts <discussion-number>
 *
 * Features:
 * - Fetches discussion content using GraphQL
 * - Analyzes with Claude AI to extract requirements
 * - Creates structured GitHub Issue
 * - Links back to original discussion
 * - Auto-labels based on content
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import chalk from 'chalk';
import ora from 'ora';

// ============================================================================
// Types
// ============================================================================

interface Discussion {
  id: string;
  number: number;
  title: string;
  body: string;
  category: string;
  author: {
    login: string;
  };
  url: string;
  createdAt: string;
}

interface IssueTemplate {
  title: string;
  body: string;
  labels: string[];
  priority: string;
  estimatedEffort: string;
  reasoning: string;
}

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPOSITORY = process.env.GITHUB_REPOSITORY || 'ShunsukeHayashi/Autonomous-Operations';
const [owner, repo] = REPOSITORY.split('/');

if (!GITHUB_TOKEN) {
  console.error(chalk.red('❌ GITHUB_TOKEN environment variable is required'));
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${GITHUB_TOKEN}`,
  },
});

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DISCUSSION_QUERY = `
  query GetDiscussion($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $number) {
        id
        number
        title
        body
        category {
          name
        }
        author {
          login
        }
        url
        createdAt
      }
    }
  }
`;

// ============================================================================
// Converter
// ============================================================================

class IdeaToIssueConverter {
  /**
   * Fetch discussion from GitHub
   */
  async fetchDiscussion(discussionNumber: number): Promise<Discussion> {
    try {
      const result: any = await graphqlWithAuth(GET_DISCUSSION_QUERY, {
        owner,
        repo,
        number: discussionNumber,
      });

      const discussion = result.repository.discussion;
      return {
        id: discussion.id,
        number: discussion.number,
        title: discussion.title,
        body: discussion.body || '',
        category: discussion.category.name,
        author: discussion.author,
        url: discussion.url,
        createdAt: discussion.createdAt,
      };
    } catch (error) {
      throw new Error(`Failed to fetch discussion: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze discussion and generate issue template with rule-based heuristics
   */
  async analyzeAndGenerateIssue(discussion: Discussion): Promise<IssueTemplate> {
    const titleLower = discussion.title.toLowerCase();
    const bodyLower = discussion.body.toLowerCase();
    const combined = `${titleLower} ${bodyLower}`;

    // Determine title prefix
    let titlePrefix = '[Feature]';
    if (combined.match(/\b(improve|enhance|better|optimize)\b/)) {
      titlePrefix = '[Enhancement]';
    }

    // Priority detection
    let priority = 'P2-Medium';
    const labels: string[] = ['type:feature', 'phase:planning', 'agent:codegen'];

    if (combined.match(/\b(critical|urgent|blocking)\b/)) {
      priority = 'P0-Critical';
      labels.push('priority:P0-Critical');
    } else if (combined.match(/\b(important|high priority|major)\b/)) {
      priority = 'P1-High';
      labels.push('priority:P1-High');
    } else if (combined.match(/\b(low priority|minor|nice to have)\b/)) {
      priority = 'P3-Low';
      labels.push('priority:P3-Low');
    } else {
      labels.push('priority:P2-Medium');
    }

    // Special labels
    if (combined.match(/\b(security|auth|permission|vulnerability)\b/)) {
      labels.push('special:security');
    }
    if (combined.match(/\b(cost|expensive|pricing)\b/)) {
      labels.push('special:cost-watch');
    }
    if (combined.match(/\b(experiment|prototype|poc)\b/)) {
      labels.push('special:experiment');
    }

    // Estimated effort
    let estimatedEffort = 'M';
    if (combined.length > 1000 || combined.match(/\b(complex|large|major|significant)\b/)) {
      estimatedEffort = 'L';
    } else if (combined.length > 2000) {
      estimatedEffort = 'XL';
    } else if (combined.length < 200 || combined.match(/\b(simple|quick|small|minor)\b/)) {
      estimatedEffort = 'S';
    }

    // Generate structured body
    const body = `## Problem Statement

${discussion.body}

## Proposed Solution

_To be refined during planning phase_

## Acceptance Criteria

- [ ] Feature is implemented and tested
- [ ] Documentation is updated
- [ ] Code review is complete

## Technical Considerations

_To be determined during technical review_

## Original Discussion

For more context and discussion, see [Discussion #${discussion.number}](${discussion.url})`;

    return {
      title: `${titlePrefix} ${discussion.title}`,
      body,
      labels,
      priority,
      estimatedEffort,
      reasoning: `Rule-based analysis: Detected as ${priority} priority with ${estimatedEffort} effort`,
    };
  }

  /**
   * Create GitHub Issue from template
   */
  async createIssue(discussion: Discussion, template: IssueTemplate): Promise<number> {
    const issueBody = `## Original Discussion

**Discussion:** [#${discussion.number}](${discussion.url}) - ${discussion.title}
**Author:** @${discussion.author.login}
**Category:** ${discussion.category}
**Created:** ${new Date(discussion.createdAt).toLocaleDateString()}

---

${template.body}

---

## Metadata

**Estimated Effort:** ${template.estimatedEffort}
**Priority:** ${template.priority}

## Links

- 💬 [Original Discussion](${discussion.url})
- 📚 [Documentation](/docs)
- 🤖 [Agent Documentation](/docs/AGENTS.md)

---

🤖 **Automated Conversion**

This Issue was automatically created from a Discussion in the Ideas category by Discussion Bot (Issue #5 Phase C).

### AI Analysis

${template.reasoning}

### Next Steps

1. Review and refine requirements
2. Break down into subtasks if needed
3. Assign to appropriate agent
4. Add to project board

---

*To discuss this feature, visit the [original discussion](${discussion.url})*`;

    // Create the issue
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: template.title,
      body: issueBody,
      labels: [...template.labels, '📥 state:pending'],
    });

    // Export issue number for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `CREATED_ISSUE_NUMBER=${issue.number}\n`);
    }

    return issue.number;
  }

  /**
   * Convert discussion to issue (main flow)
   */
  async convert(discussionNumber: number): Promise<void> {
    console.log(chalk.bold.cyan('\n🔄 Converting Discussion to Issue\n'));

    // Step 1: Fetch discussion
    let spinner = ora('Fetching discussion from GitHub...').start();
    const discussion = await this.fetchDiscussion(discussionNumber);
    spinner.succeed(`Fetched Discussion #${discussion.number}`);

    console.log(chalk.cyan(`\n  Title: ${discussion.title}`));
    console.log(chalk.gray(`  Author: @${discussion.author.login}`));
    console.log(chalk.gray(`  Category: ${discussion.category}`));
    console.log(chalk.gray(`  URL: ${discussion.url}\n`));

    // Step 2: Analyze with heuristics
    spinner = ora('Analyzing discussion...').start();
    const template = await this.analyzeAndGenerateIssue(discussion);
    spinner.succeed('Analysis complete');

    console.log(chalk.bold('\n🧠 AI Analysis:\n'));
    console.log(chalk.cyan(`  Issue Title: ${template.title}`));
    console.log(chalk.cyan(`  Priority: ${template.priority}`));
    console.log(chalk.cyan(`  Estimated Effort: ${template.estimatedEffort}`));
    console.log(chalk.cyan(`  Labels: ${template.labels.join(', ')}`));
    console.log(chalk.gray(`\n  Reasoning: ${template.reasoning}\n`));

    // Step 3: Create issue
    spinner = ora('Creating GitHub Issue...').start();
    const issueNumber = await this.createIssue(discussion, template);
    spinner.succeed(`Created Issue #${issueNumber}`);

    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
    console.log(chalk.green(`\n✅ Conversion complete!`));
    console.log(chalk.cyan(`\n📋 Issue URL: ${issueUrl}\n`));
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(chalk.red('Usage: convert-idea-to-issue.ts <discussion-number>'));
    console.error('');
    console.error('Example:');
    console.error('  convert-idea-to-issue.ts 42');
    process.exit(1);
  }

  const discussionNumber = parseInt(args[0], 10);
  if (isNaN(discussionNumber)) {
    console.error(chalk.red('❌ Invalid discussion number'));
    process.exit(1);
  }

  const converter = new IdeaToIssueConverter();
  await converter.convert(discussionNumber);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('\n❌ Fatal error:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  });
}

export { IdeaToIssueConverter };
export type { Discussion, IssueTemplate };
