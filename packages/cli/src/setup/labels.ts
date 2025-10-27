/**
 * Labels setup module
 *
 * Creates 53 labels across 10 categories from .github/labels.yml
 */

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Label {
  name: string;
  color: string;
  description: string;
}

interface SetupOptions {
  merge?: boolean; // If true, merge with existing labels
}

export async function setupLabels(
  owner: string,
  repo: string,
  token: string,
  options: SetupOptions = {}
): Promise<{ created: number; updated: number }> {
  const octokit = new Octokit({ auth: token });

  // Load labels from template
  const labels = await loadLabelsFromTemplate();

  let created = 0;
  let updated = 0;

  // Get existing labels if merge mode
  let existingLabels: string[] = [];

  if (options.merge) {
    const { data } = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });
    existingLabels = data.map((label) => label.name);
  }

  // Create or update each label
  for (const label of labels) {
    try {
      if (existingLabels.includes(label.name)) {
        // Update existing label
        await octokit.issues.updateLabel({
          owner,
          repo,
          name: label.name,
          color: label.color.replace('#', ''),
          description: label.description,
        });
        updated++;
        console.log(`  ✓ ${label.name} (updated)`);
      } else {
        // Create new label
        await octokit.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color.replace('#', ''),
          description: label.description,
        });
        created++;
        console.log(`  ✓ ${label.name}`);
      }
    } catch (error: any) {
      // Handle specific errors
      if (error.status === 422) {
        // Label already exists (race condition)
        console.log(`  - ${label.name} (already exists)`);
      } else if (error.status === 403) {
        // Permission denied
        console.error(`  ✗ ${label.name} (permission denied)`);
        throw new Error(
          `Failed to create label "${label.name}": Permission denied. ` +
          'Please ensure your GitHub token has "repo" and "admin:org" scopes.'
        );
      } else if (error.status === 404) {
        // Repository not found
        throw new Error(
          `Repository "${owner}/${repo}" not found. ` +
          'Please check the repository name and ensure your token has access.'
        );
      } else {
        // Unknown error
        console.error(`  ✗ ${label.name} (${error.message})`);
        throw error;
      }
    }
  }

  return { created, updated };
}

/**
 * Load labels from .github/labels.yml template
 */
async function loadLabelsFromTemplate(): Promise<Label[]> {
  // Get template path (relative to this file)
  // In dist, __dirname points to dist/setup, templates are at project root
  // dist/setup -> dist -> project root -> templates
  const templatePath = path.join(__dirname, '../../templates/labels.yml');

  if (!fs.existsSync(templatePath)) {
    // Fallback: load from project root
    const rootPath = path.join(process.cwd(), '.github', 'labels.yml');

    if (!fs.existsSync(rootPath)) {
      throw new Error(`labels.yml template not found at ${templatePath} or ${rootPath}`);
    }

    const content = fs.readFileSync(rootPath, 'utf-8');
    return parseYaml(content) as Label[];
  }

  const content = fs.readFileSync(templatePath, 'utf-8');
  return parseYaml(content) as Label[];
}
