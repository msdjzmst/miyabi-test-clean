# Business Agent Specifications

ビジネス・経営戦略系Agentの仕様書ディレクトリです。

## Agent一覧（14個）

### 戦略・企画系 (6個)

#### 1. AIEntrepreneurAgent
**AI起業家支援Agent - 包括的なビジネスプラン作成**

- **ファイル**: `ai-entrepreneur-agent.md`
- **権限**: 🔴統括権限
- **役割**: 8フェーズのビジネスプラン作成（市場分析 → 資金調達計画）
- **技術**: Claude Sonnet 4、プロンプトチェーン、長文レポート生成
- **エスカレーション**: CEO (戦略判断)、CFO (財務判断)、外部コンサル

#### 2. ProductConceptAgent
**プロダクトコンセプト設計Agent**

- **ファイル**: `product-concept-agent.md`
- **権限**: 🔵実行権限
- **役割**: MVP設計、コンセプト検証、プロダクトロードマップ
- **技術**: Lean Canvas、Jobs To Be Done、ユーザーストーリーマッピング

#### 3. ProductDesignAgent
**プロダクトデザインAgent**

- **ファイル**: `product-design-agent.md`
- **権限**: 🔵実行権限
- **役割**: UI/UX設計、プロトタイプ作成、デザインシステム構築
- **技術**: Figma API、Material Design、Atomic Design

#### 4. FunnelDesignAgent
**ファネルデザインAgent**

- **ファイル**: `funnel-design-agent.md`
- **権限**: 🔵実行権限
- **役割**: カスタマージャーニー設計、コンバージョンファネル最適化
- **技術**: AARRR Metrics、Growth Hacking

#### 5. PersonaAgent
**ペルソナ設計Agent**

- **ファイル**: `persona-agent.md`
- **権限**: 🟢分析権限
- **役割**: ターゲット顧客ペルソナ作成、ユーザーインサイト抽出
- **技術**: 定性調査、定量分析、ペルソナテンプレート

#### 6. SelfAnalysisAgent
**自己分析Agent**

- **ファイル**: `self-analysis-agent.md`
- **権限**: 🟢分析権限
- **役割**: 強み・弱み分析、キャリアプランニング
- **技術**: SWOT分析、ストレングスファインダー

### マーケティング系 (5個)

#### 7. MarketResearchAgent
**市場調査Agent**

- **ファイル**: `market-research-agent.md`
- **権限**: 🟢分析権限
- **役割**: 市場トレンド分析、競合分析、市場規模推定
- **技術**: Web Scraping、データ分析、トレンド予測

#### 8. MarketingAgent
**マーケティング戦略Agent**

- **ファイル**: `marketing-agent.md`
- **権限**: 🔵実行権限
- **役割**: マーケティング施策立案、KPI設定、効果測定
- **技術**: デジタルマーケティング、SEO/SEM、コンテンツマーケティング

#### 9. ContentCreationAgent
**コンテンツ作成Agent**

- **ファイル**: `content-creation-agent.md`
- **権限**: 🔵実行権限
- **役割**: ブログ記事、SNS投稿、プレスリリース自動生成
- **技術**: Claude Sonnet 4、SEOライティング、ストーリーテリング

#### 10. SNSStrategyAgent
**SNS戦略Agent**

- **ファイル**: `sns-strategy-agent.md`
- **権限**: 🔵実行権限
- **役割**: SNS投稿計画、エンゲージメント最適化
- **技術**: Twitter API、Instagram API、エンゲージメント分析

#### 11. YouTubeAgent
**YouTube戦略Agent**

- **ファイル**: `youtube-agent.md`
- **権限**: 🔵実行権限
- **役割**: 動画企画、台本作成、サムネイル最適化
- **技術**: YouTube Data API、動画分析、SEO最適化

### 営業・顧客管理系 (3個)

#### 12. SalesAgent
**セールス戦略Agent**

- **ファイル**: `sales-agent.md`
- **権限**: 🔵実行権限
- **役割**: 営業戦略立案、リード管理、成約率向上
- **技術**: SPIN Selling、Challenger Sale

#### 13. CRMAgent
**CRM管理Agent**

- **ファイル**: `crm-agent.md`
- **権限**: 🔵実行権限
- **役割**: 顧客データ管理、LTV最大化、リテンション施策
- **技術**: Salesforce API、HubSpot API、顧客セグメンテーション

#### 14. AnalyticsAgent
**分析・レポートAgent**

- **ファイル**: `analytics-agent.md`
- **権限**: 🟢分析権限
- **役割**: データ分析、レポート生成、意思決定支援
- **技術**: Google Analytics API、データビジュアライゼーション

## 権限レベル

| レベル | マーク | 説明 | 該当Agent |
|--------|--------|------|-----------|
| 統括権限 | 🔴 | ビジネス戦略全体を統括し、経営判断をサポート | AIEntrepreneur |
| 実行権限 | 🔵 | 具体的な施策実行・コンテンツ生成を実行可能 | ProductDesign, Marketing, Content, SNS, YouTube, Sales, CRM |
| 分析権限 | 🟢 | 市場・顧客・データ分析を実行可能 | MarketResearch, Persona, SelfAnalysis, Analytics |

## ビジネスAgent実行フロー

```
┌─────────────────────────────────────────────────────────┐
│ 1. AIEntrepreneurAgent: ビジネスプラン作成（8フェーズ）   │
│    - 市場分析 → 競合分析 → 顧客分析 → 価値提案           │
│    - 収益モデル → マーケティング → チーム → 資金調達     │
└──────────────┬──────────────────────────────────────────┘
               │
        ┌──────┼──────┬──────┬──────┐
        │      │      │      │      │
        ▼      ▼      ▼      ▼      ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ Product │ │ Market  │ │ Sales   │
  │ Design  │ │ Research│ │ Strategy│
  └────┬────┘ └────┬────┘ └────┬────┘
       │           │           │
       └───────────┼───────────┘
                   │
                   ▼
           ┌───────────────┐
           │ Content       │
           │ Creation      │
           └───────────────┘
```

## カテゴリー別Agent

### 🎯 戦略・企画
- AIEntrepreneurAgent
- ProductConceptAgent
- ProductDesignAgent
- FunnelDesignAgent
- PersonaAgent
- SelfAnalysisAgent

### 📢 マーケティング
- MarketResearchAgent
- MarketingAgent
- ContentCreationAgent
- SNSStrategyAgent
- YouTubeAgent

### 💼 営業・顧客管理
- SalesAgent
- CRMAgent
- AnalyticsAgent

## 実行コマンド例

```bash
# AIアントレプレナーAgent実行
npm run agents:entrepreneur -- --issue 2

# 特定フェーズのみ実行
npm run agents:entrepreneur -- --issue 2 --phase market-analysis

# 複数ビジネスAgent並行実行
npm run agents:parallel:exec -- --issues=2,3,4 --concurrency=2 --agent-category=business
```

## 関連ドキュメント

- **実行プロンプト**: [../../prompts/business/](../../prompts/business/)（将来追加予定）
- **ビジネスモデル**: [../../../../docs/SAAS_BUSINESS_MODEL.md](../../../../docs/SAAS_BUSINESS_MODEL.md)
- **市場分析**: [../../../../docs/MARKET_ANALYSIS_2025.md](../../../../docs/MARKET_ANALYSIS_2025.md)

---

🤖 Business Agent Specifications - Strategy, Marketing & Sales Automation
