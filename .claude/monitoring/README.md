# Agent Activity Dashboard - Real-time Monitoring

**Issue**: #142 - Agent Activity Dashboard
**Status**: Implemented ✅
**Version**: 1.0.0
**Last Updated**: 2025-10-20

---

## 📋 Overview

Real-time dashboard for monitoring autonomous agent activity in the Miyabi platform. Provides live metrics, historical data, alerts, and performance insights for all running agents.

**Key Features**:
- ✅ Real-time agent status tracking
- ✅ WebSocket-based live updates (1-second intervals)
- ✅ Historical metrics aggregation (7-day retention)
- ✅ Quality scoring and success rate tracking
- ✅ Alert system for long-running tasks and high error rates
- ✅ Agent execution timeline visualization
- ✅ Automatic integration with BaseAgent lifecycle

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│ BaseAgent (All Agents)                                   │
│ - onAgentStart()                                          │
│ - onAgentComplete()                                       │
│ - onAgentFailed()                                         │
└────────────────┬────────────────────────────────────────┘
                 │ Lifecycle Events
                 ▼
┌─────────────────────────────────────────────────────────┐
│ MetricsCollector (Data Aggregation)                      │
│ - Active agents tracking                                  │
│ - Execution history recording                             │
│ - Statistics calculation                                  │
│ - Alert generation                                        │
└────────────────┬────────────────────────────────────────┘
                 │ Emit Events
                 ▼
┌─────────────────────────────────────────────────────────┐
│ DashboardWebSocketServer (Real-time Broadcasting)        │
│ - WebSocket connections (ws://localhost:3001)            │
│ - Periodic updates (1s interval)                         │
│ - Event-driven instant updates                           │
│ - Client ping/pong health checks                         │
└────────────────┬────────────────────────────────────────┘
                 │ WebSocket Messages
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Dashboard Client (React/Next.js)                         │
│ - Live agent status cards                                │
│ - Historical charts                                      │
│ - Alert notifications                                    │
│ - Task execution timeline                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
.claude/monitoring/
├── README.md                   # This file
├── dashboard-config.ts         # Type definitions & configuration (210 lines)
├── metrics-collector.ts        # Metrics aggregation & alerts (358 lines)
└── websocket-server.ts         # WebSocket server implementation (285 lines)
```

**Total**: 853 lines of TypeScript

---

## 🚀 Quick Start

### 1. Start WebSocket Server

```typescript
import { getGlobalWebSocketServer } from './.claude/monitoring/websocket-server';

// Start with default configuration (port 3001)
const server = getGlobalWebSocketServer();

// Or with custom configuration
const server = getGlobalWebSocketServer({
  websocketPort: 3002,
  updateInterval: 2000,  // 2 seconds
  retentionDays: 14,     // 14 days
});

// Server starts automatically on creation
console.log(server.getStatus());
// => { port: 3001, clientCount: 0, isRunning: true }
```

### 2. Agent Integration (Automatic)

All agents extending `BaseAgent` automatically record metrics. No additional code required!

```typescript
import { BaseAgent } from './base-agent';

export class MyCustomAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    // Your implementation here...

    // Metrics are automatically recorded:
    // - onAgentStart() called at beginning
    // - onAgentComplete() called on success
    // - onAgentFailed() called on error

    return { status: 'success', data: result };
  }
}
```

### 3. Connect Dashboard Client

```typescript
// WebSocket client (browser or Node.js)
const ws = new WebSocket('ws://localhost:3001/ws/dashboard');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'dashboard':
      // Full dashboard state
      console.log('Dashboard update:', message.data);
      break;

    case 'alert':
      // New alert notification
      console.log('Alert:', message.data);
      break;

    case 'ping':
      // Health check from server
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
};

// Request dashboard state
ws.send(JSON.stringify({ type: 'request_dashboard' }));

// Acknowledge an alert
ws.send(JSON.stringify({
  type: 'acknowledge_alert',
  alertId: 'alert-1729425600000-abc123'
}));
```

---

## 📊 Data Structures

### AgentDashboard

```typescript
interface AgentDashboard {
  realTimeMetrics: {
    activeAgents: ActiveAgentInfo[];        // Currently running agents
    queuedTasks: number;                    // Tasks waiting
    avgExecutionTime: number;               // Average seconds
    currentThroughput: number;              // Tasks per minute
    lastUpdate: string;                     // ISO 8601 timestamp
  };

