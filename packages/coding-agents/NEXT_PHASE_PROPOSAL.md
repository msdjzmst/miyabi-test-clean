# 次期実装フェーズ提案 - Dashboard Integration Phase

**提案日:** 2025-10-12
**フェーズ:** Phase 2 - Dashboard Integration
**依存:** Intelligent Agent System v1.0.0 (完了)

---

## 📋 フェーズ概要

### 目的

Intelligent Agent Systemとダッシュボードをリアルタイムで統合し、すべてのAgent操作を可視化する。

### 期待される成果

1. **リアルタイム可視化**: Agent分析・割り当て・実行をリアルタイムで表示
2. **統計ダッシュボード**: ツール作成数、成功率、実行時間をグラフ表示
3. **アラート機能**: 失敗時の即座通知
4. **履歴追跡**: 全Agent操作の完全な履歴

---

## 🎯 実装対象コンポーネント

### 1. AgentAnalyzer Dashboard Integration

**ファイル:** `agents/agent-analyzer.ts` (拡張)
**追加行数:** ~50行

#### 実装内容

```typescript
import { DashboardWebhookHook } from './hooks/built-in/dashboard-webhook-hook.js';

export class AgentAnalyzer {
  private dashboardHook?: DashboardWebhookHook;

  setDashboardHook(hook: DashboardWebhookHook) {
    this.dashboardHook = hook;
  }

  async analyzeTask(task: Task, templates: AgentTemplate[]): Promise<AgentAnalysisResult> {
    // 分析開始イベント
    await this.dashboardHook?.sendCustomEvent({
      eventType: 'analysis:started',
      taskId: task.id,
      timestamp: new Date().toISOString(),
    });

    // 分析実行
    const result = await this.performAnalysis(task, templates);

    // 分析完了イベント (複雑度スコア付き)
    await this.dashboardHook?.sendCustomEvent({
      eventType: 'analysis:completed',
      taskId: task.id,
      data: {
        complexityScore: result.complexity.complexityScore,
        category: result.complexity.category,
        capabilities: result.requirements.capabilities,
        strategy: result.assignmentStrategy.type,
        confidence: result.assignmentStrategy.confidence,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }
}
```

#### ダッシュボード表示

```
┌─────────────────────────────────────────────────┐
│ 📊 Task Analysis Dashboard                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ Task: "Implement WebSocket system"              │
│                                                 │
│ ⏱️  Analysis: 2ms                               │
│ 📈 Complexity: 95/100 (Expert)                  │
│ 🎯 Strategy: reuse-existing                     │
│ 💯 Confidence: 70%                              │
│                                                 │
│ Required Capabilities:                          │
│   • typescript                                  │
│   • testing                                     │
│   • api                                         │
│                                                 │
│ Recommended Tools:                              │
│   • tsc, eslint, prettier                       │
│   • vitest, jest, playwright                    │
│   • axios, fetch                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 2. ToolFactory Dashboard Integration

**ファイル:** `agents/tool-factory.ts` (拡張)
**追加行数:** ~40行

#### 実装内容

```typescript
export class ToolFactory {
  private dashboardHook?: DashboardWebhookHook;

  setDashboardHook(hook: DashboardWebhookHook) {
    this.dashboardHook = hook;
  }

