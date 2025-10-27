# Miyabi CLI - Claude Code Context

**🤖 IMPORTANT: This tool is designed for AI coding agents (Claude Code)**
**Human users should NOT see this file. Refer to README.md instead.**

---

## AI Agent Quick Start (Claude Code)

### Critical Rules for AI Agents

1. **ALWAYS use `--json` flag** - Parse structured output, never scrape text
2. **ALWAYS use `--yes` flag** - Skip interactive prompts automatically
3. **ALWAYS check exit codes** - 0=success, 1-5=specific errors
4. **NEVER execute without GITHUB_TOKEN** - Set `export GITHUB_TOKEN=ghp_xxx` first

### Environment Setup (Required)

```bash
export GITHUB_TOKEN=ghp_xxx          # Required for all commands
export MIYABI_JSON=1                 # Force JSON output
export MIYABI_AUTO_YES=1             # Force non-interactive mode
export MIYABI_VERBOSE=1              # Enable verbose logging (optional)
```

### Exit Codes for AI Agents

```
0 = SUCCESS               - Command completed successfully
1 = GENERAL_ERROR         - Unknown error
2 = CONFIG_ERROR          - Missing GITHUB_TOKEN or invalid config
3 = VALIDATION_ERROR      - Invalid arguments, directory exists
4 = NETWORK_ERROR         - GitHub API unreachable
5 = AUTH_ERROR            - Authentication failed, invalid token
```

### AI Agent Command Patterns

#### Pattern 1: Check Project Status (FULLY IMPLEMENTED)

```bash
miyabi status --json
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "repository": { "owner": "user", "name": "repo", "url": "..." },
    "issues": {
      "total": 15,
      "byState": { "pending": 3, "analyzing": 2, "implementing": 4, ... }
    },
    "pullRequests": [...],
    "summary": { "totalOpen": 15, "activeAgents": 7, "blocked": 0 }
  },
  "timestamp": "2025-10-11T00:00:00Z"
}
```

**Decision tree for AI agents:**
- `data.issues.byState.pending > 0` → Run IssueAgent to analyze
- `data.issues.byState.implementing > 0` → Run ReviewAgent to check
- `data.summary.blocked > 0` → Alert human intervention needed

#### Pattern 2: Install Miyabi to Existing Project

```bash
cd /path/to/existing/project
miyabi install --json --yes --non-interactive
```

**AI agent should check:**
1. Exit code (0 = success)
2. Verify `.claude/` directory created: `ls -la .claude`
3. Verify status works: `miyabi status --json`

#### Pattern 3: Run Specific Agent

```bash
miyabi agent run codegen --issue=123 --json
```

**Available agents:**
- `coordinator` - Task decomposition
- `codegen` - Code generation (Claude Sonnet 4)
- `review` - Code quality (80+ score)
- `issue` - Issue analysis/labeling
- `pr` - Pull Request creation
- `deploy` - CI/CD deployment

#### Pattern 4: Autonomous Mode

```bash
miyabi auto --interval=10 --max-duration=60 --json
```

### Error Handling for AI Agents

```typescript
// Pseudo-code for AI agent error handling
const result = await exec('miyabi status --json');
const exitCode = result.exitCode;
const parsed = JSON.parse(result.stdout);

if (exitCode !== 0) {
  if (exitCode === 2) {
    // CONFIG_ERROR - Missing GITHUB_TOKEN
    await setGitHubToken();
    return retry();
  } else if (exitCode === 5) {
    // AUTH_ERROR - Invalid token
    throw new Error('GitHub authentication failed');
  }
}

if (!parsed.success) {
  console.error(`Error: ${parsed.error.code}`);
  console.error(`Message: ${parsed.error.message}`);
  console.error(`Suggestion: ${parsed.error.suggestion}`);

  if (parsed.error.recoverable) {
    // Apply suggestion and retry
  } else {
    // Fatal error, abort
    throw new Error(parsed.error.message);
  }
}
```

### Recommended Workflow for AI Agents

```bash
# Step 1: Set environment
export GITHUB_TOKEN=ghp_xxx
export MIYABI_JSON=1
export MIYABI_AUTO_YES=1

# Step 2: Check status
miyabi status --json > status.json
[ $? -ne 0 ] && exit $?

# Step 3: Parse and decide
PENDING=$(jq -r '.data.issues.byState.pending' status.json)

# Step 4: Execute agent if needed
if [ "$PENDING" -gt 0 ]; then
  miyabi agent run issue --json --yes
fi
```

### Current Implementation Status (v0.8.4)

