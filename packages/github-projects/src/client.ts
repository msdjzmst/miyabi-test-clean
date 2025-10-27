/**
 * GitHub Projects V2 API Client
 *
 * Main SDK client for interacting with GitHub Projects V2
 *
 * Issue #5 Phase A: Data Persistence Layer
 * Issue #41: Added retry logic with exponential backoff for all API calls
 */

import { graphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';
import type {
  ProjectConfig,
  ProjectInfo,
  ProjectItem,
  CustomField,
  AgentMetrics,
  WeeklyReport,
  UpdateFieldValueInput,
  RateLimitInfo,
} from './types';
import {
  ProjectNotFoundError,
  FieldNotFoundError,
} from './types';
import { withRetry, type GitHubRetryConfig } from '@miyabi/agent-sdk';

// ============================================================================
// Client Configuration
// ============================================================================

interface ClientConfig {
  token: string;
  project: ProjectConfig;
  /** @deprecated Use retryConfig instead. Legacy support maintained for backward compatibility. */
  retryOnRateLimit?: boolean;
  /** @deprecated Use retryConfig.retries instead. Legacy support maintained for backward compatibility. */
  maxRetries?: number;
  /** Optional retry configuration (uses defaults if not specified) */
  retryConfig?: Partial<GitHubRetryConfig>;
}

// ============================================================================
// GitHub Projects V2 Client
// ============================================================================

export class GitHubProjectsClient {
  private octokit: Octokit;
  private graphqlClient: typeof graphql;
  private config: ProjectConfig;
  private retryConfig?: Partial<GitHubRetryConfig>;
  // Legacy properties for backward compatibility
  private _retryOnRateLimit: boolean; // Unused but kept for backward compatibility
  private maxRetries: number;

  constructor(clientConfig: ClientConfig) {
    this.octokit = new Octokit({ auth: clientConfig.token });
    this.graphqlClient = graphql.defaults({
      headers: { authorization: `token ${clientConfig.token}` },
    });
    this.config = clientConfig.project;

    // Support new retry config or legacy properties
    if (clientConfig.retryConfig) {
      this.retryConfig = clientConfig.retryConfig;
      this._retryOnRateLimit = true;
      this.maxRetries = clientConfig.retryConfig.retries ?? 3;
    } else {
      // Legacy support
      this._retryOnRateLimit = clientConfig.retryOnRateLimit ?? true;
      this.maxRetries = clientConfig.maxRetries ?? 3;
      this.retryConfig = {
        retries: this.maxRetries,
      };
    }

    // Suppress unused variable warning - kept for backward compatibility
    void this._retryOnRateLimit;
  }

  // ==========================================================================
  // Project Queries
  // ==========================================================================

  /**
   * Get complete project information including custom fields
   */
  async getProjectInfo(): Promise<ProjectInfo> {
    const query = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            number
            title
            url
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
                    description
                    color
                  }
                }
                ... on ProjectV2IterationField {
                  id
                  name
                  dataType
                  configuration {
                    iterations {
                      id
                      title
                      startDate
                      duration
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
      const result: any = await this.executeQuery(query, {
        owner: this.config.owner,
        number: this.config.projectNumber,
      });

      const project = result.user.projectV2;

      if (!project) {
        throw new ProjectNotFoundError(this.config.projectNumber);
      }

      return {
        projectId: project.id,
        projectNumber: project.number,
        title: project.title,
        url: project.url,
        fields: project.fields.nodes as CustomField[],
      };
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }
      console.error('Failed to get project info:', error);
      throw error;
    }
  }

  /**
   * Get all items in the project
   */
  async getProjectItems(limit = 100): Promise<ProjectItem[]> {
    const { projectId } = await this.getProjectInfo();

    const query = `
      query($projectId: ID!, $cursor: String, $limit: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $limit, after: $cursor) {
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
                    createdAt
                    closedAt
                    updatedAt
                  }
                  ... on PullRequest {
                    id
                    number
                    title
                    url
                    state
                    createdAt
                    closedAt
                    updatedAt
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
                      optionId
                    }
                    ... on ProjectV2ItemFieldIterationValue {
                      field {
                        ... on ProjectV2IterationField {
                          name
                        }
                      }
                      title
                      duration
                      startDate
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
      const result: any = await this.executeQuery(query, {
        projectId,
        cursor: null,
        limit,
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

  /**
   * Get a specific project item by issue/PR number
   */
  async getProjectItemByNumber(
    contentNumber: number
  ): Promise<ProjectItem | null> {
    const items = await this.getProjectItems();
    return items.find((item) => item.content.number === contentNumber) || null;
  }

  // ==========================================================================
  // Custom Field Updates
  // ==========================================================================

  /**
   * Update a custom field value for a project item
   */
  async updateFieldValue(input: UpdateFieldValueInput): Promise<void> {
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

    try {
      await this.executeMutation(mutation, {
        projectId: input.projectId,
        itemId: input.itemId,
        fieldId: input.fieldId,
        value:
          typeof input.value === 'number'
            ? { number: input.value }
            : typeof input.value === 'string'
              ? { text: input.value }
              : input.value,
      });
    } catch (error) {
      console.error('Failed to update field value:', error);
      throw error;
    }
  }

  /**
   * Set single select field value by option name
   */
  async setSingleSelectFieldByName(
    itemId: string,
    fieldName: string,
    optionName: string
  ): Promise<void> {
    const { projectId, fields } = await this.getProjectInfo();

    const field = fields.find(
      (f) => f.name === fieldName && f.dataType === 'SINGLE_SELECT'
    );

    if (!field) {
      throw new FieldNotFoundError(fieldName);
    }

    const singleSelectField = field as any;
    const option = singleSelectField.options?.find(
      (o: any) => o.name === optionName
    );

    if (!option) {
      throw new Error(
        `Option "${optionName}" not found in field "${fieldName}"`
      );
    }

    await this.updateFieldValue({
      projectId,
      itemId,
      fieldId: field.id,
      value: { singleSelectOptionId: option.id },
    });
  }

  /**
   * Set number field value
   */
  async setNumberField(
    itemId: string,
    fieldName: string,
    value: number
  ): Promise<void> {
    const { projectId, fields } = await this.getProjectInfo();

    const field = fields.find((f) => f.name === fieldName);

    if (!field) {
      throw new FieldNotFoundError(fieldName);
    }

    await this.updateFieldValue({
      projectId,
      itemId,
      fieldId: field.id,
      value,
    });
  }

  // ==========================================================================
  // Metrics & Analytics
  // ==========================================================================

  /**
   * Calculate agent performance metrics from project items
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
        successes: number;
      }
    > = {};

    for (const item of items) {
      const agent = this.getFieldValue(item, 'Agent') as string;
      const duration = (this.getFieldValue(item, 'Duration') as number) || 0;
      const cost = (this.getFieldValue(item, 'Cost') as number) || 0;
      const quality =
        (this.getFieldValue(item, 'Quality Score') as number) || 0;

      if (!agent || agent === 'N/A') continue;

      if (!agentData[agent]) {
        agentData[agent] = {
          count: 0,
          totalDuration: 0,
          totalCost: 0,
          totalQuality: 0,
          successes: 0,
        };
      }

      agentData[agent].count++;
      agentData[agent].totalDuration += duration;
      agentData[agent].totalCost += cost;
      agentData[agent].totalQuality += quality;

      if (
        item.content.state === 'CLOSED' ||
        item.content.state === 'MERGED'
      ) {
        agentData[agent].successes++;
      }
    }

    return Object.entries(agentData).map(([agent, data]) => ({
      agent,
      executionCount: data.count,
      avgDuration: data.totalDuration / data.count,
      avgCost: data.totalCost / data.count,
      avgQualityScore: data.totalQuality / data.count,
      totalCost: data.totalCost,
      successRate: data.successes / data.count,
    }));
  }

  /**
   * Generate weekly report with comprehensive metrics
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const items = await this.getProjectItems();
    const agentMetrics = await this.calculateAgentMetrics();

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const completedIssues = items.filter(
      (item) =>
        item.content.state === 'CLOSED' || item.content.state === 'MERGED'
    );

    const topQualityIssues = items
      .map((item) => ({
        number: item.content.number,
        title: item.content.title,
        url: item.content.url,
        score: (this.getFieldValue(item, 'Quality Score') as number) || 0,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const totalCost = agentMetrics.reduce(
      (sum, metric) => sum + metric.totalCost,
      0
    );

    const avgQualityScore =
      agentMetrics.reduce((sum, m) => sum + m.avgQualityScore, 0) /
      (agentMetrics.length || 1);

    const completionRate = completedIssues.length / (items.length || 1);

    return {
      week: `${weekStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      totalIssues: items.length,
      completedIssues: completedIssues.length,
      agentMetrics,
      topQualityIssues,
      totalCost,
      avgQualityScore,
      completionRate,
    };
  }

  // ==========================================================================
  // Rate Limit Handling
  // ==========================================================================

  /**
   * Get current rate limit information (with automatic retry on transient failures)
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    return withRetry(async () => {
      const { data } = await this.octokit.rest.rateLimit.get();
      const graphqlLimit = data.resources.graphql;

      if (!graphqlLimit) {
        throw new Error('GraphQL rate limit information not available');
      }

      return {
        limit: graphqlLimit.limit,
        remaining: graphqlLimit.remaining,
        reset: new Date(graphqlLimit.reset * 1000),
        used: graphqlLimit.used,
      };
    }, this.retryConfig);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get field value from project item
   */
  private getFieldValue(
    item: ProjectItem,
    fieldName: string
  ): string | number | null {
    const fieldValue = item.fieldValues.nodes.find(
      (node: any) => node.field?.name === fieldName
    );

    if (!fieldValue) return null;

    const value = fieldValue as any;
    return value.name || value.number || value.date || value.text || null;
  }

  /**
   * Execute GraphQL query with retry logic (using p-retry with exponential backoff)
   */
  private async executeQuery(
    query: string,
    variables: Record<string, any>
  ): Promise<any> {
    return withRetry(
      async () => await this.graphqlClient(query, variables),
      this.retryConfig
    );
  }

  /**
   * Execute GraphQL mutation with retry logic
   */
  private async executeMutation(
    mutation: string,
    variables: Record<string, any>
  ): Promise<any> {
    return this.executeQuery(mutation, variables);
  }
}
