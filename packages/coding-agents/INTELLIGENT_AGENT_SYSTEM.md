# Intelligent Agent System

**Complete AI-Driven Agent System with Dynamic Tool Creation**

## Overview

The Intelligent Agent System extends the Dynamic Agent System with AI-powered task analysis and runtime tool creation capabilities. Agents can now:

1. **Understand tasks from higher-level concepts** using intelligent analysis
2. **Dynamically create tools/templates/hooks** based on requirements
3. **Self-adapt** by creating tools during execution to complete tasks
4. **Optimize assignment** using complexity analysis and capability matching

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Intelligent Agent System                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│ AgentAnalyzer│    │  ToolFactory │      │ AgentRegistry│
│              │    │              │      │              │
│ • Analyze    │    │ • Create     │      │ • Intelligent│
│   complexity │    │   tools      │      │   assignment │
│ • Determine  │    │ • Create     │      │ • Tool       │
│   requirements│    │   hooks     │      │   creation   │
│ • Match      │    │ • Export     │      │ • Capability │
│   capabilities│    │   tools     │      │   matching   │
└──────────────┘    └──────────────┘      └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  DynamicAgent    │
                    │                  │
                    │ • Execute        │
                    │ • Create tools   │
                    │   at runtime     │
                    │ • Adapt to       │
                    │   requirements   │
                    └──────────────────┘
```

## Core Components

### 1. AgentAnalyzer

Analyzes tasks from higher-level concepts to determine requirements.

**Capabilities:**
- Complexity analysis (simple/moderate/complex/expert)
- Required capability detection
- Tool recommendation
- Risk factor identification
- System dependency detection

**Usage:**
```typescript
const analyzer = AgentAnalyzer.getInstance();
const analysis = await analyzer.analyzeTask(task, availableTemplates);

console.log('Complexity:', analysis.complexity.category);
console.log('Score:', analysis.complexity.complexityScore);
console.log('Required capabilities:', analysis.requirements.capabilities);
console.log('Recommended tools:', analysis.complexity.recommendedTools);
```

**Analysis Process:**

1. **Keyword Analysis**: Scans task title and description for complexity indicators
2. **Capability Detection**: Identifies required technical capabilities
3. **Tool Recommendation**: Suggests tools based on capabilities
4. **Risk Assessment**: Identifies potential risk factors
5. **Dependency Detection**: Finds system dependencies
6. **Effort Estimation**: Estimates person-hours required

**Complexity Categories:**

- **Simple** (0-30): Typo fixes, documentation updates, simple formatting
- **Moderate** (30-60): Feature implementations, updates, refactoring
- **Complex** (60-80): Architecture changes, integrations, migrations
- **Expert** (80-100): Distributed systems, AI/ML, real-time systems

### 2. ToolFactory

Dynamically creates tools, hooks, and templates based on requirements.

**Tool Types:**
- **Command Tools**: Wrap CLI commands (tsc, eslint, docker)
- **API Tools**: Wrap HTTP APIs (fetch, axios)
- **Library Tools**: Wrap npm packages
- **Service Tools**: Wrap cloud services (Firebase, AWS)

**Usage:**
```typescript
const toolFactory = ToolFactory.getInstance();

// Create a command tool
const result = await toolFactory.createTool({
  name: 'eslint',
  type: 'command',
  description: 'ESLint code analysis',
  parameters: { fix: true },
  priority: 80,
  critical: true,
});

// Create a hook
const hook = await toolFactory.createHook({
  name: 'validation-hook',
  type: 'pre',
  description: 'Validate before execution',
  priority: 100,
  config: { strict: true },
});

// Export tool for reuse
await toolFactory.exportTool(result.tool.id, './generated-tools/eslint.ts');
```

### 3. DynamicToolCreator

Enables agents to create and use tools at runtime during execution.

**Features:**
- Create tools on-demand during execution
- Natural language tool description → tool generation
- Tool execution tracking and statistics
- Automatic dependency management

**Usage in Agent:**
```typescript
const template: AgentTemplate = {
  id: 'intelligent-agent',
  name: 'IntelligentAgent',
  supportedTypes: ['feature'],
  priority: 30,

  async executor(task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    // Create tool dynamically
    if (context.toolCreator) {
      const toolResult = await context.toolCreator.createSimpleTool(
        'typescript-compiler',
        'Compile TypeScript code',
        'command'
      );

      // Execute the tool
      const execResult = await context.toolCreator.executeTool(
        toolResult.tool!,
        { strict: true },
        {
          agentInstanceId: 'agent-123',
          taskId: task.id,
          timestamp: new Date().toISOString(),
        }
      );

      context.log(`Tool result: ${execResult.success}`);
    }

    return { status: 'success', data: {} };
  },
};
```

**Natural Language Tool Creation:**
```typescript
const result = await context.toolCreator.createToolFromDescription(
  'validate code quality and security',
  context
);
```

### 4. Enhanced AgentRegistry

Intelligent agent assignment with automatic tool/hook creation.

**Assignment Process:**

```
1. Analyze Task
   ├─ Determine complexity
   ├─ Identify required capabilities
   ├─ Recommend tools
   └─ Calculate confidence

