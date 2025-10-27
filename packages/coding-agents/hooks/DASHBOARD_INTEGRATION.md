# Dashboard Integration with Webhook Hooks

Complete guide for integrating agents with dashboard using the DashboardWebhookHook system.

## Overview

The `DashboardWebhookHook` provides real-time tracking of agent execution through webhook events sent to a dashboard application. It implements PreHook, PostHook, and ErrorHook interfaces for complete lifecycle coverage.

## Features

- **Complete Lifecycle Tracking**: Started, Progress, Completed, Error events
- **Retry Logic**: Automatic retry with exponential backoff
- **Session Management**: Track related events with session IDs
- **Non-blocking**: Dashboard failures don't block agent execution
- **Event Queue**: Failed events are queued for later retry
- **Custom Events**: Send custom events for specialized tracking
- **Type-safe**: Full TypeScript support with event payload types

## Quick Start

### Basic Setup

```typescript
import { HookManager, DashboardWebhookHook } from './agents/hooks/index.js';

class MyAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('MyAgent', config);

    const hookManager = new HookManager();

    // Create dashboard webhook hook
    const dashboardHook = new DashboardWebhookHook({
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
      enableRetry: true,
      maxRetries: 3,
      sessionId: `session-${Date.now()}`,
      deviceIdentifier: config.deviceIdentifier,
    });

    // Register as lifecycle hooks
    hookManager.registerPreHook(dashboardHook);    // Sends agent:started
    hookManager.registerPostHook(dashboardHook);   // Sends agent:completed
    hookManager.registerErrorHook(dashboardHook);  // Sends agent:error

    this.setHookManager(hookManager);
  }
}
```

### Environment Variables

```bash
# Dashboard URL
DASHBOARD_URL=http://localhost:3001

# Optional: Device identifier
DEVICE_IDENTIFIER=macbook-pro-16

# Optional: Custom webhook path
DASHBOARD_WEBHOOK_PATH=/api/agent-event
```

## Event Types

### 1. agent:started

Sent when agent execution begins (PreHook).

**Payload**:
```typescript
{
  eventType: 'agent:started',
  timestamp: '2025-10-12T10:00:00.000Z',
  agentId: 'codegen',
  issueNumber: 270,
  sessionId: 'session-1759552488828',
  deviceIdentifier: 'macbook-pro-16',
  parameters: {
    taskId: 'task-270',
    taskTitle: 'Fix Firebase Auth error',
    taskDescription: '...',
    priority: 'P2',
    estimatedDuration: 60,
    dependencies: ['task-240']
  }
}
```

### 2. agent:progress

Sent during execution for progress tracking.

**Payload**:
```typescript
{
  eventType: 'agent:progress',
  timestamp: '2025-10-12T10:01:00.000Z',
  agentId: 'codegen',
  issueNumber: 270,
  sessionId: 'session-1759552488828',
  deviceIdentifier: 'macbook-pro-16',
  progress: {
    currentStep: 'Implementing solution',
    percentage: 40,
    completedSteps: ['init', 'analyze'],
    remainingSteps: ['implement', 'test', 'complete'],
    metadata: {
      filesModified: 3,
      linesAdded: 120
    }
  }
}
```

### 3. agent:completed

Sent when agent execution completes successfully (PostHook).

**Payload**:
```typescript
{
  eventType: 'agent:completed',
  timestamp: '2025-10-12T10:05:00.000Z',
  agentId: 'codegen',
  issueNumber: 270,
  sessionId: 'session-1759552488828',
  deviceIdentifier: 'macbook-pro-16',
  result: {
    success: true,
    status: 'success',
    durationMs: 300000,
    qualityScore: 85,
    filesChanged: 5,
    testsAdded: 3,
    metrics: {
      linesChanged: 150,
      coveragePercent: 80
    },
    data: {
      // Custom result data
    }
  }
}
```

### 4. agent:error

Sent when agent encounters an error (ErrorHook).

**Payload**:
```typescript
{
  eventType: 'agent:error',
  timestamp: '2025-10-12T10:02:30.000Z',
  agentId: 'codegen',
  issueNumber: 270,
  sessionId: 'session-1759552488828',
  deviceIdentifier: 'macbook-pro-16',
  error: {
    message: 'API request failed: 429 Too Many Requests',
    type: 'RateLimitError',
    stack: '...',
    severity: 'high',
    recoveryAction: 'Retry with exponential backoff',
    context: {
      taskId: 'task-270',
      agentType: 'CodeGenAgent'
    }
  }
}
```

