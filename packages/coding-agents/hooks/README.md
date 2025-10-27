# Agent Hook System

Extensible prehook/posthook mechanism for Agent lifecycle management.

## Overview

The hook system allows you to inject custom logic at various points in the agent execution lifecycle:

- **PreHooks**: Execute before agent execution (e.g., validation, setup)
- **PostHooks**: Execute after agent execution (e.g., cleanup, notifications)
- **ErrorHooks**: Execute when an error occurs (e.g., error reporting, rollback)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Agent Execution Lifecycle                                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. PreHooks (priority order)                            │
│     ├─ EnvironmentCheckHook (priority: 10)              │
│     ├─ DependencyCheckHook (priority: 20)               │
│     └─ CustomPreHook (priority: 30)                     │
│                                                           │
│  2. Main Execution                                       │
│     └─ agent.execute(task)                              │
│                                                           │
│  3. PostHooks (priority order)                           │
│     ├─ MetricsHook (priority: 10)                       │
│     ├─ NotificationHook (priority: 90)                  │
│     └─ CleanupHook (priority: 100)                      │
│                                                           │
│  4. ErrorHooks (if error occurs)                         │
│     ├─ ErrorNotificationHook                            │
│     └─ RollbackHook                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Built-in Hooks

### PreHooks

#### EnvironmentCheckHook

Validates required environment variables before execution.

```typescript
import { EnvironmentCheckHook } from './agents/hooks/index.js';

const envHook = new EnvironmentCheckHook([
  'GITHUB_TOKEN',
  'ANTHROPIC_API_KEY',
  'DEVICE_IDENTIFIER',
]);

hookManager.registerPreHook(envHook);
```

#### DependencyCheckHook

Validates task dependencies are resolved before execution.

```typescript
import { DependencyCheckHook } from './agents/hooks/index.js';

const depHook = new DependencyCheckHook('.ai/parallel-reports');

hookManager.registerPreHook(depHook);
```

### PostHooks

#### CleanupHook

Cleans up temporary files and resources after execution.

```typescript
import { CleanupHook } from './agents/hooks/index.js';

const cleanupHook = new CleanupHook({
  tempDirs: ['.temp', '.cache'],
  tempFiles: ['temp.log'],
});

hookManager.registerPostHook(cleanupHook);
```

#### NotificationHook

Sends notifications to Slack/Discord on completion or error.

```typescript
import { NotificationHook } from './agents/hooks/index.js';

const notifyHook = new NotificationHook({
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  mentionOnFailure: ['tech-lead', 'devops'],
});

hookManager.registerPostHook(notifyHook);
```

## Usage

### Basic Setup

```typescript
import { BaseAgent } from './agents/base-agent.js';
import { HookManager, EnvironmentCheckHook, CleanupHook } from './agents/hooks/index.js';

class MyAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('MyAgent', config);

    // Create hook manager
    const hookManager = new HookManager();

    // Register prehooks
    hookManager.registerPreHook(
      new EnvironmentCheckHook(['GITHUB_TOKEN'])
    );

    // Register posthooks
    hookManager.registerPostHook(
      new CleanupHook({ tempDirs: ['.temp'] })
    );

    // Attach to agent
    this.setHookManager(hookManager);
  }

  async execute(task: Task): Promise<AgentResult> {
    // Your implementation
    return {
      status: 'success',
      data: {},
    };
  }
}
```

### Custom Hook Example

```typescript
import { PreHook, HookContext } from './agents/types/hooks.js';

class GitStatusCheckHook implements PreHook {
  name = 'git-status-check';
  description = 'Ensures git working tree is clean';
  priority = 15;

  async execute(context: HookContext): Promise<void> {
    const { spawn } = await import('child_process');

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('git', ['status', '--porcelain']);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Git command failed with code ${code}`));
        }
      });
    });

    if (result.trim() !== '') {
      throw new Error('Git working tree is not clean. Please commit changes first.');
    }

    console.log('✓ Git working tree is clean');
  }
}

// Usage
hookManager.registerPreHook(new GitStatusCheckHook());
```

### Hook Options

```typescript
hookManager.registerPreHook(
  new EnvironmentCheckHook(['GITHUB_TOKEN']),
  {
    continueOnFailure: false, // Stop execution if hook fails
    timeout: 5000,            // 5 second timeout
    runInBackground: false,   // Run synchronously
  }
);

hookManager.registerPostHook(
  new NotificationHook({ slackWebhookUrl: '...' }),
  {
    continueOnFailure: true, // Continue even if notification fails
    runInBackground: true,   // Don't block on notifications
  }
);
```

### Conditional Hooks

```typescript
import { PreHook, HookContext } from './agents/types/hooks.js';

class ConditionalHook implements PreHook {
  name = 'conditional-hook';
  description = 'Only runs for specific agents';
  priority = 50;

  async execute(context: HookContext): Promise<void> {
    // Only run for CodeGenAgent
    if (context.agentType !== 'CodeGenAgent') {
      console.log('Skipping hook for', context.agentType);
      return;
    }

    // Your logic here
    console.log('Running hook for CodeGenAgent');
  }
}
```

### Dynamic Hook Registration

```typescript
const hookManager = new HookManager();

