#!/usr/bin/env tsx
/**
 * GitHub Projects V2 API Integration
 *
 * Provides functions to interact with GitHub Projects V2 (GraphQL API)
 * - Query project data
 * - Set custom fields
 * - Fetch project items
 * - Generate reports
 *
 * Issue #5 Phase A: Data Persistence Layer
 */

import { graphql } from '@octokit/graphql';

// ============================================================================
// Types
// ============================================================================

export interface ProjectConfig {
  owner: string;
  repo: string;
  projectNumber: number;
}

export interface CustomField {
  id: string;
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
  options?: Array<{ id: string; name: string }>;
}

export interface ProjectItem {
  id: string;
  content: {
    id: string;
    number: number;
    title: string;
    url: string;
    state: string;
  };
  fieldValues: {
    nodes: Array<{
      field: { name: string };
      name?: string;
      number?: number;
      date?: string;
    }>;
  };
}

export interface AgentMetrics {
  agent: string;
  executionCount: number;
  avgDuration: number;
  avgCost: number;
  avgQualityScore: number;
  totalCost: number;
}

export interface WeeklyReport {
  week: string;
  totalIssues: number;
  completedIssues: number;
  agentMetrics: AgentMetrics[];
  topQualityIssues: Array<{ number: number; title: string; score: number }>;
  totalCost: number;
}

// ============================================================================
// GitHub Projects V2 API Client
// ============================================================================

export class GitHubProjectAPI {
  private graphqlClient: typeof graphql;
  private config: ProjectConfig;

  constructor(token: string, config: ProjectConfig) {
    this.graphqlClient = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
    this.config = config;
  }

  // ==========================================================================
  // Project Queries
  // ==========================================================================

  /**
   * Get Project ID and custom field definitions
   */
  async getProjectInfo(): Promise<{
    projectId: string;
    fields: CustomField[];
  }> {
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

    try {
      const result: any = await this.graphqlClient(query, {
        owner: this.config.owner,
        number: this.config.projectNumber,
      });

      const project = result.user.projectV2;

      return {
        projectId: project.id,
        fields: project.fields.nodes.map((field: any) => ({
          id: field.id,
          name: field.name,
          dataType: field.dataType,
          options: field.options,
        })),
      };
    } catch (error) {
      console.error('Failed to get project info:', error);
      throw error;
    }
  }