2. Create Dynamic Resources
   ├─ Create required tools
   ├─ Create required hooks
   └─ Configure hook manager

3. Determine Strategy
   ├─ Reuse existing agent (if suitable)
   ├─ Extend existing agent (if partial match)
   └─ Create new agent (if no match)

4. Assign Agent
   ├─ Attach created tools
   ├─ Attach hook manager
   └─ Track assignment
```

**Usage:**
```typescript
const registry = AgentRegistry.getInstance(config);

// Intelligent assignment (automatic analysis + tool creation)
const assignment = await registry.assignAgent({
  task,
  preferExisting: true,
});

// Get analysis results
const analysis = registry.getTaskAnalysis(task.id);
console.log('Complexity:', analysis.complexity.category);
console.log('Tools created:', analysis.requirements.tools.length);
```

## Task Analysis Deep Dive

### Complexity Scoring Algorithm

```typescript
Base Score = Keyword Match Score (0-100)

Adjustments:
+ Dependencies (+10 per system dependency)
+ Risk Factors (+15 per risk factor)
+ Required Capabilities (+5 per capability)

Final Score = min(100, Base Score + Adjustments)
```

### Capability Detection

The system detects capabilities from task content:

| Capability | Keywords | Recommended Tools |
|-----------|----------|-------------------|
| typescript | typescript, ts, type | tsc, eslint, prettier |
| api | api, endpoint, rest | axios, fetch, postman |
| database | database, db, sql | prisma, typeorm, mongoose |
| frontend | ui, component, react | vite, webpack, babel |
| testing | test, spec, e2e | vitest, jest, playwright |
| deployment | deploy, ci/cd, docker | docker, github-actions |
| security | security, auth | snyk, npm-audit, owasp |

### Risk Factor Detection

Automatically identifies potential risks:

- **Breaking Changes**: Requires migration planning
- **Database Migration**: Data loss risk
- **Security-Sensitive**: Requires expert review
- **Production Impact**: Requires staging tests

### Assignment Strategy Selection

```
IF complexity_score >= 70 AND existing_match_score >= 70:
  → Reuse Existing Agent

ELIF complexity_score >= 50 AND existing_match_score >= 40:
  → Extend Existing Agent

ELSE:
  → Create New Agent
```

## Dynamic Tool Creation

### Tool Generation Process

1. **Requirement Analysis**: Parse tool requirements
2. **Template Selection**: Choose implementation template
3. **Code Generation**: Generate tool implementation
4. **Validation**: Validate generated code
5. **Registration**: Register tool for use

### Generated Tool Structure

**Command Tool Example:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function eslint(params: any): Promise<any> {
  const command = 'eslint';
  const args = Object.entries(params)
    .map(([key, value]) => `--${key}=${value}`)
    .join(' ');

  try {
    const { stdout, stderr } = await execAsync(`${command} ${args}`);
    return {
      success: true,
      output: stdout.trim(),
      command: `${command} ${args}`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

### Tool Execution Types

**Function Tools**: Simple function wrappers
```typescript
async function tool(params: any): Promise<any> {
  // Implementation
}
```

**Class Tools**: Stateful service wrappers
```typescript
class ToolService {
  async execute(params: any): Promise<any> {
    // Implementation
  }
}
```

**Command Wrappers**: Shell command execution
```typescript
async function command(params: any): Promise<any> {
  const { stdout } = await execAsync(`command ${args}`);
  return stdout;
}
```

**API Wrappers**: HTTP API clients
```typescript
async function apiCall(params: any): Promise<any> {
  const response = await fetch(url, options);
  return response.json();
}
```

## Complete Usage Example

```typescript
import { AgentFactory } from './agent-factory.js';
import { AgentRegistry } from './agent-registry.js';
import { AgentTemplate } from './types/agent-template.js';

