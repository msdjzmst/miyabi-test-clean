# Dynamic Agent System

完全な動的Agent生成・割り当てシステム。Cloud Codeとして動作し、タスクに応じてAgentを自動的に作成・割り当てします。

## 概要

Dynamic Agent Systemは、以下の4つのコンポーネントから構成されます：

```
┌──────────────────────────────────────────────────────────┐
│ AgentRegistry (Assignment & Management)                  │
│  - タスクへのAgent割り当て                                  │
│  - 既存Agentの再利用 or 新規作成の判断                        │
│  - Assignment履歴管理                                       │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│ AgentFactory (Agent Creation & Management)               │
│  - AgentTemplateからDynamicAgent生成                       │
│  - Agent instance管理                                      │
│  - Template registry                                       │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│ DynamicAgent (Generic Agent Implementation)              │
│  - AgentTemplateに基づいて動的に実行                        │
│  - BaseAgentを継承（全機能利用可能）                         │
│  - Hook System統合                                         │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│ AgentTemplate (Agent Definition)                         │
│  - Agent動作の定義                                          │
│  - 対応タスクタイプ                                          │
│  - Executor関数                                            │
│  - Initialize/Cleanup関数                                  │
└──────────────────────────────────────────────────────────┘
```

## 主要機能

### 1. 動的Agent生成

タスクに応じて、実行時にAgentを動的に生成：

```typescript
const factory = AgentFactory.getInstance();

// Templateを登録
factory.registerTemplate(codeGenTemplate);

// Task typeに基づいてAgentを自動生成
const agent = await factory.createAgentForTask('feature', config);

// タスク実行
await agent.run(task);
```

### 2. 自動Assignment

タスクに最適なAgentを自動的に割り当て：

```typescript
const registry = AgentRegistry.getInstance(config);

// Agentを割り当て（既存のAgentを再利用 or 新規作成）
const assignment = await registry.assignAgent({
  task,
  preferExisting: true,  // 既存Agentを優先
  maxConcurrentTasks: 1, // Agent毎の最大並行タスク数
});

if (assignment.success) {
  const agent = registry.getAgentForTask(task.id);
  await agent.run(task);
}
```

### 3. Agent再利用

アイドル状態のAgentを自動的に再利用してリソースを節約：

```typescript
// Task 1: 新しいAgentを作成
const assignment1 = await registry.assignAgent({ task: task1 });
// wasCreated: true

// Task 2: Task 1が完了後、同じAgentを再利用
const assignment2 = await registry.assignAgent({ task: task2 });
// wasCreated: false (既存Agentを再利用)
```

## コンポーネント詳細

### AgentTemplate

Agent動作の定義。

```typescript
interface AgentTemplate {
  id: string;                    // 一意なID
  name: string;                  // Agent名
  description: string;           // 説明
  version: string;               // バージョン
  supportedTypes: TaskType[];    // 対応タスクタイプ
  priority: number;              // 優先度（高い方が選ばれやすい）
  requiredCapabilities?: string[]; // 必要な機能
  executor: AgentExecutor;       // 実行関数
  initialize?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  metadata?: Record<string, any>;
}
```

**Example**:

```typescript
const codeGenTemplate: AgentTemplate = {
  id: 'codegen-v1',
  name: 'CodeGenAgent',
  description: 'AI-powered code generation',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 10,

  async executor(task: Task, context: AgentExecutionContext): Promise<AgentResult> {
    context.log('Generating code...');

    // AI code generation logic
    await context.utils.sleep(2000);

    return {
      status: 'success',
      data: { filesCreated: ['src/feature.ts'] },
      metrics: { qualityScore: 85 },
    };
  },

  async initialize(config: AgentConfig): Promise<void> {
    // Initialize API clients, etc.
  },

  async cleanup(config: AgentConfig): Promise<void> {
    // Cleanup resources
  },
};
```

### DynamicAgent

AgentTemplateを実行する汎用Agent。