  async createTool(requirement: ToolRequirement): Promise<ToolCreationResult> {
    const startTime = Date.now();

    // ツール作成開始
    await this.dashboardHook?.sendCustomEvent({
      eventType: 'tool:creation_started',
      data: {
        toolName: requirement.name,
        toolType: requirement.type,
        priority: requirement.priority,
      },
      timestamp: new Date().toISOString(),
    });

    // ツール作成
    const result = await this.performToolCreation(requirement);

    // ツール作成完了
    await this.dashboardHook?.sendCustomEvent({
      eventType: 'tool:creation_completed',
      data: {
        toolId: result.tool?.id,
        toolName: requirement.name,
        success: result.success,
        durationMs: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }
}
```

#### ダッシュボード表示

```
┌─────────────────────────────────────────────────┐
│ 🔧 Tool Creation Dashboard                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ Created Tools: 12                               │
│ Success Rate: 100%                              │
│ Avg Creation Time: 0.5ms                       │
│                                                 │
│ Recent Creations:                               │
│  ✅ eslint (command) - 0ms                      │
│  ✅ tsc (command) - 0ms                         │
│  ✅ github-api (api) - 1ms                      │
│  ✅ vitest (command) - 0ms                      │
│                                                 │
│ Tool Type Distribution:                         │
│  ███████░░░ Command (70%)                       │
│  ████░░░░░░ API (30%)                           │
│  ░░░░░░░░░░ Library (0%)                        │
│  ░░░░░░░░░░ Service (0%)                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 3. Enhanced AgentRegistry Dashboard Integration

**ファイル:** `agents/agent-registry.ts` (拡張)
**追加行数:** ~80行

#### 実装内容

```typescript
export class AgentRegistry {
  async assignAgent(criteria: AgentAssignmentCriteria): Promise<AgentAssignmentResult> {
    const startTime = Date.now();

    // 割り当て開始
    await this.defaultHookManager?.executePreHooks({
      task: criteria.task,
      agent: null,
      startTime: Date.now(),
    });

    // Step 1: 分析 (既存のダッシュボード統合を利用)
    const analysis = await this.analyzer.analyzeTask(criteria.task, this.factory.getAllTemplates());

    // Step 2: リソース作成進捗
    let toolsCreated = 0;
    let hooksCreated = 0;

    for (const toolReq of analysis.requirements.tools) {
      if (toolReq.critical || toolReq.priority > 50) {
        const result = await this.toolFactory.createTool(toolReq);
        if (result.success) {
          toolsCreated++;

          // 進捗イベント
          await this.sendProgressEvent(criteria.task.id, {
            stage: 'tool_creation',
            currentStep: `Created ${toolsCreated}/${analysis.requirements.tools.length} tools`,
            percentage: (toolsCreated / analysis.requirements.tools.length) * 50, // 50% for tools
          });
        }
      }
    }

    for (const hookReq of analysis.requirements.hooks) {
      const hook = await this.toolFactory.createHook(hookReq);
      hooksCreated++;

      // 進捗イベント
      await this.sendProgressEvent(criteria.task.id, {
        stage: 'hook_creation',
        currentStep: `Created ${hooksCreated}/${analysis.requirements.hooks.length} hooks`,
        percentage: 50 + (hooksCreated / analysis.requirements.hooks.length) * 30, // 30% for hooks
      });
    }

    // Step 3: エージェント割り当て
    const assignment = await this.performAssignment(criteria, analysis);

    // 割り当て完了
    await this.defaultHookManager?.executePostHooks(
      {
        task: criteria.task,
        agent: assignment.agentInstance,
        startTime,
      },
      {
        status: 'success',
        data: {
          wasCreated: assignment.wasCreated,
          toolsCreated,
          hooksCreated,
        },
      }
    );

    return assignment;
  }

  private async sendProgressEvent(taskId: string, progress: any) {
    // DashboardWebhookHook経由で進捗送信
    const hook = this.defaultHookManager?.getHook('dashboard-webhook') as DashboardWebhookHook;
    if (hook) {
      await hook.sendProgress(
        { task: { id: taskId }, agent: null, startTime: Date.now() },
        progress.currentStep,
        progress.percentage,
        [],
        []
      );
    }
  }
}
```

#### ダッシュボード表示

```
┌─────────────────────────────────────────────────┐
│ 🎯 Agent Assignment Dashboard                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Task: "Implement WebSocket system"              │
│                                                 │
│ Progress: ████████░░ 80%                        │
│                                                 │
│ ✅ Stage 1: Analysis Complete (2ms)             │
│    └─ Complexity: 95/100 (expert)               │
│                                                 │
│ ✅ Stage 2: Resource Creation Complete          │
│    ├─ Tools Created: 3/3                        │
│    │   • tsc, eslint, vitest                    │
│    └─ Hooks Created: 1/1                        │
│        • completion-notification                │
│                                                 │
│ 🔄 Stage 3: Agent Assignment In Progress...     │
│    └─ Finding best template...                  │
│                                                 │
│ ⏸️  Stage 4: Execution Pending                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 4. DynamicAgent Dashboard Integration

**ファイル:** `agents/dynamic-agent.ts` (拡張)
**追加行数:** ~60行

#### 実装内容

```typescript
export class DynamicAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    // 実行開始 (BaseAgentのフック経由で自動送信)
    this.status = 'running';

    // ツール作成時の進捗
    const toolCreator = new DynamicToolCreator();
    toolCreator.onToolCreated = async (tool: DynamicToolSpec) => {
      await this.sendProgressEvent({
        stage: 'tool_creation',
        currentStep: `Created runtime tool: ${tool.name}`,
        percentage: 50,
      });
    };

    // 実行コンテキスト
    const context: AgentExecutionContext = {
      config: this.config,
      hookManager: this.getHookManager(),
      startTime: Date.now(),
      state: this.state,
      log: this.log.bind(this),
      utils: {
        sleep: this.sleep.bind(this),
        retry: this.retry.bind(this),
        executeCommand: this.executeCommand.bind(this),
      },
      toolCreator,
    };

    // テンプレート実行
    const result = await this.template.executor(task, context);

    // 完了 (BaseAgentのフック経由で自動送信)
    this.status = 'completed';

    return result;
  }

  private async sendProgressEvent(progress: any) {
    const hook = this.getHookManager()?.getHook('dashboard-webhook') as DashboardWebhookHook;
    if (hook) {
      await hook.sendProgress(
        {
          task: this.currentTask!,
          agent: this.getInstanceInfo(),
          startTime: this.startTime,
        },
        progress.currentStep,
        progress.percentage,
        [],
        []
      );
    }
  }
}
```

#### ダッシュボード表示

```
┌─────────────────────────────────────────────────┐
│ 🤖 Agent Execution Dashboard                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Agent: TestAgent-xxx                            │
│ Task: "Implement WebSocket system"              │
│                                                 │
│ Progress: ████████████ 100%                     │
│                                                 │
│ ✅ Pre-Hooks Executed (3 hooks)                 │
│ ✅ Tool Creation (1 tool)                       │
│    └─ test-tool (command)                       │
│ ✅ Task Execution Complete                      │
│ ✅ Post-Hooks Executed (1 hook)                 │
│                                                 │
│ Result:                                         │
│  Status: ✅ Success                             │
│  Quality Score: 85/100                          │
│  Duration: 1134ms                               │
│  Files Created: 2                               │
│  Tests Added: 3                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📊 新規イベントタイプ

### 追加するカスタムイベント

```typescript
// 既存イベント (11種類) に追加
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
  | 'metric:recorded'

  // 🆕 新規追加 (7種類)
  | 'analysis:started'
  | 'analysis:completed'
  | 'tool:creation_started'
  | 'tool:creation_completed'
  | 'assignment:started'
  | 'assignment:completed'
  | 'runtime_tool:created';
```

### イベントペイロード例

```typescript
// 分析完了イベント
{
  eventType: 'analysis:completed',
  taskId: 'task-123',
  agentType: 'AgentAnalyzer',
  sessionId: 'session-456',
  deviceIdentifier: 'MacBook-Pro',
  timestamp: '2025-10-12T10:30:00Z',
  data: {
    complexityScore: 95,
    category: 'expert',
    capabilities: ['typescript', 'testing'],
    strategy: 'reuse-existing',
    confidence: 70,
    durationMs: 2
  }
}

// ツール作成完了イベント
{
  eventType: 'tool:creation_completed',
  taskId: 'task-123',
  agentType: 'ToolFactory',
  sessionId: 'session-456',
  deviceIdentifier: 'MacBook-Pro',
  timestamp: '2025-10-12T10:30:01Z',
  data: {
    toolId: 'dyn-tool-xxx',
    toolName: 'eslint',
    toolType: 'command',
    success: true,
    durationMs: 0
  }
}
```

---

## 🎨 ダッシュボードUI提案

### メイン画面

```
┌──────────────────────────────────────────────────────────────┐
│ 🤖 Intelligent Agent System - Dashboard                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │
│ │ Active Agents  │ │ Tools Created  │ │ Success Rate   │   │
│ │      3         │ │      47        │ │     98.5%      │   │
│ └────────────────┘ └────────────────┘ └────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 📊 Live Agent Activity                                    ││
│ ├──────────────────────────────────────────────────────────┤│
│ │                                                           ││
│ │ Agent-1 ██████████████████░░ 90% Analysis Complete       ││
│ │ Agent-2 ████████████████████ 100% Execution Success      ││
│ │ Agent-3 ██████░░░░░░░░░░░░░ 30% Tool Creation...         ││
│ │                                                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 📈 Performance Metrics (Last 24h)                         ││
│ ├──────────────────────────────────────────────────────────┤│
│ │                                                           ││
│ │  Complexity Score Distribution                            ││
│ │  ████████████░░░░░░░░░░░░░░░░ Expert (60%)               ││
│ │  ████████░░░░░░░░░░░░░░░░░░░░ Complex (30%)              ││
│ │  ████░░░░░░░░░░░░░░░░░░░░░░░░ Moderate (10%)             ││
│ │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Simple (0%)                ││
│ │                                                           ││
│ │  Assignment Strategy Usage                                ││
│ │  ██████████████████████░░░░░░ Reuse Existing (75%)       ││
│ │  ███████░░░░░░░░░░░░░░░░░░░░░ Create New (20%)           ││
│ │  ██░░░░░░░░░░░░░░░░░░░░░░░░░░ Hybrid (5%)                ││
│ │                                                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 🔔 Recent Events                                          ││
│ ├──────────────────────────────────────────────────────────┤│
│ │                                                           ││
│ │ 10:30:45 ✅ Agent-2 completed task-456 (QS: 92/100)      ││
│ │ 10:30:12 🔧 Created tool: vitest (command)                ││
│ │ 10:29:58 📊 Analysis: task-789 (expert, 95/100)          ││
│ │ 10:29:45 🎯 Assigned Agent-3 to task-789                  ││
│ │ 10:29:30 🚀 Agent-1 started task-123                      ││
│ │                                                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 実装計画

### Phase 2.1: Dashboard Hook統合 (Week 1)

**タスク:**
1. AgentAnalyzer にダッシュボードフック追加
2. ToolFactory にダッシュボードフック追加
3. カスタムイベント7種類追加
4. 単体テスト作成

**成果物:**
- agents/agent-analyzer.ts (拡張)
- agents/tool-factory.ts (拡張)
- agents/types/dashboard-events.ts (拡張)
- agents/tests/dashboard-integration-test.ts

### Phase 2.2: Registry & Agent統合 (Week 2)

**タスク:**
1. AgentRegistry に進捗イベント追加
2. DynamicAgent に進捗イベント追加
3. 統合テスト作成
4. E2Eテスト作成

**成果物:**
- agents/agent-registry.ts (拡張)
- agents/dynamic-agent.ts (拡張)
- agents/tests/dashboard-e2e-test.ts

### Phase 2.3: Dashboard UI実装 (Week 3)

**タスク:**
1. リアルタイムイベント表示コンポーネント
2. 統計グラフコンポーネント
3. アクティビティフィードコンポーネント
4. レスポンシブデザイン

**成果物:**
- packages/dashboard/src/components/IntelligentAgentDashboard.tsx
- packages/dashboard/src/components/AnalysisChart.tsx
- packages/dashboard/src/components/ToolCreationFeed.tsx
- packages/dashboard/src/components/AgentActivityMonitor.tsx

---

## 📈 期待される効果

### 1. 可視性の向上

- **Before**: ログファイルでのみ確認可能
- **After**: リアルタイムでブラウザ上で確認可能

### 2. デバッグ効率の向上

- **Before**: エラー発生後にログを調査
- **After**: エラー発生時に即座に通知、詳細をダッシュボードで確認

### 3. パフォーマンス分析

- **Before**: 手動でメトリクス集計
- **After**: 自動でグラフ化、傾向分析

### 4. チーム協調

- **Before**: 個人のローカル実行のみ
- **After**: チーム全体でAgent活動を共有

---

## 💡 追加提案

### 1. アラート機能

```typescript
// 失敗率が閾値を超えたらSlack通知
if (failureRate > 10%) {
  await sendSlackAlert({
    channel: '#agent-alerts',
    message: '⚠️ Agent failure rate exceeded 10%',
    failureRate,
    affectedAgents,
  });
}
```

### 2. A/Bテスト機能

```typescript
// 異なる戦略の比較
const strategyA = 'reuse-existing';
const strategyB = 'always-create-new';

const comparison = await compareStrategies(strategyA, strategyB, {
  tasks: testTasks,
  duration: '7days',
});

console.log('Strategy A success rate:', comparison.strategyA.successRate);
console.log('Strategy B success rate:', comparison.strategyB.successRate);
```

### 3. 予測機能

```typescript
// 過去データから今後の傾向を予測
const prediction = await predictAgentLoad({
  historicalData: last30Days,
  predictionWindow: '7days',
});

console.log('Predicted peak load:', prediction.peakLoad);
console.log('Recommended agent count:', prediction.recommendedAgentCount);
```

---

## ✅ 成功基準

1. **100%イベント配信**: すべてのAgent操作がダッシュボードに表示される
2. **<500msレイテンシ**: イベント発生から表示まで500ms以内
3. **99.9%稼働率**: ダッシュボードサービスの高可用性
4. **ゼロデータロス**: すべてのイベントが記録される

---

## 📝 まとめ

### フェーズ2の目標

**"Intelligent Agent Systemのすべての動作をリアルタイムで可視化し、チーム全体で共有する"**

### 実装規模

- **拡張ファイル数**: 4ファイル (agent-analyzer, tool-factory, agent-registry, dynamic-agent)
- **新規コンポーネント**: 4コンポーネント (Dashboard UI)
- **追加イベントタイプ**: 7種類
- **実装期間**: 3週間

### 期待される成果

✅ リアルタイム可視化
✅ デバッグ効率向上
✅ パフォーマンス分析
✅ チーム協調強化

---

**提案者:** Claude Code
**提案日:** 2025-10-12
**次回レビュー:** Phase 2実装前
**ステータス:** ✅ 提案完了・承認待ち
