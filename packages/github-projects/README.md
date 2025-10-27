# @agentic-os/github-projects

GitHub Projects V2 API SDK for TypeScript

## Overview

A comprehensive TypeScript SDK for interacting with GitHub Projects V2 (Beta) using the GraphQL API. This package provides type-safe access to project data, custom fields, and automated workflows.

## Features

- Full TypeScript support with strict types
- GraphQL-based API client
- Automatic rate limit handling with exponential backoff
- Custom field management (Text, Number, Date, Single Select, Iteration)
- Agent metrics calculation
- Weekly report generation
- Project setup and configuration utilities

## Installation

```bash
npm install @agentic-os/github-projects
```

## Quick Start

```typescript
import { GitHubProjectsClient } from '@agentic-os/github-projects';

// Initialize client
const client = new GitHubProjectsClient({
  token: process.env.GITHUB_TOKEN,
  project: {
    owner: 'your-username',
    repo: 'your-repo',
    projectNumber: 1,
  },
});

// Get project info
const info = await client.getProjectInfo();
console.log(info);

// Get all items
const items = await client.getProjectItems();

// Calculate metrics
const metrics = await client.calculateAgentMetrics();

// Generate weekly report
const report = await client.generateWeeklyReport();
```

## API Reference

### GitHubProjectsClient

Main client for interacting with GitHub Projects V2.

#### Constructor

```typescript
new GitHubProjectsClient(config: ClientConfig)
```

**ClientConfig:**
- `token: string` - GitHub Personal Access Token with `project` scope
- `project: ProjectConfig` - Project configuration
  - `owner: string` - Repository owner
  - `repo: string` - Repository name
  - `projectNumber: number` - Project number
- `retryOnRateLimit?: boolean` - Enable automatic retry on rate limits (default: true)
- `maxRetries?: number` - Maximum retry attempts (default: 3)

#### Methods

##### getProjectInfo()

Get complete project information including custom fields.

```typescript
async getProjectInfo(): Promise<ProjectInfo>
```

**Returns:** Project ID, number, title, URL, and all custom fields

##### getProjectItems(limit?)

Get all items in the project.

```typescript
async getProjectItems(limit = 100): Promise<ProjectItem[]>
```

**Parameters:**
- `limit?: number` - Maximum items per request (default: 100)

**Returns:** Array of project items with content and field values

##### getProjectItemByNumber(contentNumber)

Get a specific project item by issue/PR number.

```typescript
async getProjectItemByNumber(contentNumber: number): Promise<ProjectItem | null>
```

##### updateFieldValue(input)

Update a custom field value for a project item.

```typescript
async updateFieldValue(input: UpdateFieldValueInput): Promise<void>
```

**UpdateFieldValueInput:**
- `projectId: string`
- `itemId: string`
- `fieldId: string`
- `value: string | number | { singleSelectOptionId: string }`

##### setSingleSelectFieldByName(itemId, fieldName, optionName)

Set single select field value by option name.

```typescript
async setSingleSelectFieldByName(
  itemId: string,
  fieldName: string,
  optionName: string
): Promise<void>
```

##### setNumberField(itemId, fieldName, value)

Set number field value.

```typescript
async setNumberField(
  itemId: string,
  fieldName: string,
  value: number
): Promise<void>
```

##### calculateAgentMetrics()

Calculate agent performance metrics from project items.

```typescript
async calculateAgentMetrics(): Promise<AgentMetrics[]>
```

**Returns:** Agent execution stats including:
- `agent: string` - Agent name
- `executionCount: number` - Total executions
- `avgDuration: number` - Average duration in ms
- `avgCost: number` - Average cost in USD
- `avgQualityScore: number` - Average quality score (0-100)
- `totalCost: number` - Total cost
- `successRate: number` - Success rate (0-1)

##### generateWeeklyReport()

Generate comprehensive weekly report.

```typescript
async generateWeeklyReport(): Promise<WeeklyReport>
```

**Returns:** Weekly metrics including:
- Total and completed issues
- Agent performance metrics
- Top quality issues
- Cost breakdown
- Completion rate

##### getRateLimitInfo()

Get current GraphQL API rate limit information.