// 1. Create intelligent agent template
const intelligentAgent: AgentTemplate = {
  id: 'intelligent-v1',
  name: 'IntelligentAgent',
  description: 'Self-adapting agent with tool creation',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug'],
  priority: 50,

  async executor(task, context) {
    context.log('Starting intelligent execution...');

    // Analyze what we need
    const needsTypeScript = task.description.includes('typescript');
    const needsTesting = task.description.includes('test');

    // Create tools as needed
    if (needsTypeScript && context.toolCreator) {
      await context.toolCreator.createSimpleTool(
        'tsc',
        'TypeScript compiler',
        'command'
      );
    }

    if (needsTesting && context.toolCreator) {
      await context.toolCreator.createSimpleTool(
        'vitest',
        'Vitest test runner',
        'command'
      );
    }

    // Execute work
    context.log('Executing with created tools...');
    await context.utils.sleep(2000);

    return {
      status: 'success',
      data: { toolsCreated: 2 },
      metrics: { qualityScore: 90 },
    };
  },
};

// 2. Register template
const factory = AgentFactory.getInstance();
factory.registerTemplate(intelligentAgent);

// 3. Create complex task
const task: Task = {
  id: 'task-1',
  title: 'Add TypeScript API with tests',
  description: 'Implement REST API using TypeScript with comprehensive test coverage',
  type: 'feature',
  priority: 'P1',
  dependencies: [],
};

// 4. Intelligent assignment
const registry = AgentRegistry.getInstance(config);
const assignment = await registry.assignAgent({
  task,
  preferExisting: true,
});

// 5. View analysis
const analysis = registry.getTaskAnalysis(task.id);
console.log('Complexity:', analysis.complexity.category);
console.log('Required capabilities:', analysis.requirements.capabilities);
console.log('Tools to create:', analysis.requirements.tools.map(t => t.name));

// 6. Execute
const agent = registry.getAgentForTask(task.id);
const result = await agent.run(task);

console.log('Result:', result.status);
console.log('Quality:', result.metrics?.qualityScore);
```

## Advanced Patterns

### Pattern 1: Multi-Stage Agent with Progressive Tool Creation

```typescript
async executor(task, context) {
  // Stage 1: Analysis
  context.log('Stage 1: Analysis');
  const requirements = analyzeTask(task);

  // Stage 2: Tool Creation
  context.log('Stage 2: Creating tools');
  for (const toolReq of requirements.tools) {
    await context.toolCreator.createSimpleTool(
      toolReq.name,
      toolReq.description,
      toolReq.type
    );
  }

  // Stage 3: Execution
  context.log('Stage 3: Execution with tools');
  // Use created tools

  // Stage 4: Validation
  context.log('Stage 4: Validation');
  // Validate results
}
```

### Pattern 2: Adaptive Agent with Fallback Tools

```typescript
async executor(task, context) {
  let tool = await context.toolCreator.createSimpleTool(
    'preferred-tool',
    'Preferred tool',
    'command'
  );

  if (!tool.success) {
    // Fallback
    tool = await context.toolCreator.createSimpleTool(
      'fallback-tool',
      'Fallback tool',
      'command'
    );
  }

  // Use tool
}
```

### Pattern 3: Tool Composition

```typescript
async executor(task, context) {
  // Create base tools
  const lintTool = await context.toolCreator.createSimpleTool(
    'eslint',
    'Linter',
    'command'
  );

  const formatTool = await context.toolCreator.createSimpleTool(
    'prettier',
    'Formatter',
    'command'
  );

  // Compose into pipeline
  const result1 = await context.toolCreator.executeTool(
    lintTool.tool!,
    params,
    toolContext
  );

  const result2 = await context.toolCreator.executeTool(
    formatTool.tool!,
    params,
    toolContext
  );

  return {
    status: 'success',
    data: { linted: result1.success, formatted: result2.success },
  };
}
```

## Statistics and Monitoring

### Registry Statistics

```typescript
const stats = registry.getStatistics();
console.log({
  totalAssignments: stats.totalAssignments,
  activeAgents: stats.activeAgents,
  idleAgents: stats.idleAgents,
  toolsCreated: stats.toolsCreated,
  cachedAnalyses: stats.cachedAnalyses,
});
```

### Tool Creator Statistics

```typescript
const toolStats = toolCreator.getStatistics();
console.log({
  totalExecutions: toolStats.totalExecutions,
  successfulExecutions: toolStats.successfulExecutions,
  failedExecutions: toolStats.failedExecutions,
  averageDurationMs: toolStats.averageDurationMs,
  toolsCreated: toolStats.toolsCreated,
});
```

## Best Practices

### 1. Tool Creation

✅ **Do:**
- Create tools only when needed
- Use descriptive names
- Set appropriate priorities
- Mark critical tools
- Export reusable tools

❌ **Don't:**
- Create duplicate tools
- Create tools without validation
- Ignore tool creation failures
- Create overly complex tools

### 2. Task Analysis

✅ **Do:**
- Cache analysis results
- Trust the complexity score
- Follow recommended strategies
- Check capability gaps

❌ **Don't:**
- Re-analyze the same task
- Ignore risk factors
- Skip dependency checks
- Override strategy without reason

### 3. Agent Assignment

✅ **Do:**
- Prefer existing agents when possible
- Let the system create tools automatically
- Monitor assignment statistics
- Clean up completed assignments

❌ **Don't:**
- Force agent creation unnecessarily
- Skip intelligent analysis
- Ignore capability mismatches
- Leave stale assignments

## Troubleshooting

### Problem: Agent Creation Fails

```typescript
// Check available templates
const templates = factory.getAllTemplates();
console.log('Available templates:', templates.length);