### 5. Custom Events

Send custom events for specialized tracking.

**Available Types**:
- `task:created` - New task created
- `task:updated` - Task status updated
- `task:completed` - Task completed
- `workflow:started` - Workflow started
- `workflow:completed` - Workflow completed
- `metric:recorded` - Custom metric recorded
- `agent:escalated` - Agent escalated to human

## Configuration

### DashboardWebhookConfig Options

```typescript
interface DashboardWebhookConfig {
  /** Dashboard URL (required) */
  dashboardUrl: string;

  /** Webhook endpoint path (default: /api/agent-event) */
  webhookPath?: string;

  /** Enable retry on failure (default: true) */
  enableRetry?: boolean;

  /** Max retry attempts (default: 3) */
  maxRetries?: number;

  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;

  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;

  /** Enable silent mode (default: false) */
  silent?: boolean;

  /** Session ID for tracking related events */
  sessionId?: string;

  /** Device identifier */
  deviceIdentifier?: string;

  /** Custom headers */
  headers?: Record<string, string>;
}
```

### Example with Custom Configuration

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'https://dashboard.example.com',
  webhookPath: '/api/v2/events',
  enableRetry: true,
  maxRetries: 5,
  retryDelay: 2000,
  timeout: 10000,
  silent: false,
  sessionId: `session-${Date.now()}`,
  deviceIdentifier: process.env.DEVICE_IDENTIFIER,
  headers: {
    'Authorization': `Bearer ${process.env.DASHBOARD_API_KEY}`,
    'X-Custom-Header': 'value',
  },
});
```

## Usage Patterns

### Pattern 1: Progress Tracking

Send progress updates during execution:

```typescript
class ProgressTrackingAgent extends BaseAgent {
  private dashboardHook: DashboardWebhookHook;

  async execute(task: Task): Promise<AgentResult> {
    const context: HookContext = {
      agentType: this.agentType,
      task,
      config: this.config,
      startTime: this.startTime,
    };

    // Step 1: Analyzing
    await this.dashboardHook.sendProgress(
      context,
      'Analyzing requirements',
      10,
      ['init'],
      ['analyze', 'implement', 'test', 'complete']
    );
    await this.analyzeRequirements(task);

    // Step 2: Implementing
    await this.dashboardHook.sendProgress(
      context,
      'Implementing solution',
      40,
      ['init', 'analyze'],
      ['implement', 'test', 'complete']
    );
    await this.implementSolution(task);

    // Step 3: Testing
    await this.dashboardHook.sendProgress(
      context,
      'Running tests',
      70,
      ['init', 'analyze', 'implement'],
      ['test', 'complete']
    );
    await this.runTests(task);

    // Step 4: Complete
    await this.dashboardHook.sendProgress(
      context,
      'Finalizing',
      100,
      ['init', 'analyze', 'implement', 'test', 'complete'],
      []
    );

    return { status: 'success', data: {} };
  }
}
```

### Pattern 2: Coordinated Multi-Agent Sessions

Track multiple agents with a shared session ID:

```typescript
class CoordinatedWorkflow {
  private sessionId: string;

  constructor() {
    this.sessionId = `session-${Date.now()}`;
  }

  createAgent(agentType: string): BaseAgent {
    const dashboardHook = new DashboardWebhookHook({
      dashboardUrl: process.env.DASHBOARD_URL!,
      sessionId: this.sessionId, // Shared across all agents
      deviceIdentifier: process.env.DEVICE_IDENTIFIER,
    });

    // ... create and configure agent with dashboardHook
  }

  async runWorkflow(tasks: Task[]): Promise<void> {
    const agents = tasks.map((task) => this.createAgent(task.type));

    // All agents report with same session ID
    await Promise.all(
      agents.map((agent, i) => agent.run(tasks[i]))
    );
  }
}
```

### Pattern 3: Custom Events

Send custom events for specialized tracking:

```typescript
// Send metric
await dashboardHook.sendCustomEvent({
  eventType: 'metric:recorded',
  timestamp: new Date().toISOString(),
  agentId: 'codegen',
  sessionId: dashboardHook.getSessionId(),
  deviceIdentifier: config.deviceIdentifier,
  metric: {
    name: 'code_quality',
    value: 85,
    unit: 'score',
    tags: { file: 'main.ts' },
  },
});