- ✅ **miyabi status --json** - Fully implemented, production-ready
- ⚠️ **Other commands** - Accept --json flag, full implementation in Phase 2
- ✅ **Exit codes** - All commands return proper exit codes
- ✅ **Environment variables** - MIYABI_JSON, MIYABI_AUTO_YES supported

### For More Details

See [AI_AGENT_USAGE.md](./AI_AGENT_USAGE.md) for comprehensive AI agent documentation.

---

## プロジェクト概要

**Miyabi** - 一つのコマンドで全てが完結する自律型開発フレームワーク

このCLIツールは、組織設計原則(Organizational Design Principles)とAI Agentsを組み合わせた自律型開発環境を提供します。

## 主要コマンド

```bash
# 新規プロジェクト作成（全自動セットアップ）
npx miyabi init <project-name>

# 既存リポジトリにインストール
npx miyabi install

# プロジェクト状態確認
npx miyabi status [--watch]

# 設定管理
npx miyabi config [--get key] [--set key=value]

# セットアップ（既存プロジェクト用）
npx miyabi setup
```

## アーキテクチャ

### Agent System（7種類の自律エージェント）

1. **CoordinatorAgent** - タスク統括・並列実行制御
   - DAG（Directed Acyclic Graph）ベースのタスク分解
   - Critical Path特定と並列実行最適化

2. **IssueAgent** - Issue分析・ラベル管理
   - 組織設計原則65ラベル体系による自動分類
   - タスク複雑度推定（小/中/大/特大）

3. **CodeGenAgent** - AI駆動コード生成
   - Claude Sonnet 4による高品質コード生成
   - TypeScript strict mode完全対応

4. **ReviewAgent** - コード品質判定
   - 静的解析・セキュリティスキャン
   - 品質スコアリング（100点満点、80点以上で合格）

5. **PRAgent** - Pull Request自動作成
   - Conventional Commits準拠
   - Draft PR自動生成

6. **DeploymentAgent** - CI/CDデプロイ自動化
   - Firebase自動デプロイ・ヘルスチェック
   - 自動Rollback機能

7. **TestAgent** - テスト自動実行
   - Vitest実行・カバレッジレポート
   - 80%+カバレッジ目標

### GitHub OS Integration（15コンポーネント）

Miyabiは「GitHubをOSとして扱う」設計思想のもと、以下を統合：

1. **Issues** - タスク管理
2. **Actions** - CI/CD実行環境
3. **Projects V2** - カンバンボード
4. **Webhooks** - イベント駆動処理
5. **Pages** - ダッシュボード
6. **Packages** - NPMパッケージ配信
7. **Discussions** - コミュニティBot
8. **Releases** - 自動リリース
9. **Environments** - dev/staging/prod環境管理
10. **Security** - Dependabot, CodeQL
11. **Labels** - 組織設計原則65ラベル体系
12. **Milestones** - 進捗管理
13. **Pull Requests** - コードレビュー
14. **Wiki** - ドキュメント自動生成
15. **API Wrapper** - 統合APIクライアント

## ディレクトリ構造

```
packages/cli/
├── src/
│   ├── index.ts              # CLI エントリーポイント
│   ├── commands/             # コマンド実装
│   │   ├── init.ts          # 新規プロジェクト作成
│   │   ├── install.ts       # 既存プロジェクトにインストール
│   │   ├── status.ts        # 状態確認
│   │   ├── config.ts        # 設定管理
│   │   └── setup.ts         # セットアップ
│   ├── setup/               # セットアップモジュール
│   │   ├── labels.ts        # ラベル設定
│   │   ├── workflows.ts     # GitHub Actions展開
│   │   ├── projects.ts      # Projects V2作成
│   │   ├── repository.ts    # リポジトリ作成
│   │   ├── local.ts         # ローカルクローン
│   │   └── welcome.ts       # Welcome Issue作成
│   ├── auth/                # 認証
│   │   └── github-oauth.js  # GitHub Device Flow OAuth
│   ├── analyze/             # 分析
│   │   ├── project.ts       # プロジェクト情報取得
│   │   └── issues.ts        # Issue分析
│   └── config/              # 設定
│       └── loader.ts        # .miyabi.yml読み込み
├── templates/               # テンプレート
│   ├── labels.yml           # 53ラベル定義
│   └── workflows/           # 26 GitHub Actions
├── .claude/                 # Claude Code設定
│   └── commands/
│       └── setup-miyabi.md  # 初心者向け自動セットアップ
├── CLAUDE.md                # このファイル
└── package.json
```

## 開発ガイドライン

### TypeScript設定

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### ESM対応

