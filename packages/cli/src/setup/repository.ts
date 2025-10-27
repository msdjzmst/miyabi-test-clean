/**
 * Repository creation module
 */

import { Octokit } from '@octokit/rest';

export async function createRepository(
  name: string,
  token: string,
  isPrivate: boolean = false
): Promise<any> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    description: 'Autonomous development powered by Agentic OS',
    private: isPrivate,
    has_issues: true,
    has_projects: true,
    has_wiki: false,
    auto_init: true, // Initialize with README
    gitignore_template: 'Node',
    license_template: 'mit',
  });

  return data;
}