```typescript
const agent = new DynamicAgent(template, config, hookManager);

// 初期化
await agent.initialize();

// タスク実行
const result = await agent.run(task);

// クリーンアップ
await agent.cleanup();

// 状態確認
console.log(agent.getStatus());          // 'idle' | 'running' | 'completed' | 'failed'
console.log(agent.getExecutionHistory()); // 実行履歴
console.log(agent.getInstanceInfo());     // Agentインスタンス情報
```

### AgentFactory

AgentTemplateからDynamicAgentを生成。

```typescript
const factory = AgentFactory.getInstance();

// Templateを登録
factory.registerTemplate(codeGenTemplate);
factory.registerTemplate(reviewTemplate);

// Template一覧
const templates = factory.getAllTemplates();

// Task typeに応じたTemplate検索
const template = factory.findBestTemplate('feature');

// Agent生成
const agent = await factory.createAgentForTask('feature', config, {
  hookManager,
  autoInitialize: true,
});

// 統計情報
console.log(factory.getStatistics());
// {
//   totalTemplates: 2,
//   totalInstances: 5,
//   idleInstances: 3,
//   runningInstances: 2,
//   completedInstances: 4,
//   failedInstances: 1
// }
```

### AgentRegistry

タスクへのAgent割り当て管理。

```typescript
const registry = AgentRegistry.getInstance(config);

// Default Hook Managerを設定（全Agentに適用）
registry.setDefaultHookManager(hookManager);

// Agentを割り当て
const assignment = await registry.assignAgent({
  task,
  agentType: 'CodeGenAgent',      // 特定のAgent typeを指定（オプション）
  preferExisting: true,            // 既存Agentを優先
  maxConcurrentTasks: 1,           // 並行タスク数制限
  requiredCapabilities: ['git'],   // 必要な機能
});

console.log(assignment);
// {
//   success: true,
//   agentInstance: { instanceId: '...', ... },
//   wasCreated: false,  // 既存Agentを再利用
//   reason: 'Found idle agent matching criteria'
// }

// 割り当てられたAgentを取得
const agent = registry.getAgentForTask(task.id);
await agent.run(task);

// 完了したAssignmentをクリーンアップ
registry.cleanupCompletedAssignments();

// アイドルAgentを破棄
await registry.destroyIdleAgents();

// 統計情報
console.log(registry.getStatistics());
// {
//   totalAssignments: 10,
//   activeAgents: 2,
//   idleAgents: 3,
//   totalAgents: 5
// }
```

## 使用例

### Example 1: シンプルなAgent Template

```typescript
import { AgentFactory } from './agents/agent-factory.js';
import { AgentTemplate } from './agents/types/agent-template.js';

const simpleTemplate: AgentTemplate = {
  id: 'simple-v1',
  name: 'SimpleAgent',
  description: 'Simple task executor',
  version: '1.0.0',
  supportedTypes: ['feature'],
  priority: 5,

  async executor(task, context) {
    context.log('Executing task...');
    await context.utils.sleep(1000);

    return {
      status: 'success',
      data: { message: 'Task completed' },
    };
  },
};

// 登録して使用
const factory = AgentFactory.getInstance();
factory.registerTemplate(simpleTemplate);

const agent = await factory.createAgent(simpleTemplate.id, config);
await agent.run(task);
```

### Example 2: 自動Assignment

```typescript
import { AgentRegistry } from './agents/agent-registry.js';

const registry = AgentRegistry.getInstance(config);

// 複数のタスク
const tasks = [
  { id: 'task-1', type: 'feature', ... },
  { id: 'task-2', type: 'bug', ... },
  { id: 'task-3', type: 'feature', ... },
];

// 全タスクにAgentを割り当て
for (const task of tasks) {
  const assignment = await registry.assignAgent({ task });

  if (assignment.success) {
    const agent = registry.getAgentForTask(task.id);
    await agent.run(task);
  }
}

// クリーンアップ
await registry.cleanupCompletedAssignments();
await registry.destroyIdleAgents();
```

### Example 3: Claude API統合