```typescript
// __dirname の代替
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### セキュリティ

- **機密情報は環境変数で管理**: `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`
- **.miyabi.yml に機密情報を含めない**
- **Webhook検証**: HMAC-SHA256署名検証実装済み

### テスト

```bash
npm test                    # 全テスト実行
npm run test:watch          # Watch mode
npm run test:coverage       # カバレッジレポート
```

目標: 80%+ カバレッジ（statements, lines）

## 組織設計原則（Organizational Design Principles）5原則

Miyabiは株式会社組織設計の理論に基づいた自律型組織設計を実装：

1. **責任の明確化** - 各AgentがIssueに対する責任を負う
2. **権限の委譲** - Agentは自律的に判断・実行可能
3. **階層の設計** - CoordinatorAgent → 各専門Agent
4. **結果の評価** - 品質スコア、カバレッジ、実行時間で評価
5. **曖昧性の排除** - DAGによる依存関係明示、状態ラベルで進捗可視化

## 環境変数

```bash
# GitHub Personal Access Token（必須）
GITHUB_TOKEN=ghp_xxxxx

# Anthropic API Key（必須 - Agent実行時）
ANTHROPIC_API_KEY=sk-ant-xxxxx

# オプション
MIYABI_LOG_LEVEL=info
MIYABI_PARALLEL_AGENTS=3
```

## 使用例

### 新規プロジェクト作成（プログラミング初心者向け）

```bash
npx miyabi init my-awesome-app
```

これだけで以下が自動実行：
1. GitHub OAuth認証（Device Flow）
2. GitHubリポジトリ作成
3. 53ラベルセットアップ
4. 26 GitHub Actions展開
5. Projects V2作成
6. ローカルにクローン
7. 依存関係インストール
8. Welcome Issue作成

### 既存プロジェクトへのインストール

```bash
cd my-existing-project
npx miyabi install
```

### 状態監視（Watch mode）

```bash
npx miyabi status --watch
```

5秒ごとにリアルタイム更新でIssue状態を表示。

## ワークフロー

### Issue → PR → Merge の自動化

1. **Issue作成**: ユーザーまたはAgentが作成
2. **IssueAgent**: 自動ラベル分類、複雑度推定
3. **CoordinatorAgent**: DAG分解、並列実行プラン作成
4. **CodeGenAgent**: コード実装、テスト生成
5. **ReviewAgent**: 品質チェック（80点以上で次へ）
6. **TestAgent**: テスト実行（カバレッジ確認）
7. **PRAgent**: Draft PR作成
8. **DeploymentAgent**: マージ後に自動デプロイ

全工程が自律実行、人間の介入は最小限。

## パフォーマンス

- **並列実行効率**: 72%（Phase A → B/E並列化で36h → 26h）
- **Critical Path最適化**: DAGベース依存関係解析
- **レート制限対応**: Exponential backoff実装済み

## リリース情報

- **Current Version**: v0.3.3
- **License**: MIT
- **Repository**: https://github.com/ShunsukeHayashi/Autonomous-Operations
- **NPM**: https://www.npmjs.com/package/miyabi

## サポート

- **GitHub Issues**: https://github.com/ShunsukeHayashi/Autonomous-Operations/issues
- **Documentation**: SETUP_GUIDE.md, FOR_NON_PROGRAMMERS.md
- **Contact**: supernovasyun@gmail.com

## Claude Code統合

このファイル（CLAUDE.md）は、`npx miyabi` をClaude Code内で実行した際に**自動的に参照されます**。

### パッケージインストール時のコンテキスト読み込み

```bash
# Claude Code内で実行
npm install miyabi

# または
npx miyabi init my-project
```

実行すると、以下のファイルがClaude Codeから自動的にアクセス可能になります:

- `node_modules/miyabi/CLAUDE.md` - このファイル（Miyabi CLIのコンテキスト）
- `node_modules/miyabi/.claude/` - カスタムコマンド、Agent定義
- プロジェクト生成時: `./my-project/CLAUDE.md` - プロジェクト固有のコンテキスト
- プロジェクト生成時: `./my-project/.claude/` - プロジェクト用設定

### Claude Codeでの自動認識

Claude Codeは以下の順序でコンテキストを検索します:

1. **プロジェクトルート**: `./CLAUDE.md`, `./.claude/`
2. **node_modules**: `node_modules/miyabi/CLAUDE.md`
3. **パッケージ内テンプレート**: `node_modules/miyabi/templates/`

これにより、`npx miyabi` コマンド実行時に、Claude Codeが自動的にMiyabiの全機能を理解できます。

---

🌸 **Miyabi** - Beauty in Autonomous Development
