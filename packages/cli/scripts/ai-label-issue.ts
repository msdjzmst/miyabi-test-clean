#!/usr/bin/env tsx
/**
 * AI-powered Issue labeling using Claude
 *
 * Analyzes Issue title and body using Claude AI to suggest appropriate labels
 */

import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GITHUB_TOKEN || !ANTHROPIC_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!GITHUB_TOKEN) console.error('  - GITHUB_TOKEN');
  if (!ANTHROPIC_API_KEY) console.error('  - ANTHROPIC_API_KEY');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

interface LabelSuggestion {
  type: string;
  priority: string;
  phase: string;
  agent: string;
  special?: string[];
  reasoning: string;
}

/**
 * Analyze Issue with Claude AI and suggest labels
 */
async function analyzeIssueWithAI(
  title: string,
  body: string
): Promise<LabelSuggestion> {
  const prompt = `You are an expert at analyzing software development tasks and categorizing them.

Analyze this GitHub Issue and suggest appropriate labels:

**Title:** ${title}

**Body:**
${body}

Based on this Issue, suggest labels for these categories:

1. **Type** (choose one):
   - 🐛 type:bug - Bug fix
   - ✨ type:feature - New feature or enhancement
   - 📚 type:docs - Documentation
   - ♻️ type:refactor - Code refactoring
   - 🧪 type:test - Testing
   - 🏗️ type:architecture - Architecture/design
   - 🚀 type:deployment - Deployment related

2. **Priority** (choose one):
   - 📊 priority:P0-Critical - Blocking production issue
   - ⚠️ priority:P1-High - Major feature or significant bug
   - 📊 priority:P2-Medium - Standard feature or bug
   - 📊 priority:P3-Low - Nice to have

3. **Phase** (choose one):
   - 🎯 phase:planning - Planning phase
   - 🏗️ phase:implementation - Implementation phase
   - 🧪 phase:testing - Testing phase
   - 🚀 phase:deployment - Deployment phase
   - 📊 phase:monitoring - Monitoring phase

4. **Agent** (choose one):
   - 🤖 agent:coordinator - Task orchestration
   - 💻 agent:codegen - Code implementation
   - 👀 agent:review - Code review
   - 📋 agent:issue - Issue analysis
   - 🔀 agent:pr - PR management
   - 🚀 agent:deployment - Deployment

5. **Special** (optional, multiple allowed):
   - 🔒 special:security - Security related
   - 💰 special:cost-watch - Cost monitoring needed
   - 🎓 special:learning - Learning task
   - 🧪 special:experiment - Experimental
   - 👋 good-first-issue - Good for newcomers

Respond in JSON format:
{
  "type": "type:feature",
  "priority": "priority:P1-High",
  "phase": "phase:planning",
  "agent": "agent:codegen",
  "special": ["special:security"],
  "reasoning": "Brief explanation of your choices"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Extract JSON from response (might be wrapped in ```json blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  const suggestion: LabelSuggestion = JSON.parse(jsonMatch[0]);
  return suggestion;
}

/**
 * Apply labels to GitHub Issue
 */
async function applyLabels(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
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
  suggestion: LabelSuggestion
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

  console.log(`🔍 Analyzing Issue #${issueNumber}...`);

  // Fetch Issue
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  console.log(`📝 Title: ${issue.title}`);

  // Analyze with AI
  console.log('🤖 Consulting Claude AI...');
  const suggestion = await analyzeIssueWithAI(issue.title, issue.body || '');

  console.log('\n📊 AI Suggestion:');
  console.log(`  Type: ${suggestion.type}`);
  console.log(`  Priority: ${suggestion.priority}`);
  console.log(`  Phase: ${suggestion.phase}`);
  console.log(`  Agent: ${suggestion.agent}`);
  if (suggestion.special) {
    console.log(`  Special: ${suggestion.special.join(', ')}`);
  }
  console.log(`\n💡 Reasoning: ${suggestion.reasoning}\n`);

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

  // Add comment
  await addAnalysisComment(owner, repo, issueNumber, suggestion);

  console.log('\n✅ Done!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { analyzeIssueWithAI, applyLabels, addAnalysisComment };
