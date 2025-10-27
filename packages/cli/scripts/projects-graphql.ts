/**
 * GitHub Projects V2 GraphQL Helper
 *
 * Provides utilities for querying and updating Projects V2 via GraphQL API
 * Addresses Issue #5 - Phase A: Data Persistence Layer
 */

import { graphql } from '@octokit/graphql';

interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string }[];
}

interface ProjectItem {
  id: string;
  content: {
    number: number;
    title: string;
    state: string;
  };
  fieldValues: {
    nodes: Array<{
      field: { name: string };
      value?: string;
    }>;
  };
}

/**
 * Get Project V2 ID and fields
 */
export async function getProjectInfo(
  owner: string,
  projectNumber: number,
  token: string
): Promise<{ projectId: string; fields: ProjectField[] }> {
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          title
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const result: any = await graphqlWithAuth(query, { owner, number: projectNumber });

  return {
    projectId: result.user.projectV2.id,
    fields: result.user.projectV2.fields.nodes,
  };
}

/**
 * Add Issue/PR to Project V2
 */
export async function addItemToProject(
  projectId: string,
  contentId: string,
  token: string
): Promise<string> {
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }
  `;

  const result: any = await graphqlWithAuth(mutation, { projectId, contentId });
  return result.addProjectV2ItemById.item.id;
}

/**
 * Update Project V2 item field value
 */
export async function updateProjectField(
  projectId: string,
  itemId: string,
  fieldId: string,
  value: string | number,
  token: string
): Promise<void> {
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  // Determine value type based on input
  let valueInput: any;
  if (typeof value === 'number') {
    valueInput = `{ number: ${value} }`;
  } else {
    valueInput = `{ text: "${value}" }`;
  }

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: $value
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;

  await graphqlWithAuth(mutation, {
    projectId,
    itemId,
    fieldId,
    value: valueInput,
  });
}

/**
 * Update single-select field (e.g., Agent, Priority)
 */
export async function updateSingleSelectField(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
  token: string
): Promise<void> {
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;

  await graphqlWithAuth(mutation, { projectId, itemId, fieldId, optionId });
}

/**
 * Get all items in a project with field values
 */
export async function getProjectItems(
  owner: string,
  projectNumber: number,
  token: string
): Promise<ProjectItem[]> {
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                  state
                }
                ... on PullRequest {
                  number
                  title
                  state
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue {
                    field {
                      ... on ProjectV2Field {
                        name
                      }
                    }
                    text
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    field {
                      ... on ProjectV2Field {
                        name
                      }
                    }
                    number
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result: any = await graphqlWithAuth(query, { owner, number: projectNumber });
  return result.user.projectV2.items.nodes;
}

/**
 * Generate weekly report from project data
 */
export async function generateWeeklyReport(
  owner: string,
  projectNumber: number,
  token: string
): Promise<string> {
  const items = await getProjectItems(owner, projectNumber, token);

  const completedThisWeek = items.filter((item) => {
    const state = item.content.state;
    return state === 'CLOSED' || state === 'MERGED';
  });

  const inProgress = items.filter((item) => {
    const state = item.content.state;
    return state === 'OPEN';
  });

  let report = `# Weekly Project Report\n\n`;
  report += `**Date**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Items**: ${items.length}\n`;
  report += `- **Completed This Week**: ${completedThisWeek.length}\n`;
  report += `- **In Progress**: ${inProgress.length}\n\n`;

  report += `## Completed Items\n\n`;
  completedThisWeek.forEach((item) => {
    report += `- #${item.content.number}: ${item.content.title}\n`;
  });

  report += `\n## In Progress\n\n`;
  inProgress.forEach((item) => {
    report += `- #${item.content.number}: ${item.content.title}\n`;
  });

  return report;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const owner = process.env.GITHUB_OWNER || 'ShunsukeHayashi';
  const projectNumber = parseInt(process.env.PROJECT_NUMBER || '1');
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  switch (command) {
    case 'info':
      getProjectInfo(owner, projectNumber, token)
        .then((info) => {
          console.log('Project ID:', info.projectId);
          console.log('\nFields:');
          info.fields.forEach((field) => {
            console.log(`- ${field.name} (${field.dataType})`);
            if (field.options) {
              field.options.forEach((opt) => console.log(`  - ${opt.name}`));
            }
          });
        })
        .catch(console.error);
      break;

    case 'items':
      getProjectItems(owner, projectNumber, token)
        .then((items) => {
          console.log(`Found ${items.length} items:\n`);
          items.forEach((item) => {
            console.log(`#${item.content.number}: ${item.content.title}`);
            console.log(`  State: ${item.content.state}`);
          });
        })
        .catch(console.error);
      break;

    case 'report':
      generateWeeklyReport(owner, projectNumber, token)
        .then((report) => console.log(report))
        .catch(console.error);
      break;

    default:
      console.log('Usage: tsx scripts/projects-graphql.ts <command>');
      console.log('Commands: info, items, report');
      break;
  }
}
