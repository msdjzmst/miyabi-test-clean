/**
 * Project analysis module
 *
 * Analyzes existing project structure and configuration
 */

import * as fs from 'fs';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

export interface ProjectAnalysis {
  repo: string;
  owner: string;
  languages: string[];
  framework: string | null;
  buildTool: string | null;
  packageManager: string | null;
  issueCount: number;
  prCount: number;
  hasWorkflows: boolean;
  hasLabels: boolean;
}

/**
 * Analyze current project
 */
export async function analyzeProject(): Promise<ProjectAnalysis> {
  // Get repository info from git
  const repoInfo = getRepositoryInfo();

  // Detect languages
  const languages = detectLanguages();

  // Detect framework
  const framework = detectFramework();

  // Detect build tool
  const buildTool = detectBuildTool();

  // Detect package manager
  const packageManager = detectPackageManager();

  // Get GitHub stats
  const githubStats = await getGitHubStats(repoInfo.owner, repoInfo.repo);

  return {
    repo: repoInfo.repo,
    owner: repoInfo.owner,
    languages,
    framework,
    buildTool,
    packageManager,
    issueCount: githubStats.issueCount,
    prCount: githubStats.prCount,
    hasWorkflows: fs.existsSync('.github/workflows'),
    hasLabels: githubStats.hasLabels,
  };
}

/**
 * Get repository owner and name from git remote
 */
function getRepositoryInfo(): { owner: string; repo: string } {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);

    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    throw new Error('Not a git repository or no origin remote found');
  }

  throw new Error('Could not parse repository information');
}

/**
 * Detect programming languages
 */
function detectLanguages(): string[] {
  const languages: string[] = [];

  // Check for language-specific files
  if (fs.existsSync('package.json')) languages.push('JavaScript/TypeScript');
  if (fs.existsSync('requirements.txt') || fs.existsSync('setup.py')) languages.push('Python');
  if (fs.existsSync('go.mod')) languages.push('Go');
  if (fs.existsSync('Cargo.toml')) languages.push('Rust');
  if (fs.existsSync('pom.xml') || fs.existsSync('build.gradle')) languages.push('Java');
  if (fs.existsSync('Gemfile')) languages.push('Ruby');
  if (fs.existsSync('composer.json')) languages.push('PHP');

  return languages.length > 0 ? languages : ['Unknown'];
}

/**
 * Detect framework
 */
function detectFramework(): string | null {
  try {
    // Check package.json for Node.js frameworks
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.next) return 'Next.js';
      if (deps.react) return 'React';
      if (deps.vue) return 'Vue.js';
      if (deps.svelte) return 'Svelte';
      if (deps.express) return 'Express';
      if (deps['@nestjs/core']) return 'NestJS';
    }

    // Check for other frameworks
    if (fs.existsSync('requirements.txt')) {
      const reqs = fs.readFileSync('requirements.txt', 'utf-8');
      if (reqs.includes('django')) return 'Django';
      if (reqs.includes('flask')) return 'Flask';
      if (reqs.includes('fastapi')) return 'FastAPI';
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Detect build tool
 */
function detectBuildTool(): string | null {
  if (fs.existsSync('vite.config.ts') || fs.existsSync('vite.config.js')) return 'Vite';
  if (fs.existsSync('webpack.config.js')) return 'Webpack';
  if (fs.existsSync('rollup.config.js')) return 'Rollup';
  if (fs.existsSync('tsconfig.json')) return 'TypeScript';

  return null;
}

/**
 * Detect package manager
 */
function detectPackageManager(): string | null {
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('package-lock.json')) return 'npm';
  if (fs.existsSync('Gemfile.lock')) return 'bundler';
  if (fs.existsSync('poetry.lock')) return 'poetry';

  return null;
}

/**
 * Get GitHub repository statistics
 */
async function getGitHubStats(
  owner: string,
  repo: string
): Promise<{ issueCount: number; prCount: number; hasLabels: boolean }> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return { issueCount: 0, prCount: 0, hasLabels: false };
  }

  try {
    const octokit = new Octokit({ auth: token });

    const [issues, prs, labels] = await Promise.all([
      octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: 1 }),
      octokit.pulls.list({ owner, repo, state: 'open', per_page: 1 }),
      octokit.issues.listLabelsForRepo({ owner, repo, per_page: 1 }),
    ]);

    return {
      issueCount: issues.data.length,
      prCount: prs.data.length,
      hasLabels: labels.data.length > 0,
    };
  } catch {
    return { issueCount: 0, prCount: 0, hasLabels: false };
  }
}