// Send task created
await dashboardHook.sendCustomEvent({
  eventType: 'task:created',
  timestamp: new Date().toISOString(),
  agentId: 'coordinator',
  sessionId: dashboardHook.getSessionId(),
  deviceIdentifier: config.deviceIdentifier,
  task: {
    taskId: 'subtask-1',
    title: 'Subtask',
    type: 'feature',
    priority: 'P2',
  },
});
```

### Pattern 4: Event Queue Management

Handle failed events with retry:

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  enableRetry: true,
});

// Register hooks...

// After execution, check for queued events
const queuedEvents = dashboardHook.getQueuedEvents();

if (queuedEvents.length > 0) {
  console.log(`${queuedEvents.length} events queued (dashboard unavailable)`);

  // Retry queued events later
  await dashboardHook.retryQueuedEvents();
}

// Or clear the queue
dashboardHook.clearQueue();
```

## Dashboard API Specification

### Endpoint

```
POST /api/agent-event
```

### Request Headers

```
Content-Type: application/json
```

### Request Body

```typescript
{
  eventType: DashboardEventType,
  timestamp: string,
  agentId: string,
  issueNumber?: number,
  sessionId?: string,
  deviceIdentifier?: string,
  // ... event-specific fields
}
```

### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Event received",
  "eventId": "evt_1234567890"
}
```

**Error (4xx/5xx)**:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Error Handling

### Automatic Retry

Failed webhook calls are automatically retried with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: After 1 second
Attempt 3: After 2 seconds
Attempt 4: After 4 seconds
```

### Silent Mode

To suppress warning logs when dashboard is unavailable:

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  silent: true, // No warnings logged
});
```

### Timeout Handling

Requests that exceed the timeout are aborted:

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  timeout: 5000, // 5 second timeout
});
```

## Best Practices

### 1. Use Session IDs for Related Events

```typescript
const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: process.env.DASHBOARD_URL!,
  sessionId, // Track all related events
});
```

### 2. Always Run in Background for PostHooks

```typescript
hookManager.registerPostHook(
  dashboardHook,
  { runInBackground: true } // Non-blocking
);
```

### 3. Don't Block on Dashboard Failures

```typescript
hookManager.registerPreHook(
  dashboardHook,
  { continueOnFailure: true } // Continue if dashboard is down
);
```

### 4. Add Custom Metadata

```typescript
await dashboardHook.sendProgress(context, 'Processing', 50, [], [], {
  metadata: {
    customField: 'value',
    performanceMetrics: { cpu: 45, memory: 1024 },
  },
});
```

### 5. Use Environment Variables

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
  deviceIdentifier: process.env.DEVICE_IDENTIFIER || 'unknown',
  headers: {
    'Authorization': `Bearer ${process.env.DASHBOARD_API_KEY}`,
  },
});
```

## Testing

### Unit Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { DashboardWebhookHook } from './agents/hooks/index.js';

describe('DashboardWebhookHook', () => {
  it('should send agent:started event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, eventId: 'evt_123' }),
    });
    global.fetch = fetchMock as any;

    const hook = new DashboardWebhookHook({
      dashboardUrl: 'http://localhost:3001',
    });

    await hook.execute({
      agentType: 'TestAgent',
      task: { id: 'test-1', title: 'Test' },
      config: {},
      startTime: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/agent-event',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});
```

### Integration Testing

```bash
# Start mock dashboard server
npm run dashboard:mock

# Run agents with dashboard integration
DASHBOARD_URL=http://localhost:3001 npm run agents:parallel:exec -- --issues=270
```

## Troubleshooting

### Dashboard Not Receiving Events

1. Check dashboard URL is correct
2. Verify dashboard is running
3. Check firewall/network settings
4. Enable debug logging:

```typescript
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  silent: false, // Enable logging
});
```

### Events Being Queued

Dashboard is unavailable. Check:

```typescript
const queuedEvents = dashboardHook.getQueuedEvents();
console.log(`Queued events: ${queuedEvents.length}`);
```

### Slow Agent Execution

Dashboard webhook calls are blocking. Use non-blocking mode:

```typescript
hookManager.registerPostHook(
  dashboardHook,
  { runInBackground: true } // Don't wait for response
);
```

## Related

- [Hook System README](./README.md) - Main hook system documentation
- [Dashboard Events Types](../types/dashboard-events.ts) - Event payload types
- [Examples](./examples/dashboard-integration.ts) - Full examples

---

🤖 Generated with Claude Code
