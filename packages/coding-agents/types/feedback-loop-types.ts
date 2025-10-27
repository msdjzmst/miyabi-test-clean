/**
 * Feedback Loop System Types
 *
 * Type definitions for Goal-Oriented TDD + Consumption-Driven infinite feedback loop system
 */

// ============================================================================
// Goal Definition Types
// ============================================================================

export interface SuccessCriteria {
  minQualityScore: number; // 0-100
  maxEslintErrors: number;
  maxTypeScriptErrors: number;
  maxSecurityIssues: number;
  minTestCoverage: number; // 0-100 percentage
  minTestsPassed: number;
  maxBuildTimeMs?: number;
  customMetrics?: Array<{
    name: string;
    threshold: number;
    operator: 'gte' | 'lte' | 'eq';
  }>;
}

export interface TestSpecification {
  id: string;
  name?: string; // Optional test name for display
  type?: 'unit' | 'integration' | 'e2e' | 'functional'; // Optional test type
  description: string;
  status: 'pending' | 'passed' | 'failed';
  filePath?: string;
  testFile?: string; // Optional test file path (alternative to filePath)
  testFunction?: string; // Optional test function name
  testCommand?: string;
  expectedBehavior: string;
  actualBehavior?: string;
  error?: string;
  dependencies?: string[]; // Optional test dependencies (IDs of tests that must pass first)
}

export interface MetricsThreshold {
  qualityScore: number;
  testCoverage: number;
  buildTime: number;
  codeSize: number;
  cyclomaticComplexity: number;
}

export interface GoalDefinition {
  id: string;
  title: string;
  description: string;
  successCriteria: SuccessCriteria;
  testSpecs: TestSpecification[];
  acceptanceCriteria: string[];
  metricsThresholds: MetricsThreshold;
  priority: number;
  deadline?: string;
  context: {
    issueNumber?: number;
    taskId?: string;
    previousAttempts: number;
    feedbackHistory: FeedbackRecord[];
  };
}

// ============================================================================
// Actual Metrics Types
// ============================================================================

export interface ActualMetrics {
  qualityScore: number;
  eslintErrors: number;
  typeScriptErrors: number;
  securityIssues: number;
  testCoverage: number;
  testsPassed: number;
  testsFailed?: number; // Optional: number of tests that failed
  buildTimeMs: number;
  linesOfCode?: number; // Optional: code size metric
  cyclomaticComplexity?: number; // Optional: complexity metric
  customMetrics?: Record<string, number>;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  criterion: string;
  expected: number;
  actual: number;
  passed: boolean;
  scoreImpact: number;
  feedback: string;
}

export interface GapAnalysis {
  metric: string;
  expected: number;
  actual: number;
  gap: number;
  gapPercentage: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface NextAction {
  id: string;
  type: 'fix' | 'test' | 'refactor' | 'document';
  description: string;
  priority: number;
  estimatedImpact: number;
  targetMetric: string;
}

export interface ConsumptionReport {
  goalId: string;
  sessionId: string;
  timestamp: string;
  validationResults: ValidationResult[];
  overallScore: number;
  goalAchieved: boolean;
  actualMetrics: ActualMetrics;
  gaps: GapAnalysis[];
  recommendations: string[];
  nextActions: NextAction[];
}

// ============================================================================
// Feedback Types
// ============================================================================

export interface FeedbackRecord {
  timestamp: string;
  type: 'positive' | 'constructive' | 'corrective' | 'escalation';
  score: number;
  summary: string;
  details: string[];
  codeExamples: Array<{
    issue: string;
    current: string;
    suggested: string;
  }>;
  actionItems: NextAction[];
  references: string[];
}

// ============================================================================
// Iteration Types
// ============================================================================

export interface IterationRecord {
  iteration: number;
  timestamp: string;
  goalDefinition: GoalDefinition;
  consumptionReport: ConsumptionReport;
  feedback: FeedbackRecord;
  durationMs: number;
  scoreImprovement: number;
}

// ============================================================================
// Convergence Types
// ============================================================================

export interface ConvergenceMetrics {
  scoreHistory: number[];
  scoreVariance: number;
  improvementRate: number;
  isConverging: boolean;
  estimatedIterationsToConverge?: number;
}

// ============================================================================
// Goal Refinement Types
// ============================================================================

export interface GoalRefinement {
  timestamp: string;
  reason: string;
  originalGoal: GoalDefinition;
  refinedGoal: GoalDefinition;
  changes: Array<{
    field: string;
    before: any;
    after: any;
    reason: string;
  }>;
  expectedImpact: string;
}

// ============================================================================
// Feedback Loop Types
// ============================================================================

export interface FeedbackLoop {
  loopId: string;
  goalId: string;
  iteration: number;
  maxIterations: number;
  startTime: string;
  lastIterationTime: string;
  status:
    | 'running'
    | 'converged'
    | 'diverged'
    | 'max_iterations_reached'
    | 'escalated';
  iterations: IterationRecord[];
  convergenceMetrics: ConvergenceMetrics;
  autoRefinementEnabled: boolean;
  refinementHistory: GoalRefinement[];
}

// ============================================================================
// Escalation Types (for Feedback Loop System)
// ============================================================================

export interface Escalation {
  loopId: string;
  reason: string;
  escalationLevel: 'TechLead' | 'PO' | 'CISO' | 'CTO';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
}
