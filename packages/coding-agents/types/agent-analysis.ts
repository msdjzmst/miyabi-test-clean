/**
 * Agent Analysis Types
 *
 * Types for intelligent agent analysis and dynamic tool creation
 */

import { AgentTemplate } from './agent-template';

/**
 * Task complexity analysis result
 */
export interface TaskComplexityAnalysis {
  /** Overall complexity score (0-100) */
  complexityScore: number;

  /** Task category */
  category: 'simple' | 'moderate' | 'complex' | 'expert';

  /** Required capabilities */
  requiredCapabilities: string[];

  /** Recommended tools */
  recommendedTools: string[];

  /** Estimated effort (person-hours) */
  estimatedEffort: number;

  /** Risk factors */
  riskFactors: string[];

  /** Dependencies on other systems */
  systemDependencies: string[];
}

/**
 * Agent requirements derived from task analysis
 */
export interface AgentRequirements {
  /** Task type */
  taskType: 'feature' | 'bug' | 'refactor' | 'docs' | 'test' | 'deployment';

  /** Required capabilities */
  capabilities: string[];

  /** Required tools */
  tools: ToolRequirement[];

  /** Required hooks */
  hooks: HookRequirement[];

  /** Required templates */
  templates: TemplateRequirement[];

  /** Execution strategy */
  strategy: 'sequential' | 'parallel' | 'conditional';

  /** Resource requirements */
  resources: {
    memory?: string;
    cpu?: string;
    timeout?: number;
  };
}

/**
 * Tool requirement specification
 */
export interface ToolRequirement {
  /** Tool name */
  name: string;

  /** Tool type */
  type: 'command' | 'api' | 'library' | 'service';

  /** Description of what the tool does */
  description: string;

  /** Required parameters */
  parameters: Record<string, any>;

  /** Priority (higher = more important) */
  priority: number;

  /** Whether the tool is critical */
  critical: boolean;
}

/**
 * Hook requirement specification
 */
export interface HookRequirement {
  /** Hook name */
  name: string;

  /** Hook type */
  type: 'pre' | 'post' | 'error';

  /** Description of what the hook does */
  description: string;

  /** Priority (higher = executed earlier) */
  priority: number;

  /** Configuration */
  config: Record<string, any>;
}

/**
 * Template requirement specification
 */
export interface TemplateRequirement {
  /** Template name */
  name: string;

  /** Template type */
  type: 'code-generation' | 'review' | 'deployment' | 'test' | 'custom';

  /** Description */
  description: string;

  /** Configuration */
  config: Record<string, any>;
}

/**
 * Agent assignment strategy
 */
export interface AssignmentStrategy {
  /** Strategy type */
  type: 'reuse-existing' | 'create-new' | 'hybrid';

  /** Reason for the strategy */
  reason: string;

  /** Confidence score (0-100) */
  confidence: number;

  /** Fallback strategy if primary fails */
  fallback?: AssignmentStrategy;
}

/**
 * Agent capability analysis
 */
export interface AgentCapabilityAnalysis {
  /** Whether existing templates can handle the task */
  canHandleWithExisting: boolean;

  /** Matching templates */
  matchingTemplates: Array<{
    template: AgentTemplate;
    matchScore: number;
    missingCapabilities: string[];
  }>;

  /** Required new capabilities */
  requiredNewCapabilities: string[];

  /** Recommendation */
  recommendation: 'use-existing' | 'extend-existing' | 'create-new';
}

/**
 * Dynamic tool specification
 */
export interface DynamicToolSpec {
  /** Tool ID */
  id: string;

  /** Tool name */
  name: string;

  /** Description */
  description: string;

  /** Implementation type */
  implementationType: 'function' | 'class' | 'api-wrapper' | 'command-wrapper';

  /** Implementation code or configuration */
  implementation: string | Record<string, any>;

  /** Input schema */
  inputSchema: Record<string, any>;

  /** Output schema */
  outputSchema: Record<string, any>;

  /** Dependencies */
  dependencies: string[];

  /** Test cases */
  testCases?: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
}

/**
 * Tool creation result
 */
export interface ToolCreationResult {
  /** Whether creation was successful */
  success: boolean;

  /** Created tool specification */
  tool?: DynamicToolSpec;

  /** Error message if failed */
  error?: string;

  /** Time taken (ms) */
  durationMs: number;

  /** Tool metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent analysis result
 */
export interface AgentAnalysisResult {
  /** Task complexity analysis */
  complexity: TaskComplexityAnalysis;

  /** Agent requirements */
  requirements: AgentRequirements;

  /** Capability analysis */
  capabilityAnalysis: AgentCapabilityAnalysis;

  /** Assignment strategy */
  assignmentStrategy: AssignmentStrategy;

  /** Analysis timestamp */
  timestamp: string;

  /** Analysis metadata */
  metadata?: Record<string, any>;
}
