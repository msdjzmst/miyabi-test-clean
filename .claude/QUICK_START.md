# 🚀 3分で始めるMiyabi - Quick Start Guide

**Miyabi** は一つのコマンドで全てが完結する自律型開発フレームワークです。
このガイドでは、たった3分でMiyabiの基本操作を習得できます。

## 📋 前提条件

- Node.js 18以上
- GitHub アカウント
- GITHUB_TOKEN（Personal Access Token）

## ⏱️ 1分目: インストール（60秒）

### 既存プロジェクトに追加する場合

```bash
cd your-project
npx miyabi install
```

### 新規プロジェクトを作成する場合

```bash
npx miyabi init my-awesome-project
cd my-awesome-project
```

### 環境変数の設定

```bash
# .env ファイルを作成
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
echo "ANTHROPIC_API_KEY=sk-ant-your_key_here" >> .env
```

✅ **確認**: `npx miyabi status` を実行してインストールを確認

---

## ⏱️ 2分目: 最初のAgent実行（60秒）

Miyabiには21個のAgentがいて、それぞれに親しみやすい名前がついています。

### しきるん（CoordinatorAgent）でIssue分析

```bash
# Claude Code内で実行
/agent-run --issues=270

# または直接コマンドで
npm run agents:parallel:exec -- --issues=270
```

**しきるん** がIssueを分析して、タスクに分解してくれます。

### つくるん（CodeGenAgent）でコード生成

```bash
# Claude Code内で
"Issue #270 を実装して"
```

**つくるん** が高品質なTypeScriptコードを自動生成します。

### めだまん（ReviewAgent）で品質チェック

```bash
# Claude Code内で
/review
```

**めだまん** がコード品質を100点満点で評価します（80点以上で合格✅）。

---

## ⏱️ 3分目: よく使うコマンド（60秒）

### テスト実行

```bash
/test
```

プロジェクト全体のテストを実行します。

### デプロイ

```bash
# Staging環境
/deploy --staging

# Production環境（本番デプロイはCTOエスカレーション必要）
/deploy --production
```

### システム動作確認

```bash
/verify
```

TypeScript型チェック、テスト、Agent実行可能性をすべて確認します。

---

## 🎮 キャラクター図鑑 - 21人の仲間たち

Miyabiには21個のAgentがいて、4つの役割に分かれています。

### 🔴 リーダー（2キャラ）- 指示を出す

| キャラ | 技術名 | 役割 |
|--------|--------|------|
| **しきるん** | CoordinatorAgent | タスクを分解して指示を出す統括マネージャー |
| **あきんどさん** | AIEntrepreneurAgent | ビジネス戦略を立てる起業家 |

### 🟢 実行役（12キャラ）- 実際に作業する

| キャラ | 技術名 | 役割 |
|--------|--------|------|
| **つくるん** | CodeGenAgent | コードを書く開発者 |
| **かくちゃん** | ContentCreationAgent | コンテンツを作るクリエイター |
| **しらべるん** | MarketResearchAgent | 市場調査をするリサーチャー |
| **せっけいくん** | ProductConceptAgent | 商品企画をするプランナー |
| **くわしくん** | ProductDesignAgent | 詳細設計をするデザイナー |
| **じぶんちゃん** | SelfAnalysisAgent | 自己分析をするアナリスト |
| **つなぐん** | FunnelDesignAgent | 導線設計をする設計者 |
| **ぺるそなちゃん** | PersonaAgent | ペルソナ設計をするマーケター |
| **ひろめるん** | MarketingAgent | マーケティング施策を実行する広報 |
| **SNSくん** | SNSStrategyAgent | SNS戦略を立てるSNS担当 |
| **どうがちゃん** | YouTubeAgent | YouTube運用をする動画クリエイター |
| **うるん** | SalesAgent | 営業活動をするセールス |

### 🔵 分析役（5キャラ）- 調べる、考える

| キャラ | 技術名 | 役割 |
|--------|--------|------|
| **みつけるん** | IssueAgent | Issueを分析してラベルを付ける探偵 |
| **めだまん** | ReviewAgent | コード品質をチェックする品質管理 |
| **かぞえるん** | AnalyticsAgent | データ分析をするアナリスト |
| **おきゃくちゃん** | CRMAgent | 顧客管理をするCRM担当 |

### 🟡 サポート役（3キャラ）- 手伝う、つなぐ

| キャラ | 技術名 | 役割 |
|--------|--------|------|
| **まとめるん** | PRAgent | Pull Requestを作るアシスタント |
| **はこぶん** | DeploymentAgent | デプロイを実行する配達員 |

**詳細**: [AGENT_CHARACTERS.md](agents/AGENT_CHARACTERS.md) を参照

---

## 📚 チュートリアル

### Tutorial 1: しきるん でタスク分解

**目的**: 複雑なIssueを小さなタスクに分解する

```bash
# Claude Code内で実行
/agent-run --issues=270
```

**しきるん** が以下を実行します：
1. Issue #270の内容を読み取り
2. タスクに分解（例: Task A, B, C）
3. 依存関係を分析（DAG作成）
4. 並列実行可能なタスクを特定
5. 各タスクに適切なAgentを割り当て

**出力例**:
```
📋 Task Decomposition Complete
├── Task A: 型定義作成 → つくるん（CodeGenAgent）
├── Task B: テスト作成 → つくるん（CodeGenAgent）
└── Task C: ドキュメント作成 → かくちゃん（ContentCreationAgent）

⚡ Parallel Execution Plan:
- Group 1: Task A, B (並列実行可能)
- Group 2: Task C (A, B完了後)

⏱️ Estimated Time: 2.5 hours
```