  historicalData: {
    dailyExecutions: Record<string, number>;  // Date -> count
    successRate: Record<AgentType, number>;   // Agent -> percentage
    avgDuration: Record<AgentType, number>;   // Agent -> milliseconds
    errorLogs: ErrorLog[];                    // Recent errors
    completionTimeDistribution: {
      fast: number;    // < 5 minutes
      medium: number;  // 5-30 minutes
      slow: number;    // > 30 minutes
    };
  };

  alerts: DashboardAlert[];  // Unacknowledged alerts
}
```

### ActiveAgentInfo

```typescript
interface ActiveAgentInfo {
  agentType: AgentType;       // 'CodeGenAgent', 'ReviewAgent', etc.
  status: AgentStatus;        // 'idle' | 'running' | 'completed' | 'failed'
  taskId: string;             // Unique task identifier
  taskTitle?: string;         // Human-readable title
  startedAt: string;          // ISO 8601 timestamp
  elapsedTime: number;        // Milliseconds since start
  progress?: number;          // 0-100 percentage
}
```

### DashboardAlert

```typescript
interface DashboardAlert {
  id: string;                           // Unique alert ID
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;                      // Alert description
  timestamp: string;                    // ISO 8601
  acknowledged: boolean;                // User acknowledgment
  agentType?: AgentType;                // Related agent (optional)
  taskId?: string;                      // Related task (optional)
}
```

---

## 🔧 Configuration

### DashboardConfig

```typescript
interface DashboardConfig {
  updateInterval: number;           // Broadcast interval (ms)
  websocketPort: number;            // WebSocket server port
  maxErrorLogs: number;             // Max error log entries
  retentionDays: number;            // Historical data retention
  alertThresholds: {
    errorRatePercent: number;       // Alert if error rate exceeds
    longRunningTaskMinutes: number; // Alert if task runs longer
    queueSizeThreshold: number;     // Alert if queue exceeds
  };
}
```

### Default Configuration

```typescript
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  updateInterval: 1000,           // 1 second
  websocketPort: 3001,
  maxErrorLogs: 100,
  retentionDays: 7,
  alertThresholds: {
    errorRatePercent: 10,         // 10% error rate
    longRunningTaskMinutes: 30,   // 30 minutes
    queueSizeThreshold: 50,       // 50 tasks
  },
};
```

---

## 🎯 Usage Examples

### Example 1: Monitor Active Agents

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

// Get all active agents
const activeAgents = globalMetricsCollector.getActiveAgents();

console.log(`Active agents: ${activeAgents.length}`);
activeAgents.forEach((agent) => {
  console.log(`- ${agent.agentType}: ${agent.taskId} (${agent.elapsedTime}ms)`);
});
```

### Example 2: Get Dashboard Snapshot

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

const dashboard = globalMetricsCollector.getDashboard();

console.log('Real-time Metrics:');
console.log(`- Active agents: ${dashboard.realTimeMetrics.activeAgents.length}`);
console.log(`- Throughput: ${dashboard.realTimeMetrics.currentThroughput} tasks/min`);
console.log(`- Avg execution: ${dashboard.realTimeMetrics.avgExecutionTime}s`);

console.log('\nHistorical Data:');
console.log(`- Success rate (CodeGenAgent): ${dashboard.historicalData.successRate.CodeGenAgent}%`);
console.log(`- Avg duration (ReviewAgent): ${dashboard.historicalData.avgDuration.ReviewAgent}ms`);

console.log('\nAlerts:');
dashboard.alerts.forEach((alert) => {
  console.log(`- [${alert.severity}] ${alert.message}`);
});
```

### Example 3: Listen to Events

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

// Agent started
globalMetricsCollector.on('agent:started', (info) => {
  console.log(`🚀 Agent started: ${info.agentType} (${info.taskId})`);
});

// Agent completed
globalMetricsCollector.on('agent:completed', ({ agentType, taskId, metrics }) => {
  console.log(`✅ Agent completed: ${agentType} (${taskId}) in ${metrics.durationMs}ms`);
});

// Agent failed
globalMetricsCollector.on('agent:failed', ({ agentType, taskId, error }) => {
  console.error(`❌ Agent failed: ${agentType} (${taskId}) - ${error}`);
});

// Alert created
globalMetricsCollector.on('alert:created', (alert) => {
  console.warn(`⚠️  New alert: ${alert.message}`);
});

// Metrics updated
globalMetricsCollector.on('metrics:updated', (realTimeMetrics) => {
  console.log(`📊 Metrics updated: ${realTimeMetrics.activeAgents.length} active`);
});
```

### Example 4: Manual Metrics Recording

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

// Manually record agent lifecycle (if not using BaseAgent)
const taskId = 'task-123';

