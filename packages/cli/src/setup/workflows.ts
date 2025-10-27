/**
 * Workflows deployment module
 *
 * Deploys GitHub Actions workflows from templates
 */

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DeployOptions {
  skipExisting?: boolean; // Skip if workflow already exists
}

/**
 * Deploy all workflows from templates to GitHub repository
 */
export async function deployWorkflows(
  owner: string,
  repo: string,
  token: string,
  options: DeployOptions = {}
): Promise<number> {
  const octokit = new Octokit({ auth: token });

  // Get workflow files from templates
  // In dist, __dirname points to dist/setup, templates are in templates/workflows
  // So we need to go up two levels: dist/setup -> dist -> project root -> templates
  const templatesDir = path.join(__dirname, '../../templates/workflows');

  if (!fs.existsSync(templatesDir)) {
    throw new Error(`Templates directory not found: ${templatesDir}`);
  }

  const workflowFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.yml'));

  let deployed = 0;

  for (const filename of workflowFiles) {
    const filePath = path.join(templatesDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      // Check if file already exists
      if (options.skipExisting) {
        try {
          await octokit.repos.getContent({
            owner,
            repo,
            path: `.github/workflows/${filename}`,
          });

          // File exists, skip
          continue;
        } catch {
          // File doesn't exist, continue with deployment
        }
      }

      // Create or update workflow file
      await createOrUpdateFile(octokit, owner, repo, `.github/workflows/${filename}`, content);

      deployed++;
    } catch (error) {
      console.warn(`Warning: Failed to deploy workflow ${filename}:`, error);
      // Continue with other workflows
    }
  }

  return deployed;
}

/**
 * Create or update a file in the repository
 */
async function createOrUpdateFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string
): Promise<void> {
  // Check if file exists
  let sha: string | undefined;

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('sha' in data) {
      sha = data.sha;
    }
  } catch {
    // File doesn't exist
  }

  // Create or update
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: sha
      ? `chore: Update workflow ${path.split('/').pop()}`
      : `chore: Add workflow ${path.split('/').pop()}`,
    content: Buffer.from(content).toString('base64'),
    sha,
  });
}
