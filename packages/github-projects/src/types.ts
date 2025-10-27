/**
 * TypeScript Type Definitions for GitHub Projects V2 API
 *
 * Issue #5 Phase A: Data Persistence Layer
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ProjectConfig {
  owner: string;
  repo: string;
  projectNumber: number;
}

// ============================================================================
// Field Types
// ============================================================================

export type FieldDataType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SINGLE_SELECT'
  | 'ITERATION';

export interface BaseField {
  id: string;
  name: string;
  dataType: FieldDataType;
}

export interface TextField extends BaseField {
  dataType: 'TEXT';
}

export interface NumberField extends BaseField {
  dataType: 'NUMBER';
}

export interface DateField extends BaseField {
  dataType: 'DATE';
}

export interface SingleSelectField extends BaseField {
  dataType: 'SINGLE_SELECT';
  options: Array<{
    id: string;
    name: string;
    description?: string;
    color?: string;
  }>;
}

export interface IterationField extends BaseField {
  dataType: 'ITERATION';
  configuration?: {
    iterations: Array<{
      id: string;
      title: string;
      startDate: string;
      duration: number;
    }>;
  };
}

export type CustomField =
  | TextField
  | NumberField
  | DateField
  | SingleSelectField
  | IterationField;

// ============================================================================
// Field Value Types
// ============================================================================

export interface TextFieldValue {
  field: { name: string };
  text: string;
}

export interface NumberFieldValue {
  field: { name: string };
  number: number;
}

export interface DateFieldValue {
  field: { name: string };
  date: string;
}

export interface SingleSelectFieldValue {
  field: { name: string };
  name: string;
  optionId?: string;
}

export interface IterationFieldValue {
  field: { name: string };
  title: string;
  duration?: number;
  startDate?: string;
}

export type FieldValue =
  | TextFieldValue
  | NumberFieldValue
  | DateFieldValue
  | SingleSelectFieldValue
  | IterationFieldValue;

// ============================================================================
// Project Item Types
// ============================================================================

export interface ProjectItemContent {
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  createdAt?: string;
  closedAt?: string;
  updatedAt?: string;
}

export interface ProjectItem {
  id: string;
  content: ProjectItemContent;
  fieldValues: {
    nodes: FieldValue[];
  };
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface AgentMetrics {
  agent: string;
  executionCount: number;
  avgDuration: number;
  avgCost: number;
  avgQualityScore: number;
  totalCost: number;
  successRate?: number;
}

export interface WeeklyReport {
  week: string;
  totalIssues: number;
  completedIssues: number;
  agentMetrics: AgentMetrics[];
  topQualityIssues: Array<{
    number: number;
    title: string;
    score: number;
    url: string;
  }>;
  totalCost: number;
  avgQualityScore: number;
  completionRate: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ProjectInfo {
  projectId: string;
  projectNumber: number;
  title: string;
  url: string;
  fields: CustomField[];
}

export interface UpdateFieldValueInput {
  projectId: string;
  itemId: string;
  fieldId: string;
  value: string | number | { singleSelectOptionId: string };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class ProjectNotFoundError extends Error {
  constructor(projectNumber: number) {
    super(`Project #${projectNumber} not found`);
    this.name = 'ProjectNotFoundError';
  }
}

export class FieldNotFoundError extends Error {
  constructor(fieldName: string) {
    super(`Field "${fieldName}" not found in project`);
    this.name = 'FieldNotFoundError';
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Project item "${itemId}" not found`);
    this.name = 'ItemNotFoundError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    public resetAt: Date,
    public remaining: number
  ) {
    super(`Rate limit exceeded. Resets at ${resetAt.toISOString()}`);
    this.name = 'RateLimitExceededError';
  }
}
