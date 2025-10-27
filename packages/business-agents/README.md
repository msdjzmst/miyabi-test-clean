# @miyabi/business-agents

**Business Strategy & Marketing Agents Package** - 14 specialized AI agents for business operations

## 概要

このパッケージは、ビジネス戦略・マーケティング・営業・顧客管理に特化した14個のAI Agentを提供します。
Coding Agents（コード生成・レビュー等）とは完全に分離され、ビジネスロジックに専念します。

## 🎯 Agent構成

### 戦略・企画系Agent（6個）

| Agent | キャラクター名 | 説明 |
|-------|--------------|------|
| **AIEntrepreneurAgent** | あきんどさん | AI起業家支援 - 8フェーズビジネスプラン作成 |
| **ProductConceptAgent** | かくちゃん | プロダクトコンセプト設計 - USP・収益モデル |
| **ProductDesignAgent** | つくりん | サービス詳細設計 - 6ヶ月コンテンツ・技術スタック |
| **FunnelDesignAgent** | みちびくん | 導線設計 - 認知→購入→LTV最適化 |
| **PersonaAgent** | かぞくん | ペルソナ設定 - 3-5人の詳細ペルソナ |
| **SelfAnalysisAgent** | みつめるん | 自己分析 - キャリア・スキル・実績分析 |

### マーケティング系Agent（5個）

| Agent | キャラクター名 | 説明 |
|-------|--------------|------|
| **MarketResearchAgent** | しらべるん | 市場調査 - 20社以上の競合調査 |
| **MarketingAgent** | ひろめるん | マーケティング - 広告・SEO・SNS施策 |
| **ContentCreationAgent** | かくん | コンテンツ制作 - 動画・記事・教材作成 |
| **SNSStrategyAgent** | つぶやくん | SNS戦略 - Twitter/Instagram/YouTube戦略 |
| **YouTubeAgent** | どうがん | YouTube運用 - チャンネル設計～投稿計画 |

### 営業・顧客管理系Agent（3個）

| Agent | キャラクター名 | 説明 |
|-------|--------------|------|
| **SalesAgent** | うるん | セールス - リード→顧客転換率最大化 |
| **CRMAgent** | まもるん | CRM・顧客管理 - LTV最大化 |
| **AnalyticsAgent** | かぞえるん | データ分析 - PDCA・継続改善 |

## 📦 インストール

```bash
# pnpmの場合
pnpm add @miyabi/business-agents

# npmの場合
npm install @miyabi/business-agents
```

## 🚀 使い方

### 基本的な使い方

```typescript
import { AIEntrepreneurAgent } from '@miyabi/business-agents/strategy';
import { MarketResearchAgent } from '@miyabi/business-agents/marketing';
import { SalesAgent } from '@miyabi/business-agents/sales';

// AI起業家支援Agent
const entrepreneurAgent = new AIEntrepreneurAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
});

const businessPlan = await entrepreneurAgent.execute({
  type: 'business-plan',
  idea: 'AIを活用したSaaS事業',
  targetMarket: 'エンジニア向け開発支援ツール',
});

// 市場調査Agent
const marketAgent = new MarketResearchAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const marketAnalysis = await marketAgent.execute({
  type: 'market-research',
  industry: 'Developer Tools',
  competitors: 20,
});

// セールスAgent
const salesAgent = new SalesAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const salesStrategy = await salesAgent.execute({
  type: 'sales-strategy',
  targetRevenue: 10_000_000, // 年間1000万円
  conversionGoal: 0.05, // 5%
});
```

### Claude Code Worktree統合

各AgentはClaude Code Worktree内で自律実行可能です：

```bash
# しきるん（CoordinatorAgent）がBusiness Agentを呼び出し
/agent-run --agent=ai-entrepreneur --issue=270

# Worktree内でBusiness Agent実行
cd .worktrees/issue-270
claude code "Issue #270 のビジネスプラン作成"
```

## 📚 ドキュメント

### Agent仕様書

各Agentの詳細仕様は`.claude/agents/specs/business/`を参照：

- [ai-entrepreneur-agent.md](../../.claude/agents/specs/business/ai-entrepreneur-agent.md)
- [product-concept-agent.md](../../.claude/agents/specs/business/product-concept-agent.md)
- [market-research-agent.md](../../.claude/agents/specs/business/market-research-agent.md)
- その他11個のAgent仕様

### キャラクター図鑑

全21個のAgent（Coding 7個 + Business 14個）のキャラクター名・役割：

- [AGENT_CHARACTERS.md](../../.claude/agents/AGENT_CHARACTERS.md) - ポケモン図鑑風Agent図鑑

## 🔗 Coding Agentsとの分離

| 項目 | Coding Agents | Business Agents |
|------|--------------|-----------------|
| **用途** | 開発自動化 | ビジネス戦略・マーケティング |
| **パッケージ** | `packages/coding-agents/` | `packages/business-agents/` |
| **Agent数** | 7個 | 14個 |
| **実行環境** | Worktree + Claude Code | Worktree + Claude Code |
| **SDK** | `miyabi-agent-sdk` | `miyabi-agent-sdk` |
| **依存関係** | 互いに独立 | 互いに独立 |

**完全分離の理由**:
- Coding Agentsはコード生成・レビュー・デプロイ等の技術的タスク
- Business Agentsはビジネスプラン・マーケティング・営業戦略等の非技術的タスク
- 両者は用途が全く異なるため、パッケージを分離して独立開発可能にする

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