// Start
globalMetricsCollector.onAgentStart('CodeGenAgent', taskId, 'Generate API endpoints');

// Progress update (optional)
globalMetricsCollector.onAgentProgress(taskId, 50);  // 50% complete

// Complete
globalMetricsCollector.onAgentComplete('CodeGenAgent', taskId, {
  taskId,
  agentType: 'CodeGenAgent',
  durationMs: 15000,
  qualityScore: 95,
  linesChanged: 250,
  testsAdded: 10,
  coveragePercent: 85,
  errorsFound: 2,
  timestamp: new Date().toISOString(),
});

// Or fail
globalMetricsCollector.onAgentFailed('CodeGenAgent', taskId, 'API rate limit exceeded', 5000);
```

### Example 5: Acknowledge Alerts

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

const dashboard = globalMetricsCollector.getDashboard();

// Acknowledge all unacknowledged alerts
dashboard.alerts
  .filter((alert) => !alert.acknowledged)
  .forEach((alert) => {
    globalMetricsCollector.acknowledgeAlert(alert.id);
    console.log(`Acknowledged alert: ${alert.id}`);
  });
```

### Example 6: Clean Old Data

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

// Clear data older than retention period (7 days by default)
globalMetricsCollector.clearOldData();

console.log('Old data cleared');
```

---

## 🌐 WebSocket Protocol

### Server → Client Messages

#### Dashboard Update
```json
{
  "type": "dashboard",
  "data": {
    "realTimeMetrics": { ... },
    "historicalData": { ... },
    "alerts": [ ... ]
  },
  "timestamp": "2025-10-20T12:34:56.789Z"
}
```

#### Alert Notification
```json
{
  "type": "alert",
  "data": {
    "id": "alert-1729425600000-abc123",
    "severity": "warning",
    "message": "High error rate for CodeGenAgent: 15.3%",
    "timestamp": "2025-10-20T12:34:56.789Z",
    "acknowledged": false,
    "agentType": "CodeGenAgent"
  },
  "timestamp": "2025-10-20T12:34:56.789Z"
}
```

#### Ping (Health Check)
```json
{
  "type": "ping",
  "timestamp": "2025-10-20T12:34:56.789Z"
}
```

### Client → Server Messages

#### Request Dashboard
```json
{
  "type": "request_dashboard"
}
```

#### Pong (Health Check Response)
```json
{
  "type": "pong"
}
```

#### Acknowledge Alert
```json
{
  "type": "acknowledge_alert",
  "alertId": "alert-1729425600000-abc123"
}
```

---

## 🎨 Utility Functions

### getAgentEmoji(agentType)
```typescript
import { getAgentEmoji } from './.claude/monitoring/dashboard-config';

console.log(getAgentEmoji('CodeGenAgent'));  // => '💻'
console.log(getAgentEmoji('ReviewAgent'));   // => '🔍'
console.log(getAgentEmoji('DeploymentAgent'));  // => '🚀'
```

### getStatusColor(status)
```typescript
import { getStatusColor } from './.claude/monitoring/dashboard-config';

console.log(getStatusColor('running'));    // => '#00D9FF'
console.log(getStatusColor('completed'));  // => '#00FF88'
console.log(getStatusColor('failed'));     // => '#FF0055'
```

### formatDuration(ms)
```typescript
import { formatDuration } from './.claude/monitoring/dashboard-config';

console.log(formatDuration(5000));      // => '5s'
console.log(formatDuration(125000));    // => '2m 5s'
console.log(formatDuration(3725000));   // => '1h 2m'
```

---

## 🔍 Debugging

### View Metrics Collector State

```typescript
import { globalMetricsCollector } from './.claude/monitoring/metrics-collector';

// Get execution history (last 100)
const history = globalMetricsCollector.getExecutionHistory(100);
console.log(`Recent executions: ${history.length}`);

// Get active agents
const active = globalMetricsCollector.getActiveAgents();
console.log(`Active agents: ${active.length}`);

// Get full dashboard
const dashboard = globalMetricsCollector.getDashboard();
console.log('Dashboard:', JSON.stringify(dashboard, null, 2));
```

### View WebSocket Server State

```typescript
import { getGlobalWebSocketServer } from './.claude/monitoring/websocket-server';

const server = getGlobalWebSocketServer();
const status = server.getStatus();

console.log(`WebSocket server:`);
console.log(`- Port: ${status.port}`);
console.log(`- Connected clients: ${status.clientCount}`);
console.log(`- Running: ${status.isRunning}`);
```

### Stop WebSocket Server

```typescript
import { stopGlobalWebSocketServer } from './.claude/monitoring/websocket-server';