// Register hooks based on configuration
if (config.enableEnvironmentCheck) {
  hookManager.registerPreHook(
    new EnvironmentCheckHook(config.requiredEnvVars)
  );
}

if (config.enableNotifications) {
  hookManager.registerPostHook(
    new NotificationHook({
      slackWebhookUrl: config.slackWebhookUrl,
    })
  );
}

// Register hooks dynamically
task.metadata?.hooks?.forEach((hookName: string) => {
  const hook = createHook(hookName);
  hookManager.registerPreHook(hook);
});
```

## Hook Priority

Hooks are executed in priority order (lower number = earlier execution):

**PreHooks**:
- `0-10`: Critical validation (environment, permissions)
- `10-50`: Setup and preparation
- `50-100`: Custom logic

**PostHooks**:
- `0-50`: Data processing and metrics
- `50-90`: Notifications and reporting
- `90-100`: Cleanup and teardown

## Error Handling

### PreHook Failures

By default, PreHook failures **block** agent execution:

```typescript
hookManager.registerPreHook(
  new EnvironmentCheckHook(['REQUIRED_VAR']),
  { continueOnFailure: false } // Default: block execution
);
```

To allow execution to continue even if a prehook fails:

```typescript
hookManager.registerPreHook(
  new OptionalCheckHook(),
  { continueOnFailure: true } // Continue on failure
);
```

### PostHook Failures

PostHook failures **do not rollback** the agent execution:

```typescript
hookManager.registerPostHook(
  new NotificationHook({ ... }),
  { continueOnFailure: true } // Always continue
);
```

### ErrorHook Execution

ErrorHooks are **always executed** and never block:

```typescript
hookManager.registerErrorHook(
  new ErrorReportingHook(),
  { continueOnFailure: true } // Ignored - always continues
);
```

## Testing

### Unit Testing Hooks

```typescript
import { describe, it, expect } from 'vitest';
import { EnvironmentCheckHook } from './agents/hooks/index.js';

describe('EnvironmentCheckHook', () => {
  it('should pass when required env vars are set', async () => {
    process.env.TEST_VAR = 'value';

    const hook = new EnvironmentCheckHook(['TEST_VAR']);

    await expect(
      hook.execute({
        agentType: 'TestAgent',
        task: { id: 'test-1', title: 'Test' },
        config: {},
        startTime: Date.now(),
      })
    ).resolves.toBeUndefined();
  });

  it('should throw when required env vars are missing', async () => {
    delete process.env.TEST_VAR;

    const hook = new EnvironmentCheckHook(['TEST_VAR']);

    await expect(
      hook.execute({
        agentType: 'TestAgent',
        task: { id: 'test-1', title: 'Test' },
        config: {},
        startTime: Date.now(),
      })
    ).rejects.toThrow('Missing required environment variables: TEST_VAR');
  });
});
```

## Best Practices

1. **Keep hooks focused**: Each hook should do one thing well
2. **Use appropriate priorities**: Critical checks should run first
3. **Handle errors gracefully**: Don't crash on optional operations
4. **Log clearly**: Help debug hook execution
5. **Make hooks testable**: Extract logic for unit testing
6. **Document dependencies**: Clearly state what each hook requires
7. **Avoid side effects**: Hooks should not modify shared state

## Performance

- PreHooks are executed **sequentially** (blocking)
- PostHooks can be executed **in parallel** with `runInBackground: true`
- ErrorHooks are always executed **sequentially**

```typescript
// Slow: Sequential posthooks (default)
hookManager.registerPostHook(new SlowHook1());
hookManager.registerPostHook(new SlowHook2());

// Fast: Parallel posthooks
hookManager.registerPostHook(new SlowHook1(), { runInBackground: true });
hookManager.registerPostHook(new SlowHook2(), { runInBackground: true });
```

## Troubleshooting

### Hook Not Executing

1. Check hook is registered: `hookManager.getRegisteredHooks()`
2. Verify hook priority is correct
3. Check hook name is unique
4. Ensure BaseAgent has HookManager set

### Hook Timing Out

Increase timeout:

```typescript
hookManager.registerPreHook(
  new SlowHook(),
  { timeout: 30000 } // 30 seconds
);
```

### Hook Failures

Enable debug logging:

```bash
DEBUG=hooks npm run agents:parallel:exec
```

## Migration from Legacy Code

If you have existing validation/cleanup logic in agents:

```typescript
// Before
class MyAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    // Validation
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('Missing GITHUB_TOKEN');
    }

    // Execution
    const result = await this.doWork();

    // Cleanup
    await this.cleanup();

    return result;
  }
}

// After
class MyAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('MyAgent', config);

    const hookManager = new HookManager();

    // Move validation to prehook
    hookManager.registerPreHook(
      new EnvironmentCheckHook(['GITHUB_TOKEN'])
    );

    // Move cleanup to posthook
    hookManager.registerPostHook(
      new CleanupHook({ tempDirs: ['.temp'] })
    );

    this.setHookManager(hookManager);
  }

  async execute(task: Task): Promise<AgentResult> {
    // Just the core logic
    return await this.doWork();
  }
}
```

## Related

- [BaseAgent](../base-agent.ts) - Base agent implementation
- [Agent Types](../types/index.ts) - Type definitions
- [Hook Examples](./examples/) - Additional examples

---

🤖 Generated with Claude Code
