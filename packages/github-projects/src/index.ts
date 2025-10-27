/**
 * @agentic-os/github-projects
 *
 * GitHub Projects V2 API SDK
 * Provides TypeScript SDK for interacting with GitHub Projects V2 (GraphQL API)
 *
 * Issue #5 Phase A: Data Persistence Layer
 */

export { GitHubProjectsClient } from './client';
export { GitHubProjectSetup } from './setup';
export type {
  ProjectConfig,
  CustomField,
  ProjectItem,
  AgentMetrics,
  WeeklyReport,
  ProjectItemContent,
  FieldValue,
  SingleSelectField,
  NumberField,
  TextField,
  DateField,
  IterationField,
} from './types';