```typescript
import Anthropic from '@anthropic-ai/sdk';

const claudeTemplate: AgentTemplate = {
  id: 'claude-codegen-v1',
  name: 'ClaudeCodeGenAgent',
  description: 'Code generation with Claude Sonnet 4',
  version: '1.0.0',
  supportedTypes: ['feature', 'bug', 'refactor'],
  priority: 20,
  requiredCapabilities: ['anthropic-api'],

  async initialize(config) {
    // Initialize Claude client
    context.state.set('claude', new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }));
  },

  async executor(task, context) {
    const claude = context.state.get('claude');

    context.log('Calling Claude Sonnet 4...');

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Generate TypeScript code for: ${task.description}`,
      }],
    });

    // Process AI response
    const generatedCode = response.content[0].text;

    // Write files
    await writeFile('src/generated.ts', generatedCode);

    return {
      status: 'success',
      data: { filesCreated: ['src/generated.ts'] },
      metrics: { qualityScore: 90, aiGenerated: true },
    };
  },

  async cleanup(config) {
    // Cleanup Claude resources
  },
};
```

### Example 4: Dashboard統合

```typescript
import { HookManager, DashboardWebhookHook } from './agents/hooks/index.js';

const registry = AgentRegistry.getInstance(config);

// Dashboard webhook hookを作成
const hookManager = new HookManager();
const dashboardHook = new DashboardWebhookHook({
  dashboardUrl: 'http://localhost:3001',
  sessionId: `session-${Date.now()}`,
  deviceIdentifier: config.deviceIdentifier,
});

hookManager.registerPreHook(dashboardHook);
hookManager.registerPostHook(dashboardHook, { runInBackground: true });
hookManager.registerErrorHook(dashboardHook);

// 全AgentにHookを適用
registry.setDefaultHookManager(hookManager);

// Agentを割り当てて実行（自動的にDashboardに報告）
const assignment = await registry.assignAgent({ task });
const agent = registry.getAgentForTask(task.id);
await agent.run(task);
```

### Example 5: 並列実行

```typescript
const registry = AgentRegistry.getInstance(config);

// 独立したタスク
const tasks = [
  { id: 'task-1', type: 'feature', dependencies: [] },
  { id: 'task-2', type: 'feature', dependencies: [] },
  { id: 'task-3', type: 'bug', dependencies: [] },
];

// 全タスクにAgentを割り当て
const assignments = await Promise.all(
  tasks.map(task => registry.assignAgent({ task }))
);

// 全タスクを並列実行
await Promise.all(
  tasks.map(async (task) => {
    const agent = registry.getAgentForTask(task.id);
    if (agent) {
      return agent.run(task);
    }
  })
);
```

## ベストプラクティス

### 1. Template Priorityを適切に設定

```typescript
// Simple implementation (low priority)
const simpleTemplate: AgentTemplate = {
  id: 'simple-v1',
  priority: 10,
  ...
};

// Advanced implementation (high priority)
const advancedTemplate: AgentTemplate = {
  id: 'advanced-v1',
  priority: 20, // より優先される
  ...
};
```

### 2. Initialize/Cleanupを実装

```typescript
const template: AgentTemplate = {
  ...
  async initialize(config) {
    // API clients, database connections, etc.
    context.state.set('client', new APIClient(config));
  },

  async cleanup(config) {
    // Close connections, free resources
    const client = context.state.get('client');
    await client.close();
  },
};
```

### 3. 共有Stateを活用

```typescript
const template: AgentTemplate = {
  ...
  async executor(task, context) {
    // 前回の実行結果を取得
    const lastResult = context.state.get('lastResult');

    // 処理...

    // 次回のために結果を保存
    context.state.set('lastResult', result);

    return result;
  },
};
```

### 4. エラーハンドリング

```typescript
const template: AgentTemplate = {
  ...
  async executor(task, context) {
    try {
      // 処理...
      return { status: 'success', data: {} };
    } catch (error) {
      context.log(`Error: ${error.message}`);

      // Retry with exponential backoff
      return await context.utils.retry(async () => {
        // Retry logic
      }, 3);
    }
  },
};
```

### 5. Hook Systemと統合

```typescript
const hookManager = new HookManager();