// Gracefully stop server
await stopGlobalWebSocketServer();
console.log('WebSocket server stopped');
```

---

## 🧪 Testing

### Unit Test Example

```typescript
import { MetricsCollector } from './.claude/monitoring/metrics-collector';
import { describe, test, expect, beforeEach } from 'vitest';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ enableLogging: false });
  });

  test('should track agent lifecycle', () => {
    collector.onAgentStart('CodeGenAgent', 'task-1', 'Generate code');

    const active = collector.getActiveAgents();
    expect(active).toHaveLength(1);
    expect(active[0].agentType).toBe('CodeGenAgent');
    expect(active[0].taskId).toBe('task-1');

    collector.onAgentComplete('CodeGenAgent', 'task-1', {
      taskId: 'task-1',
      agentType: 'CodeGenAgent',
      durationMs: 5000,
      timestamp: new Date().toISOString(),
    });

    const activeAfter = collector.getActiveAgents();
    expect(activeAfter).toHaveLength(0);
  });

  test('should generate alerts for high error rate', () => {
    // Simulate 3 failures out of 10 executions (30% error rate)
    for (let i = 0; i < 7; i++) {
      collector.onAgentStart('CodeGenAgent', `task-${i}`);
      collector.onAgentComplete('CodeGenAgent', `task-${i}`, {
        taskId: `task-${i}`,
        agentType: 'CodeGenAgent',
        durationMs: 5000,
        timestamp: new Date().toISOString(),
      });
    }

    for (let i = 7; i < 10; i++) {
      collector.onAgentStart('CodeGenAgent', `task-${i}`);
      collector.onAgentFailed('CodeGenAgent', `task-${i}`, 'Error', 5000);
    }

    const dashboard = collector.getDashboard();
    const errorRateAlert = dashboard.alerts.find((a) =>
      a.message.includes('High error rate')
    );

    expect(errorRateAlert).toBeDefined();
    expect(errorRateAlert?.severity).toBe('warning');
  });
});
```

---

## 📈 Performance Considerations

- **Memory**: Historical data is pruned after 7 days by default
- **Network**: WebSocket broadcasts every 1 second (configurable)
- **CPU**: Metrics aggregation is O(n) where n = execution history size
- **Storage**: Error logs are capped at 100 entries

**Recommendations**:
- For high-volume environments (>1000 agents/day), increase `retentionDays` to 3
- For low-latency requirements, decrease `updateInterval` to 500ms
- For resource-constrained environments, increase `updateInterval` to 5000ms

---

## 🐛 Troubleshooting

### WebSocket Connection Failed

**Symptom**: Client cannot connect to `ws://localhost:3001`

**Solutions**:
1. Check if server is running: `getGlobalWebSocketServer().getStatus()`
2. Verify port is not in use: `lsof -i :3001`
3. Check firewall settings
4. Try custom port: `getGlobalWebSocketServer({ websocketPort: 3002 })`

### No Metrics Being Recorded

**Symptom**: Dashboard shows no active agents

**Solutions**:
1. Verify `globalMetricsCollector` is imported in BaseAgent
2. Check agent extends `BaseAgent`
3. Ensure `run()` method is called (not just `execute()`)
4. Verify no errors in agent execution

### High Memory Usage

**Symptom**: Node.js process memory grows over time

**Solutions**:
1. Reduce `retentionDays`: `new MetricsCollector({ retentionDays: 3 })`
2. Reduce `maxErrorLogs`: `new MetricsCollector({ maxErrorLogs: 50 })`
3. Call `clearOldData()` periodically
4. Monitor with: `process.memoryUsage()`

---

## 🔗 Related Documentation

- [Agent Communication Protocol](./../agents/COMMUNICATION_PROTOCOL.md) - Inter-agent messaging (Issue #139)
- [BaseAgent Reference](../../packages/coding-agents/base-agent.ts) - Base agent implementation
- [Entity-Relation Model](../../docs/ENTITY_RELATION_MODEL.md) - System architecture
- [Label System Guide](../../docs/LABEL_SYSTEM_GUIDE.md) - 53-label taxonomy

---

## 📝 Change Log

### v1.0.0 (2025-10-20)
- ✅ Initial implementation (Issue #142)
- ✅ MetricsCollector with event-driven architecture
- ✅ WebSocket server with real-time broadcasting
- ✅ BaseAgent automatic integration
- ✅ Alert system (long-running tasks, high error rate)
- ✅ Historical data aggregation (7-day retention)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
