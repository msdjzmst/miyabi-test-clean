/**
 * Issue analysis and auto-labeling module
 *
 * Analyzes existing Issues and automatically assigns appropriate labels
 */

import { Octokit } from '@octokit/rest';

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
}

/**
 * Auto-label all open Issues in repository
 */
export async function autoLabelIssues(
  owner: string,
  repo: string,
  token: string
): Promise<number> {
  const octokit = new Octokit({ auth: token });

  // Fetch all open Issues
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  let labeled = 0;

  for (const issue of issues) {
    // Skip if already has state label
    if (hasStateLabel(issue.labels)) {
      continue;
    }

    // Infer labels from title and body
    const inferredLabels = inferLabels(issue.title, issue.body || '');

    if (inferredLabels.length > 0) {
      try {
        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: issue.number,
          labels: inferredLabels,
        });

        labeled++;
      } catch {
        // Skip if labeling fails
        continue;
      }
    }
  }

  return labeled;
}

/**
 * Check if Issue already has a state label
 */
function hasStateLabel(labels: any[]): boolean {
  const stateLabels = [
    'state:pending',
    'state:analyzing',
    'state:implementing',
    'state:reviewing',
    'state:done',
    'state:blocked',
    'state:paused',
  ];

  return labels.some((label) => {
    const name = typeof label === 'string' ? label : label.name;
    return stateLabels.some((state) => name.includes(state));
  });
}

/**
 * Infer appropriate labels from Issue title and body
 */
function inferLabels(title: string, body: string): string[] {
  const labels: string[] = [];
  const text = `${title} ${body}`.toLowerCase();

  // Type labels
  if (
    text.includes('bug') ||
    text.includes('error') ||
    text.includes('fix') ||
    text.includes('broken')
  ) {
    labels.push('🐛 type:bug');
  } else if (
    text.includes('feature') ||
    text.includes('add') ||
    text.includes('implement') ||
    text.includes('create')
  ) {
    labels.push('✨ type:feature');
  } else if (
    text.includes('doc') ||
    text.includes('readme') ||
    text.includes('guide') ||
    text.includes('documentation')
  ) {
    labels.push('📚 type:docs');
  } else if (
    text.includes('refactor') ||
    text.includes('cleanup') ||
    text.includes('improve')
  ) {
    labels.push('♻️ type:refactor');
  } else if (
    text.includes('test') ||
    text.includes('coverage') ||
    text.includes('spec')
  ) {
    labels.push('🧪 type:test');
  }

  // Priority labels
  if (
    text.includes('urgent') ||
    text.includes('critical') ||
    text.includes('production') ||
    text.includes('p0')
  ) {
    labels.push('📊 priority:P0-Critical');
  } else if (
    text.includes('important') ||
    text.includes('high priority') ||
    text.includes('p1')
  ) {
    labels.push('⚠️ priority:P1-High');
  } else {
    labels.push('📊 priority:P2-Medium');
  }

  // State label (default: pending)
  labels.push('📥 state:pending');

  // Phase label (default: planning)
  labels.push('🎯 phase:planning');

  // Special labels
  if (
    text.includes('security') ||
    text.includes('vulnerability') ||
    text.includes('exploit')
  ) {
    labels.push('🔒 special:security');
  }

  if (
    text.includes('easy') ||
    text.includes('beginner') ||
    text.includes('good first')
  ) {
    labels.push('👋 good-first-issue');
  }

  return labels;
}
