/**
 * sprint command - Start a new sprint with planning support
 *
 * Flow:
 * 1. Get repository info
 * 2. Create GitHub milestone
 * 3. Interactive sprint planning
 * 4. Create sprint issues in batch
 * 5. Display sprint summary
 */

import ora from 'ora';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
// @ts-ignore - inquirer is an ESM-only module
import inquirer from 'inquirer';

export interface SprintOptions {
  duration?: number; // Sprint duration in days (default: 14)
  dryRun?: boolean;
  initProject?: boolean; // Initialize project structure
}

export interface SprintTask {
  title: string;
  description: string;
  priority: 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';
  type: string;
}

/**
 * Start a new sprint with interactive planning
 */
export async function sprintStart(sprintName: string, options: SprintOptions = {}) {
  const duration = options.duration || 14;

  console.log(chalk.cyan.bold(`\n🚀 Starting Sprint: ${sprintName}\n`));
  console.log(chalk.gray(`Duration: ${duration} days\n`));

  // Step 1: Get repository info
  const spinner = ora('Detecting repository...').start();
  let owner: string;
  let repo: string;
  let token: string;

  try {
    const repoInfo = await getRepositoryInfo();
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    token = repoInfo.token;
    spinner.succeed(chalk.green(`Repository: ${owner}/${repo}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to detect repository'));
    console.log(chalk.yellow('\n💡 Make sure you are in a git repository with a GitHub remote'));
    throw error;
  }

  const octokit = new Octokit({ auth: token });

  // Step 1.5: Initialize project structure if requested
  if (options.initProject) {
    spinner.start('Initializing project structure...');
    try {
      await initializeProjectStructure(process.cwd());
      spinner.succeed(chalk.green('Project structure initialized'));
    } catch (error: any) {
      spinner.warn(chalk.yellow('Project initialization skipped'));
      console.log(chalk.gray(`  ${error.message}\n`));
    }
  }

  // Step 2: Create milestone
  spinner.start(`Creating milestone: ${sprintName}...`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + duration);

  let milestone;
  try {
    const response = await octokit.issues.createMilestone({
      owner,
      repo,
      title: sprintName,
      due_on: dueDate.toISOString(),
      description: `Sprint: ${sprintName}\nDuration: ${duration} days\nCreated: ${new Date().toLocaleDateString()}`,
    });
    milestone = response.data;
    spinner.succeed(chalk.green(`Milestone created: ${milestone.html_url}`));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to create milestone'));
    throw error;
  }

  // Step 3: Interactive sprint planning
  console.log(chalk.cyan('\n📋 Sprint Planning\n'));
  console.log(chalk.gray('Add tasks for this sprint (type "done" when finished)\n'));

  const tasks: SprintTask[] = [];
  let taskNumber = 1;

  while (true) {
    console.log(chalk.white.bold(`Task #${taskNumber}:`));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Task title (or "done" to finish):',
        validate: (input: string) => input.trim().length > 0 || 'Title is required',
      },
    ]);

    if (answers.title.toLowerCase() === 'done') {
      break;
    }

    const taskDetails = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Description (optional):',
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Priority:',
        choices: ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'],
        default: 'P2-Medium',
      },
      {
        type: 'list',
        name: 'type',
        message: 'Type:',
        choices: ['feature', 'bug', 'enhancement', 'documentation', 'refactor', 'test'],
        default: 'feature',
      },
    ]);

    tasks.push({
      title: answers.title,
      description: taskDetails.description || '',
      priority: taskDetails.priority,
      type: taskDetails.type,
    });

    taskNumber++;
    console.log(chalk.green('✓ Task added\n'));
  }

  if (tasks.length === 0) {
    console.log(chalk.yellow('\n⚠️  No tasks added. Sprint milestone created but no issues generated.\n'));
    return;
  }

  // Step 4: Create issues in batch
  console.log(chalk.cyan(`\n📝 Creating ${tasks.length} issues...\n`));

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 Dry run mode - issues will not be created\n'));
    tasks.forEach((task, index) => {
      console.log(chalk.white(`${index + 1}. [${task.priority}] ${task.title}`));
      console.log(chalk.gray(`   Type: ${task.type}`));
      if (task.description) {
        console.log(chalk.gray(`   ${task.description}`));
      }
      console.log();
    });
    return;
  }

  const createdIssues: any[] = [];

  for (const task of tasks) {
    spinner.start(`Creating: ${task.title}...`);

    try {
      const labels = [
        `⚠️ priority:${task.priority}`,
        `✨ type:${task.type}`,
        '📥 state:pending',
      ];

      const body = task.description
        ? `${task.description}\n\n---\n📅 Sprint: ${sprintName}\n🎯 Milestone: ${milestone.number}`
        : `📅 Sprint: ${sprintName}\n🎯 Milestone: ${milestone.number}`;

      const issue = await octokit.issues.create({
        owner,
        repo,
        title: task.title,
        body,
        labels,
        milestone: milestone.number,
      });

      createdIssues.push(issue.data);
      spinner.succeed(chalk.green(`Created: #${issue.data.number} ${task.title}`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to create: ${task.title}`));
      console.log(chalk.gray(`  Error: ${error.message}\n`));
    }
  }

  // Step 5: Display summary
  console.log(chalk.green.bold('\n✅ Sprint started successfully!\n'));
  console.log(chalk.cyan('📊 Sprint Summary:\n'));
  console.log(chalk.white(`  Sprint: ${sprintName}`));
  console.log(chalk.white(`  Duration: ${duration} days`));
  console.log(chalk.white(`  Due Date: ${dueDate.toLocaleDateString()}`));
  console.log(chalk.white(`  Tasks Created: ${createdIssues.length}/${tasks.length}`));
  console.log(chalk.white(`  Milestone: ${milestone.html_url}\n`));

  if (createdIssues.length > 0) {
    console.log(chalk.cyan('🎯 Next Steps:\n'));
    console.log(chalk.white('  1. AI agents will automatically start working on issues'));
    console.log(chalk.white('  2. Track progress: npx miyabi status'));
    console.log(chalk.white(`  3. View milestone: ${milestone.html_url}\n`));
  }
}

/**
 * Get repository information from git and environment
 */
async function getRepositoryInfo(): Promise<{ owner: string; repo: string; token: string }> {
  // Get git remote
  const { execSync } = await import('child_process');

  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Parse GitHub URL
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (!match) {
      throw new Error('Could not parse GitHub repository URL');
    }

    const owner = match[1];
    const repo = match[2];

    // Get GitHub token
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) {
      throw new Error(
        'GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable, or run: gh auth login'
      );
    }

    return { owner, repo, token };
  } catch (error: any) {
    throw new Error(`Repository detection failed: ${error.message}`);
  }
}

/**
 * Initialize project structure with directories and starter files
 */
async function initializeProjectStructure(projectRoot: string): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');

  // Define project structure
  const directories = [
    'src',
    'src/components',
    'src/utils',
    'src/services',
    'tests',
    'docs',
    '.github',
    '.github/workflows',
  ];

  const files: Record<string, string> = {
    'src/index.ts': `// Main entry point
console.log('Hello from ${projectRoot}');
`,
    'src/utils/helpers.ts': `// Utility functions
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
    'tests/index.test.ts': `// Test suite
import { describe, it, expect } from 'vitest';

describe('Example Tests', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`,
    'docs/README.md': `# Project Documentation

## Getting Started

Welcome to this project!

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`
`,
    '.gitignore': `node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
coverage/
`,
    'README.md': `# Project

Auto-generated project structure.

## Setup

\`\`\`bash
npm install
\`\`\`

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm test\` - Run tests
- \`npm run build\` - Build for production
`,
  };

  // Create directories (avoid TOCTOU with try-catch)
  for (const dir of directories) {
    const dirPath = join(projectRoot, dir);
    try {
      mkdirSync(dirPath, { recursive: true });
    } catch (error: any) {
      // Ignore error if directory already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // Create files (avoid TOCTOU with wx flag)
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(projectRoot, filePath);
    try {
      writeFileSync(fullPath, content, { encoding: 'utf-8', flag: 'wx' });
    } catch (error: any) {
      // Skip if file already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