  /**
   * Get all items in the project
   */
  async getProjectItems(): Promise<ProjectItem[]> {
    const { projectId } = await this.getProjectInfo();

    const query = `
      query($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                    title
                    url
                    state
                  }
                  ... on PullRequest {
                    id
                    number
                    title
                    url
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
                    ... on ProjectV2ItemFieldDateValue {
                      field {
                        ... on ProjectV2Field {
                          name
                        }
                      }
                      date
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

    try {
      const result: any = await this.graphqlClient(query, {
        projectId,
        cursor: null,
      });

      const items = result.node.items.nodes;

      return items.map((item: any) => ({
        id: item.id,
        content: item.content,
        fieldValues: item.fieldValues,
      }));
    } catch (error) {
      console.error('Failed to get project items:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Custom Field Updates
  // ==========================================================================

  /**
   * Set custom field value for a project item
   */
  async setCustomField(
    itemId: string,
    fieldId: string,
    value: string | number,
  ): Promise<void> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: $value
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const { projectId } = await this.getProjectInfo();

    try {
      await this.graphqlClient(mutation, {
        projectId,
        itemId,
        fieldId,
        value: typeof value === 'number' ? { number: value } : { text: value },
      });
    } catch (error) {
      console.error('Failed to set custom field:', error);
      throw error;
    }
  }

  /**
   * Set single select field value
   */
  async setSingleSelectField(
    itemId: string,
    fieldId: string,
    optionId: string,
  ): Promise<void> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const { projectId } = await this.getProjectInfo();

    try {
      await this.graphqlClient(mutation, {
        projectId,
        itemId,
        fieldId,
        optionId,
      });
    } catch (error) {
      console.error('Failed to set single select field:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Agent Metrics
  // ==========================================================================

  /**
   * Calculate agent metrics from project items
   */
  async calculateAgentMetrics(): Promise<AgentMetrics[]> {
    const items = await this.getProjectItems();

    const agentData: Record<
    string,
    {
      count: number;
      totalDuration: number;
      totalCost: number;
      totalQuality: number;
    }
    > = {};

    for (const item of items) {
      const agent = this.getFieldValue(item, 'Agent');
      const duration = this.getFieldValue(item, 'Duration') as number;
      const cost = this.getFieldValue(item, 'Cost') as number;
      const quality = this.getFieldValue(item, 'Quality Score') as number;

      if (!agent || agent === 'N/A') {continue;}

      if (!agentData[agent]) {
        agentData[agent] = {
          count: 0,
          totalDuration: 0,
          totalCost: 0,
          totalQuality: 0,
        };
      }

      agentData[agent].count++;
      if (duration) {agentData[agent].totalDuration += duration;}
      if (cost) {agentData[agent].totalCost += cost;}
      if (quality) {agentData[agent].totalQuality += quality;}
    }

    return Object.entries(agentData).map(([agent, data]) => ({
      agent,
      executionCount: data.count,
      avgDuration: data.totalDuration / data.count,
      avgCost: data.totalCost / data.count,
      avgQualityScore: data.totalQuality / data.count,
      totalCost: data.totalCost,
    }));
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const items = await this.getProjectItems();
    const agentMetrics = await this.calculateAgentMetrics();

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const completedIssues = items.filter(
      (item) =>
        item.content.state === 'CLOSED' || item.content.state === 'MERGED',
    );

    const topQualityIssues = items
      .map((item) => ({
        number: item.content.number,
        title: item.content.title,
        score: (this.getFieldValue(item, 'Quality Score') as number) || 0,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const totalCost = agentMetrics.reduce(
      (sum, metric) => sum + metric.totalCost,
      0,
    );

    return {
      week: `${weekStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      totalIssues: items.length,
      completedIssues: completedIssues.length,
      agentMetrics,
      topQualityIssues,
      totalCost,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getFieldValue(
    item: ProjectItem,
    fieldName: string,
  ): string | number | null {
    const fieldValue = item.fieldValues.nodes.find(
      (node) => node.field.name === fieldName,
    );

    if (!fieldValue) {return null;}

    return fieldValue.name || fieldValue.number || fieldValue.date || null;
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const config: ProjectConfig = {
    owner: process.env.GITHUB_OWNER || 'ShunsukeHayashi',
    repo: process.env.GITHUB_REPO || 'Autonomous-Operations',
    projectNumber: parseInt(process.env.PROJECT_NUMBER || '1', 10),
  };

  const api = new GitHubProjectAPI(token, config);

  const command = process.argv[2];

  try {
    switch (command) {
      case 'info':
        console.log('📊 Fetching project info...');
        const info = await api.getProjectInfo();
        console.log(JSON.stringify(info, null, 2));
        break;

      case 'items':
        console.log('📋 Fetching project items...');
        const items = await api.getProjectItems();
        console.log(JSON.stringify(items, null, 2));
        break;

      case 'metrics':
        console.log('📈 Calculating agent metrics...');
        const metrics = await api.calculateAgentMetrics();
        console.log(JSON.stringify(metrics, null, 2));
        break;

      case 'report':
        console.log('📊 Generating weekly report...');
        const report = await api.generateWeeklyReport();
        console.log(JSON.stringify(report, null, 2));
        break;

      default:
        console.log(`
GitHub Projects V2 API Client

Usage:
  npm run project:info      - Get project info and custom fields
  npm run project:items     - List all project items
  npm run project:metrics   - Calculate agent metrics
  npm run project:report    - Generate weekly report

Environment Variables:
  GITHUB_TOKEN      - GitHub Personal Access Token (required)
  GITHUB_OWNER      - Repository owner (default: ShunsukeHayashi)
  GITHUB_REPO       - Repository name (default: Autonomous-Operations)
  PROJECT_NUMBER    - Project number (default: 1)
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// ESM module check
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export default GitHubProjectAPI;