```typescript
async getRateLimitInfo(): Promise<RateLimitInfo>
```

### GitHubProjectSetup

Utilities for creating and configuring new projects.

#### Constructor

```typescript
new GitHubProjectSetup(token: string)
```

#### Methods

##### createProject(config)

Create a new GitHub Project V2.

```typescript
async createProject(config: ProjectSetupConfig): Promise<{
  projectId: string;
  projectNumber: number;
  url: string;
}>
```

##### addCustomField(projectId, field)

Add a custom field to the project.

```typescript
async addCustomField(
  projectId: string,
  field: CustomFieldConfig
): Promise<string>
```

**CustomFieldConfig:**
- `name: string` - Field name
- `dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION'`
- `options?: string[]` - Options for SINGLE_SELECT fields

##### setupCompleteProject(owner, projectTitle)

Setup a complete project with all standard custom fields.

```typescript
async setupCompleteProject(
  owner: string,
  projectTitle: string
): Promise<{
  projectId: string;
  projectNumber: number;
  url: string;
}>
```

Creates a project with these fields:
- **Agent** (Single Select): CodeGen, Review, Deploy, Coordinator, TechLead
- **Duration** (Number): Execution time in milliseconds
- **Cost** (Number): API cost in USD
- **Quality Score** (Number): 0-100
- **Sprint** (Iteration): Sprint tracking

## Examples

### Setup New Project

```typescript
import { GitHubProjectSetup } from '@agentic-os/github-projects';

const setup = new GitHubProjectSetup(process.env.GITHUB_TOKEN);

const { projectId, projectNumber, url } = await setup.setupCompleteProject(
  'your-username',
  'My Agentic Project'
);

console.log(`Project created: ${url}`);
console.log(`Project number: ${projectNumber}`);
```

### Update Issue Fields

```typescript
const client = new GitHubProjectsClient({
  token: process.env.GITHUB_TOKEN,
  project: { owner: 'user', repo: 'repo', projectNumber: 1 },
});

// Get issue item
const item = await client.getProjectItemByNumber(123);

if (item) {
  // Set agent field
  await client.setSingleSelectFieldByName(item.id, 'Agent', 'CodeGen');

  // Set quality score
  await client.setNumberField(item.id, 'Quality Score', 95);

  // Set cost
  await client.setNumberField(item.id, 'Cost', 0.05);
}
```

### Generate Metrics Report

```typescript
const metrics = await client.calculateAgentMetrics();

for (const metric of metrics) {
  console.log(`Agent: ${metric.agent}`);
  console.log(`  Executions: ${metric.executionCount}`);
  console.log(`  Avg Duration: ${metric.avgDuration}ms`);
  console.log(`  Avg Cost: $${metric.avgCost.toFixed(4)}`);
  console.log(`  Quality Score: ${metric.avgQualityScore.toFixed(1)}/100`);
  console.log(`  Success Rate: ${(metric.successRate * 100).toFixed(1)}%`);
}
```

## Error Handling

The SDK includes custom error types:

```typescript
import {
  ProjectNotFoundError,
  FieldNotFoundError,
  ItemNotFoundError,
  RateLimitExceededError,
} from '@agentic-os/github-projects';

try {
  await client.getProjectInfo();
} catch (error) {
  if (error instanceof ProjectNotFoundError) {
    console.error('Project not found');
  } else if (error instanceof RateLimitExceededError) {
    console.error(`Rate limit exceeded. Resets at: ${error.resetAt}`);
  }
}
```

## Rate Limiting

The SDK automatically handles GitHub's GraphQL API rate limits:

- Exponential backoff retry strategy
- Configurable retry attempts (default: 3)
- Rate limit info accessible via `getRateLimitInfo()`

## Requirements

- Node.js 18+
- GitHub Personal Access Token with `project` scope
- TypeScript 5.0+

## Related Workflows

This SDK powers these GitHub Actions workflows:

- **project-sync.yml** - Auto-add issues to project
- **project-pr-sync.yml** - Sync PR status to project
- **weekly-report.yml** - Generate weekly metrics report

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Issue Tracking

Part of Issue #5 Phase A: Data Persistence Layer
