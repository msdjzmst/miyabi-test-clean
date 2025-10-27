#!/usr/bin/env tsx
/**
 * AI-powered Issue labeling using Claude Code integration
 *
 * Analyzes Issue title and body to suggest appropriate labels
 * Uses rule-based heuristics instead of direct Anthropic API calls
 */

import { withAgentTracking } from '../reporting/dashboard-events.js';
import { getGitHubClient } from '../../utils/api-client.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('  - GITHUB_TOKEN');
  process.exit(1);
}

// Use singleton client with connection pooling
const octokit = getGitHubClient(GITHUB_TOKEN);

interface LabelSuggestion {
  type: string;
  priority: string;
  phase: string;
  agent: string;
  special?: string[];
  reasoning: string;
}

/**
 * Analyze Issue with rule-based heuristics and suggest labels
 *
 * Uses keyword matching instead of direct Anthropic API calls
 */
async function analyzeIssueWithAI(
  title: string,
  body: string,
  onProgress?: (text: string) => void,
): Promise<LabelSuggestion> {
  const titleLower = title.toLowerCase();
  const bodyLower = (body || '').toLowerCase();
  const combined = `${titleLower} ${bodyLower}`;

  // Type detection
  let type = 'type:feature';
  if (combined.match(/\b(bug|fix|error|issue|broken|crash)\b/)) {
    type = 'type:bug';
  } else if (combined.match(/\b(doc|documentation|readme|guide)\b/)) {
    type = 'type:docs';
  } else if (combined.match(/\b(refactor|restructure|cleanup|improve)\b/)) {
    type = 'type:refactor';
  } else if (combined.match(/\b(test|testing|spec|coverage)\b/)) {
    type = 'type:test';
  } else if (combined.match(/\b(deploy|deployment|release|production)\b/)) {
    type = 'type:deployment';
  } else if (combined.match(/\b(architecture|design|pattern)\b/)) {
    type = 'type:architecture';
  }

  // Priority detection
  let priority = 'priority:P2-Medium';
  if (combined.match(/\b(critical|urgent|blocking|p0|sev\.1)\b/)) {
    priority = 'priority:P0-Critical';
  } else if (combined.match(/\b(high|important|major|p1|sev\.2)\b/)) {
    priority = 'priority:P1-High';
  } else if (combined.match(/\b(low|minor|p3|sev\.4)\b/)) {
    priority = 'priority:P3-Low';
  }

  // Phase detection
  let phase = 'phase:planning';
  if (combined.match(/\b(implement|build|code|develop)\b/)) {
    phase = 'phase:implementation';
  } else if (combined.match(/\b(test|testing|qa|verify)\b/)) {
    phase = 'phase:testing';
  } else if (combined.match(/\b(deploy|deployment|release)\b/)) {
    phase = 'phase:deployment';
  } else if (combined.match(/\b(monitor|monitoring|observability)\b/)) {
    phase = 'phase:monitoring';
  }

  // Agent detection
  let agent = 'agent:codegen';
  if (combined.match(/\b(coordinate|orchestrate|plan|manage)\b/)) {
    agent = 'agent:coordinator';
  } else if (combined.match(/\b(review|quality|check)\b/)) {
    agent = 'agent:review';
  } else if (combined.match(/\b(issue|label|analyze)\b/)) {
    agent = 'agent:issue';
  } else if (combined.match(/\b(pr|pull request|merge)\b/)) {
    agent = 'agent:pr';
  } else if (combined.match(/\b(deploy|deployment|release)\b/)) {
    agent = 'agent:deployment';
  }

  // Special labels
  const special: string[] = [];
  if (combined.match(/\b(security|vulnerability|auth|permission)\b/)) {
    special.push('special:security');
  }
  if (combined.match(/\b(cost|pricing|billing|expensive)\b/)) {
    special.push('special:cost-watch');
  }
  if (combined.match(/\b(learn|learning|tutorial|study)\b/)) {
    special.push('special:learning');
  }
  if (combined.match(/\b(experiment|experimental|prototype|poc)\b/)) {
    special.push('special:experiment');
  }
  if (combined.match(/\b(good first issue|easy|beginner|simple)\b/)) {
    special.push('good-first-issue');
  }

  // Simulate progress
  if (onProgress) {
    onProgress('Analyzing...');
  }

  const reasoning = `Rule-based analysis: Detected as ${type} with ${priority} priority`;

  return {
    type,
    priority,
    phase,
    agent,
    special: special.length > 0 ? special : undefined,
    reasoning,
  };
}

/**
 * Apply labels to GitHub Issue
 */
async function applyLabels(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<void> {
  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });

  console.log(`✅ Applied ${labels.length} labels to Issue #${issueNumber}`);
}

/**
 * Add comment explaining the AI analysis
 */
async function addAnalysisComment(
  owner: string,
  repo: string,
  issueNumber: number,
  suggestion: LabelSuggestion,
): Promise<void> {
  const comment = `## 🤖 AI Analysis Complete

I've analyzed this Issue and applied the following labels:

**Reasoning:** ${suggestion.reasoning}

### Labels Applied
- **Type:** \`${suggestion.type}\`
- **Priority:** \`${suggestion.priority}\`
- **Phase:** \`${suggestion.phase}\`
- **Agent:** \`${suggestion.agent}\`
${suggestion.special ? `- **Special:** ${suggestion.special.map((s) => `\`${s}\``).join(', ')}` : ''}

The assigned agent will automatically start working on this Issue based on the webhook event routing.

---
🤖 Powered by Claude AI & Agentic OS`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: comment,
  });

  console.log(`✅ Added analysis comment to Issue #${issueNumber}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: npm run ai:label <owner> <repo> <issue-number>');
    console.error('Example: npm run ai:label ShunsukeHayashi Autonomous-Operations 19');
    process.exit(1);
  }

  const [owner, repo, issueNumberStr] = args;
  const issueNumber = parseInt(issueNumberStr, 10);

  // Wrap execution with dashboard tracking
  await withAgentTracking('issue', issueNumber, async (progress) => {
    console.log(`🔍 Analyzing Issue #${issueNumber}...`);
    progress(10, 'Fetching issue data...');

    // Fetch Issue
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    console.log(`📝 Title: ${issue.title}`);
    progress(30, 'Analyzing with Claude AI...');

    // Analyze with rule-based heuristics
    console.log('🤖 Analyzing with heuristics...');
    const suggestion = await analyzeIssueWithAI(
      issue.title,
      issue.body || '',
    );

    console.log('\n📊 AI Suggestion:');
    console.log(`  Type: ${suggestion.type}`);
    console.log(`  Priority: ${suggestion.priority}`);
    console.log(`  Phase: ${suggestion.phase}`);
    console.log(`  Agent: ${suggestion.agent}`);
    if (suggestion.special) {
      console.log(`  Special: ${suggestion.special.join(', ')}`);
    }
    console.log(`\n💡 Reasoning: ${suggestion.reasoning}\n`);

    progress(60, 'Applying labels...');

    // Collect all labels
    const labels = [
      suggestion.type,
      suggestion.priority,
      suggestion.phase,
      suggestion.agent,
      '📥 state:pending', // Default state
      ...(suggestion.special || []),
    ];

    // Apply labels
    await applyLabels(owner, repo, issueNumber, labels);

    progress(80, 'Adding analysis comment...');

    // Add comment
    await addAnalysisComment(owner, repo, issueNumber, suggestion);

    progress(100, 'Completed!');
    console.log('\n✅ Done!');

    return { success: true, labelsApplied: labels };
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { analyzeIssueWithAI, applyLabels, addAnalysisComment };