// PreHook: 環境チェック
hookManager.registerPreHook(new EnvironmentCheckHook(['API_KEY']));

// PostHook: 通知
hookManager.registerPostHook(new NotificationHook({ ... }));

// Registryに設定（全Agentに適用）
registry.setDefaultHookManager(hookManager);
```

## トラブルシューティング

### Template未登録エラー

```
Error: Template "codegen-v1" not found
```

**解決策**:
```typescript
const factory = AgentFactory.getInstance();
factory.registerTemplate(codeGenTemplate);
```

### Assignment失敗

```
Assignment failed: No template found for task type: deployment
```

**解決策**:
```typescript
// Deployment用Templateを登録
factory.registerTemplate(deploymentTemplate);
```

### Agent再利用されない

**原因**: Agentがまだ `running` 状態

**解決策**:
```typescript
// Task完了後、Assignmentをクリーンアップ
await registry.cleanupCompletedAssignments();
```

### メモリリーク

**原因**: アイドルAgentが破棄されていない

**解決策**:
```typescript
// 定期的にアイドルAgentを破棄
setInterval(async () => {
  await registry.destroyIdleAgents();
}, 60000); // 1分毎
```

## API Reference

### AgentTemplate

- `id: string` - 一意なTemplate ID
- `name: string` - Agent名
- `supportedTypes: TaskType[]` - 対応タスクタイプ
- `priority: number` - 優先度
- `executor: AgentExecutor` - 実行関数
- `initialize?: () => Promise<void>` - 初期化関数
- `cleanup?: () => Promise<void>` - クリーンアップ関数

### DynamicAgent

- `async initialize()` - Agent初期化
- `async execute(task)` - タスク実行
- `async cleanup()` - クリーンアップ
- `getStatus()` - 現在の状態取得
- `getExecutionHistory()` - 実行履歴取得
- `getInstanceInfo()` - インスタンス情報取得
- `canHandleTask(task)` - タスク対応可否チェック

### AgentFactory

- `static getInstance()` - シングルトンインスタンス取得
- `registerTemplate(template)` - Template登録
- `unregisterTemplate(id)` - Template登録解除
- `getTemplate(id)` - Template取得
- `getAllTemplates()` - 全Template取得
- `findTemplatesByType(type)` - Type別Template検索
- `findBestTemplate(type)` - 最適Template検索
- `async createAgent(templateId, config, options)` - Agent生成
- `async createAgentForTask(taskType, config, options)` - Task type別Agent生成
- `getInstance(id)` - Agentインスタンス取得
- `getAllInstances()` - 全インスタンス取得
- `getIdleInstances()` - アイドルインスタンス取得
- `async destroyAgent(id)` - Agent破棄
- `async destroyIdleAgents()` - アイドルAgent一括破棄
- `getStatistics()` - 統計情報取得

### AgentRegistry

- `static getInstance(config)` - シングルトンインスタンス取得
- `setDefaultHookManager(hookManager)` - デフォルトHook Manager設定
- `async assignAgent(criteria)` - Agent割り当て
- `getAgentForTask(taskId)` - タスク割り当てAgent取得
- `unassignAgent(taskId)` - Agent割り当て解除
- `getAllAssignments()` - 全Assignment取得
- `getStatistics()` - 統計情報取得
- `cleanupCompletedAssignments()` - 完了Assignment削除
- `async destroyIdleAgents()` - アイドルAgent破棄
- `async clear()` - 全クリア

## 関連ドキュメント

- [BaseAgent](./base-agent.ts) - Base agent implementation
- [Hook System](./hooks/README.md) - Hook system documentation
- [Dashboard Integration](./hooks/DASHBOARD_INTEGRATION.md) - Dashboard webhook integration
- [Examples](./examples/dynamic-agent-usage.ts) - Complete usage examples

---

🤖 Generated with Claude Code
