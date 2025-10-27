/**
 * Dashboard Event Types
 *
 * Type definitions for dashboard webhook events
 */

/**
 * Dashboard event types
 */
export type DashboardEventType =
  | 'agent:started'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:error'
  | 'agent:escalated'
  | 'task:created'
  | 'task:updated'
  | 'task:completed'
  | 'workflow:started'
  | 'workflow:completed'
  | 'metric:recorded';

/**
 * Base dashboard event payload
 */
export interface BaseDashboardEvent {
  /** Event type */
  eventType: DashboardEventType;

  /** Timestamp of the event */
  timestamp: string;

  /** Agent identifier */
  agentId: string;

  /** Issue number (if applicable) */
  issueNumber?: number;

  /** Session ID for tracking related events */
  sessionId?: string;

  /** Device identifier */
  deviceIdentifier?: string;
}

/**
 * Agent started event
 */
export interface AgentStartedEvent extends BaseDashboardEvent {
  eventType: 'agent:started';

  /** Task parameters */
  parameters: {
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    priority: string;
    estimatedDuration?: number;
    dependencies?: string[];
  };
}

/**
 * Agent progress event
 */
export interface AgentProgressEvent extends BaseDashboardEvent {
  eventType: 'agent:progress';

  /** Progress information */
  progress: {
    /** Current step */
    currentStep: string;

    /** Progress percentage (0-100) */
    percentage: number;

    /** Completed steps */
    completedSteps: string[];

    /** Remaining steps */
    remainingSteps: string[];

    /** Additional metadata */
    metadata?: Record<string, any>;
  };
}

/**
 * Agent completed event
 */
export interface AgentCompletedEvent extends BaseDashboardEvent {
  eventType: 'agent:completed';

  /** Execution result */
  result: {
    /** Success status */
    success: boolean;

    /** Result status */
    status: string;

    /** Duration in milliseconds */
    durationMs: number;

    /** Quality score (if applicable) */
    qualityScore?: number;

    /** Files created/modified */
    filesChanged?: number;

    /** Tests added */
    testsAdded?: number;

    /** Additional metrics */
    metrics?: Record<string, any>;

    /** Result data */
    data?: any;
  };
}

/**
 * Agent error event
 */
export interface AgentErrorEvent extends BaseDashboardEvent {
  eventType: 'agent:error';

  /** Error information */
  error: {
    /** Error message */
    message: string;

    /** Error type */
    type: string;

    /** Error stack trace (optional) */
    stack?: string;

    /** Severity level */
    severity: 'low' | 'medium' | 'high' | 'critical';

    /** Recovery action taken */
    recoveryAction?: string;

    /** Additional context */
    context?: Record<string, any>;
  };
}

/**
 * Agent escalated event
 */
export interface AgentEscalatedEvent extends BaseDashboardEvent {
  eventType: 'agent:escalated';

  /** Escalation information */
  escalation: {
    /** Escalation reason */
    reason: string;

    /** Escalation target */
    target: 'TechLead' | 'PO' | 'CISO' | 'DevOps' | 'CTO';

    /** Severity level */
    severity: string;

    /** Context */
    context: Record<string, any>;
  };
}

/**
 * Task created event
 */
export interface TaskCreatedEvent extends BaseDashboardEvent {
  eventType: 'task:created';

  /** Task information */
  task: {
    taskId: string;
    title: string;
    type: string;
    priority: string;
    estimatedDuration?: number;
    dependencies?: string[];
  };
}

/**
 * Task updated event
 */
export interface TaskUpdatedEvent extends BaseDashboardEvent {
  eventType: 'task:updated';

  /** Task update information */
  task: {
    taskId: string;
    status: string;
    progress?: number;
    metadata?: Record<string, any>;
  };
}

/**
 * Task completed event
 */
export interface TaskCompletedEvent extends BaseDashboardEvent {
  eventType: 'task:completed';

  /** Task completion information */
  task: {
    taskId: string;
    status: string;
    durationMs: number;
    result?: any;
  };
}

/**
 * Workflow started event
 */
export interface WorkflowStartedEvent extends BaseDashboardEvent {
  eventType: 'workflow:started';

  /** Workflow information */
  workflow: {
    workflowId: string;
    totalTasks: number;
    concurrency: number;
    estimatedDuration: number;
  };
}

/**
 * Workflow completed event
 */
export interface WorkflowCompletedEvent extends BaseDashboardEvent {
  eventType: 'workflow:completed';

  /** Workflow completion information */
  workflow: {
    workflowId: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    durationMs: number;
    successRate: number;
  };
}

/**
 * Metric recorded event
 */
export interface MetricRecordedEvent extends BaseDashboardEvent {
  eventType: 'metric:recorded';

  /** Metric information */
  metric: {
    name: string;
    value: number;
    unit?: string;
    tags?: Record<string, string>;
  };
}

/**
 * Union type of all dashboard events
 */
export type DashboardEvent =
  | AgentStartedEvent
  | AgentProgressEvent
  | AgentCompletedEvent
  | AgentErrorEvent
  | AgentEscalatedEvent
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | MetricRecordedEvent;

/**
 * Dashboard webhook response
 */
export interface DashboardWebhookResponse {
  /** Success status */
  success: boolean;

  /** Response message */
  message?: string;

  /** Event ID (for tracking) */
  eventId?: string;

  /** Error details (if failed) */
  error?: string;
}