---

### Tutorial 2: つくるん でコード生成

**目的**: AIを使って高品質なコードを自動生成する

```bash
# Claude Code内で
"Issue #270のTask Aを実装して。TypeScript strict modeでお願い。"
```

**つくるん** が以下を実行します：
1. Task Aの要件を理解
2. TypeScript strict mode準拠のコード生成
3. ユニットテストの自動生成
4. JSDocコメントの追加
5. コミット（Conventional Commits準拠）

**生成されるファイル例**:
```
src/
├── types/foo.ts          # 型定義
├── lib/foo-service.ts    # 実装
tests/
└── lib/foo-service.test.ts  # テスト
```

---

### Tutorial 3: めだまん で品質チェック

**目的**: コード品質を客観的に評価する

```bash
# Claude Code内で
/review
```

**めだまん** が以下をチェックします：
1. ESLint - コーディング規約違反
2. TypeScript - 型エラー
3. セキュリティスキャン - 脆弱性検出
4. 品質スコアリング（100点満点）

**評価基準**:
```
基準点: 100点
- ESLintエラー: -20点/件
- TypeScriptエラー: -30点/件
- Critical脆弱性: -40点/件
- High脆弱性: -20点/件

✅ 80点以上: 合格
⚠️ 60-79点: 要改善
❌ 60点未満: 不合格（エスカレーション）
```

**出力例**:
```
🎯 Quality Score: 85/100 ✅

📊 Issues Found:
- ESLint: 1 warning (unused variable)
- TypeScript: 0 errors
- Security: 0 vulnerabilities

✅ Review PASSED - Ready for merge
```

---

### Tutorial 4: はこぶん でデプロイ

**目的**: Staging/Production環境に自動デプロイ

```bash
# Staging環境へデプロイ
/deploy --staging
```

**はこぶん** が以下を実行します：
1. ビルド（`npm run build`）
2. テスト実行（`npm test`）
3. Firebase/Vercelへデプロイ
4. ヘルスチェック
5. デプロイ成功/失敗の通知
6. 失敗時は自動ロールバック

**Production環境へのデプロイ**:
```bash
# Production環境（CTOエスカレーション必要）
/deploy --production
```

Production環境へのデプロイは**CTO承認が必要**です（Sev.1-Criticalエスカレーション）。

---

## 🔄 並列実行のルール

Agentを複数同時に実行する際のルールです。

### ✅ 同時実行OK

- 🟢 実行役 + 🟢 実行役: `つくるん` + `かくちゃん`
- 🟢 実行役 + 🔵 分析役: `つくるん` + `みつけるん`
- 🔵 分析役 + 🔵 分析役: `めだまん` + `かぞえるん`

**例**:
```bash
# つくるん と かくちゃん を並列実行
npm run agents:parallel:exec -- --issues=270,271 --concurrency=2
```

### ❌ 同時実行NG

- 🔴 リーダー + 🔴 リーダー: `しきるん` + `あきんどさん`

**理由**: 両方とも全体を統括するため、競合が発生します。

### ⚠️ 条件付き実行

- 🟡 サポート役: 他のAgentの完了後に実行

**例**: `つくるん`（コード生成）→ `めだまん`（品質チェック）→ `まとめるん`（PR作成）

---

## 💡 Tips & Tricks

### 1. Dry Runで事前確認

```bash
npm run agents:parallel:exec -- --issues=270 --dry-run
```

実際には実行せず、実行プランだけを確認できます。

### 2. Watch Modeでリアルタイム監視

```bash
npx miyabi status --watch
```

5秒ごとにIssueの状態を自動更新して表示します。

### 3. JSON出力でスクリプト化

```bash
npx miyabi status --json > status.json
cat status.json | jq '.data.issues.byState'
```

JSON形式で出力できるため、シェルスクリプトやCIと統合しやすいです。

### 4. キャラクター名で呼び出す

```bash
# 技術名で呼び出す（従来）
"CoordinatorAgentでIssue #270を処理"

# キャラクター名で呼び出す（推奨）
"しきるん で Issue #270 を処理して"
```

キャラクター名の方が親しみやすく、覚えやすいです。

---

## 🔗 次のステップ

### 📖 詳細ドキュメント

- [AGENT_OPERATIONS_MANUAL.md](../docs/AGENT_OPERATIONS_MANUAL.md) - Agent完全運用マニュアル
- [LABEL_SYSTEM_GUIDE.md](../docs/LABEL_SYSTEM_GUIDE.md) - 53ラベル体系ガイド
- [ENTITY_RELATION_MODEL.md](../docs/ENTITY_RELATION_MODEL.md) - システム全体のEntity-Relationモデル

### 🛠️ トラブルシューティング

何か問題が発生したら、[TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照してください。

### 🎯 高度な使い方

- [Worktree並列実行](../CLAUDE.md#git-worktree並列実行アーキテクチャ)
- [MCP Server統合](README.md#-mcp-servers)
- [Hooks設定](README.md#-hooks設定)

---

## 📞 サポート

質問や問題がある場合：
- **GitHub Issues**: https://github.com/ShunsukeHayashi/Miyabi/issues
- **Email**: supernovasyun@gmail.com

---

🌸 **Miyabi** - Beauty in Autonomous Development

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