// Check capability match
const analysis = await analyzer.analyzeTask(task, templates);
console.log('Best match:', analysis.capabilityAnalysis.matchingTemplates[0]);
```

### Problem: Tool Creation Fails

```typescript
// Check tool requirements
const result = await toolFactory.createTool(requirement);
if (!result.success) {
  console.error('Tool creation failed:', result.error);
  console.error('Requirement:', requirement);
}
```

### Problem: Low Assignment Confidence

```typescript
// Check complexity analysis
const analysis = registry.getTaskAnalysis(taskId);
console.log('Complexity:', analysis.complexity.complexityScore);
console.log('Confidence:', analysis.assignmentStrategy.confidence);

// If low confidence, check capability gaps
console.log('Missing capabilities:',
  analysis.capabilityAnalysis.requiredNewCapabilities
);
```

## Performance Considerations

### Analysis Caching

Analysis results are automatically cached per task:
```typescript
// First call: performs analysis
const analysis1 = registry.getTaskAnalysis(taskId);

// Subsequent calls: returns cached result
const analysis2 = registry.getTaskAnalysis(taskId);
```

### Tool Reuse

Created tools are stored and can be reused:
```typescript
const tool = toolFactory.getTool(toolId);
// Reuse tool without recreation
```

### Cleanup

Regularly clean up completed assignments and idle agents:
```typescript
// Cleanup completed assignments
registry.cleanupCompletedAssignments();

// Destroy idle agents
await registry.destroyIdleAgents();

// Clear tool factory
toolFactory.clear();
```

## Integration with Dashboard

The intelligent agent system integrates seamlessly with the dashboard webhook system:

```typescript
import { HookManager } from './hooks/hook-manager.js';
import { DashboardWebhookHook } from './hooks/built-in/dashboard-webhook-hook.js';

const hookManager = new HookManager();
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  sessionId: 'session-123',
  deviceIdentifier: 'dev-machine',
});

hookManager.registerPreHook(dashboardHook);
hookManager.registerPostHook(dashboardHook);

registry.setDefaultHookManager(hookManager);

// All agent assignments will now report to dashboard
```

## Future Enhancements

- **AI-powered analysis**: Use Claude API for deeper task understanding
- **Template generation**: Dynamically generate entire agent templates
- **Learning system**: Learn from past executions to improve assignments
- **Tool marketplace**: Share and reuse community-created tools
- **Distributed execution**: Execute tools across multiple machines

## Summary

The Intelligent Agent System provides:

✨ **Key Benefits:**
- 🧠 Understands tasks from higher-level concepts
- 🔧 Creates tools dynamically as needed
- 📊 Analyzes complexity automatically
- 🎯 Assigns optimal agents intelligently
- 🔄 Self-adapts during execution
- 📈 Tracks performance and statistics

🎯 **Use Cases:**
- Complex feature implementation
- Multi-technology projects
- Adaptive workflow automation
- Dynamic tool requirement handling
- Intelligent task routing

---

**This system represents the future of autonomous agent operations: self-analyzing, self-adapting, and self-optimizing.**
