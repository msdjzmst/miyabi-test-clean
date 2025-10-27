# @miyabi/coding-agents

**Coding Agents Package** - 7 specialized AI agents for development automation

## 概要

このパッケージは、開発自動化に特化した7個のAI Agentを提供します。
Issue分析、コード生成、品質レビュー、PR作成、デプロイまでを完全自動化します。

## 🎯 Agent構成

| Agent | キャラクター名 | 説明 |
|-------|--------------|------|
| **CoordinatorAgent** | しきるん | タスク統括・DAG分解・Agent割り当て |
| **CodeGenAgent** | つくるん | AI駆動コード生成（Claude Sonnet 4） |
| **ReviewAgent** | めだまん | コード品質レビュー（100点満点スコアリング） |
| **IssueAgent** | みつけるん | Issue分析・ラベリング（AI推論） |
| **PRAgent** | まとめるん | Pull Request自動作成（Conventional Commits） |
| **DeploymentAgent** | はこぶん | CI/CDデプロイ自動化（Firebase/Vercel/AWS） |
| **WaterSpiderAgent** | みずすま | セッション管理・Webhook連携 |

## 📦 インストール

```bash
# pnpmの場合
pnpm add @miyabi/coding-agents

# npmの場合
npm install @miyabi/coding-agents
```

## 🚀 使い方

### 基本的な使い方

```typescript
import { CoordinatorAgent } from '@miyabi/coding-agents/coordinator';
import { CodeGenAgent } from '@miyabi/coding-agents/codegen';
import { ReviewAgent } from '@miyabi/coding-agents/review';

// しきるん（CoordinatorAgent）でタスク分解
const coordinator = new CoordinatorAgent({
  deviceIdentifier: 'my-device',
  githubToken: process.env.GITHUB_TOKEN,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const decomposition = await coordinator.decomposeIssue(issue);
console.log(`Tasks: ${decomposition.tasks.length}`);
console.log(`DAG Levels: ${decomposition.dag.levels.length}`);

// つくるん（CodeGenAgent）でコード生成
const codegen = new CodeGenAgent({
  deviceIdentifier: 'my-device',
  githubToken: process.env.GITHUB_TOKEN,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const result = await codegen.execute(task);

// めだまん（ReviewAgent）で品質チェック
const review = new ReviewAgent({
  deviceIdentifier: 'my-device',
  githubToken: process.env.GITHUB_TOKEN,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const qualityReport = await review.execute(task);
console.log(`Quality Score: ${qualityReport.score}/100`);
```

### Claude Code Worktree統合

各AgentはWorktree内で自律実行可能です：

```bash
# しきるん（CoordinatorAgent）がWorktreeを作成
npm run agents:parallel:exec -- --issues=270,271,272 --concurrency=2

# 各Worktree内でClaude Code実行
cd .worktrees/issue-270
claude code "Issue #270 を実装して"
```

## 📚 ドキュメント

### Agent仕様書

各Agentの詳細仕様は`.claude/agents/specs/coding/`を参照：

- [coordinator-agent.md](../../.claude/agents/specs/coding/coordinator-agent.md)
- [codegen-agent.md](../../.claude/agents/specs/coding/codegen-agent.md)
- [review-agent.md](../../.claude/agents/specs/coding/review-agent.md)
- [deployment-agent.md](../../.claude/agents/specs/coding/deployment-agent.md)
- [pr-agent.md](../../.claude/agents/specs/coding/pr-agent.md)
- [issue-agent.md](../../.claude/agents/specs/coding/issue-agent.md)

### Agent実行プロンプト

Worktree内での実行手順は`.claude/agents/prompts/coding/`を参照：

- [coordinator-agent-prompt.md](../../.claude/agents/prompts/coding/coordinator-agent-prompt.md)
- [codegen-agent-prompt.md](../../.claude/agents/prompts/coding/codegen-agent-prompt.md)
- [review-agent-prompt.md](../../.claude/agents/prompts/coding/review-agent-prompt.md)
- [deployment-agent-prompt.md](../../.claude/agents/prompts/coding/deployment-agent-prompt.md)
- [pr-agent-prompt.md](../../.claude/agents/prompts/coding/pr-agent-prompt.md)
- [issue-agent-prompt.md](../../.claude/agents/prompts/coding/issue-agent-prompt.md)

### キャラクター図鑑

全21個のAgent（Coding 7個 + Business 14個）のキャラクター名・役割：

- [AGENT_CHARACTERS.md](../../.claude/agents/AGENT_CHARACTERS.md) - ポケモン図鑑風Agent図鑑

## 🔗 Business Agentsとの分離

| 項目 | Coding Agents | Business Agents |
|------|--------------|-----------------|
| **用途** | 開発自動化 | ビジネス戦略・マーケティング |
| **パッケージ** | `@miyabi/coding-agents` | `@miyabi/business-agents` |
| **Agent数** | 7個 | 14個 |
| **実行環境** | Worktree + Claude Code | Worktree + Claude Code |
| **SDK** | `miyabi-agent-sdk` | `miyabi-agent-sdk` |
| **依存関係** | 互いに独立 | 互いに独立 |

**完全分離の理由**:
- Coding Agentsはコード生成・レビュー・デプロイ等の技術的タスク
- Business Agentsはビジネスプラン・マーケティング・営業戦略等の非技術的タスク
- 両者は用途が全く異なるため、パッケージを分離して独立開発可能にする

## 🏗️ アーキテクチャ

### Git Worktree並列実行

```
┌─────────────────────────────────────────────────────────┐
│ CoordinatorAgent (Main Process)                          │
│ - Issue分析・Task分解                                      │
│ - DAG構築・依存関係解決                                     │
│ - Worktree作成・管理                                       │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Worktree #1 │ │ Worktree #2 │ │ Worktree #3 │
│ Issue #270  │ │ Issue #271  │ │ Issue #272  │
│             │ │             │ │             │
│ Claude Code │ │ Claude Code │ │ Claude Code │
│ + CodeGen   │ │ + Review    │ │ + Deploy    │
└─────────────┘ └─────────────┘ └─────────────┘
```

### Label体系連携

すべてのCoding AgentはGitHub Labelと連携：

- **IssueAgent**: AI推論で `type`, `priority`, `severity` を自動推定
- **CoordinatorAgent**: `state:pending` → `state:analyzing` へ遷移
- **CodeGenAgent**: `agent:codegen` + `state:implementing` で実行
- **ReviewAgent**: 品質スコア80点以上で `quality:good` 付与
- **PRAgent**: Conventional Commits準拠のPRタイトル生成
- **DeploymentAgent**: `trigger:deploy-staging` で即座にデプロイ

## 🛠️ 開発

```bash
# ビルド
pnpm build

# 型チェック
pnpm type-check

# テスト
pnpm test

# テストウォッチ
pnpm test:watch
```

## 📝 ライセンス

MIT

---

**関連リンク**:
- [Miyabi Repository](https://github.com/ShunsukeHayashi/Miyabi)
- [Agent SDK](https://www.npmjs.com/package/miyabi-agent-sdk)
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト設定
- [Business Agents Package](../business-agents/README.md)
