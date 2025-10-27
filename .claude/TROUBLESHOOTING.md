# 🔧 Troubleshooting Guide - Miyabi

Miyabiの使用中に発生する可能性のある問題と解決策をまとめたガイドです。

## 📋 目次

1. [環境設定の問題](#環境設定の問題)
2. [Agentの問題](#agentの問題)
3. [Gitの問題](#gitの問題)
4. [Webhookの問題](#webhookの問題)
5. [MCPサーバーの問題](#mcpサーバーの問題)
6. [ビルドの問題](#ビルドの問題)
7. [デプロイの問題](#デプロイの問題)

---

## 環境設定の問題

### ❌ `GITHUB_TOKEN is required`

**症状**:
```
Error: GITHUB_TOKEN is required for IssueAgent
```

**原因**: GitHub Personal Access Tokenが設定されていない

**解決策**:

1. `.env` ファイルを作成:
```bash
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
```

2. または環境変数を直接設定:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

3. トークンの作成方法:
   - GitHub Settings → Developer settings → Personal access tokens
   - 必要な権限: `repo`, `workflow`, `admin:org`, `project`

---

### ❌ `ANTHROPIC_API_KEY is required`

**症状**:
```
Error: ANTHROPIC_API_KEY is required for AI-driven code generation
```

**原因**: Anthropic API Keyが設定されていない（Claude AI使用時に必要）

**解決策**:

1. `.env` ファイルに追加:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-your_key_here" >> .env
```

2. APIキーの取得:
   - Anthropic Console (https://console.anthropic.com/)
   - API Keys → Create Key

---

### ❌ Node.js version mismatch

**症状**:
```
Error: This project requires Node.js 18 or higher
```

**原因**: Node.jsのバージョンが古い

**解決策**:

1. Node.jsのバージョン確認:
```bash
node --version
```

2. Node.js 18以上をインストール:
```bash
# nvm使用の場合
nvm install 18
nvm use 18

# または公式サイトからダウンロード
# https://nodejs.org/
```

---

## Agentの問題

### ❌ Agent not found

**症状**:
```
Error: AgentType 'FooAgent' not found
```

**原因**: 存在しないAgent名を指定している

**解決策**:

1. 利用可能なAgent一覧を確認:
```bash
cat .claude/agents/agent-name-mapping.json | jq
```

2. キャラクター名を使う（推奨）:
```
❌ "FooAgentでIssue処理"
✅ "しきるん で Issue #270 を処理"
```

3. 利用可能なAgent一覧:
   - 🔴 リーダー: しきるん, あきんどさん
   - 🟢 実行役: つくるん, かくちゃん, しらべるん, etc.
   - 🔵 分析役: みつけるん, めだまん, かぞえるん, etc.
   - 🟡 サポート役: まとめるん, はこぶん

**参照**: [AGENT_CHARACTERS.md](agents/AGENT_CHARACTERS.md)

---

### ❌ Agent execution timeout

**症状**:
```
Error: Agent execution timed out after 3600000ms
```

**原因**: Agentの処理が1時間（デフォルトタイムアウト）を超えた

**解決策**:

1. タイムアウト時間を延長:
```bash
npm run agents:parallel:exec -- --issues=270 --timeout=7200000  # 2時間
```

2. タスクを分割:
```bash
# 大きなIssueを複数の小さなIssueに分割
# Issue #270 → Issue #270-1, #270-2, #270-3
```

3. Dry runで事前確認:
```bash
npm run agents:parallel:exec -- --issues=270 --dry-run
```

---

### ❌ Agent escalation required

**症状**:
```
⚠️ Escalation Required: Critical security vulnerability detected
Escalation to: CISO
Severity: Sev.1-Critical
```

**原因**: Agentが自力で解決できない問題を検出（正常な動作）

**対応**:

1. エスカレーション内容を確認:
   - Critical脆弱性 → CISO
   - アーキテクチャ問題 → TechLead
   - ビジネス優先度 → PO
   - 本番デプロイ → CTO

2. 該当する人間の承認を得る

3. 承認後、Agentに指示:
```
"CISOの承認を得ました。Issue #270のCritical脆弱性を修正してください。"
```

---

## Gitの問題

### ❌ Git merge conflict

**症状**:
```
error: Your local changes to the following files would be overwritten by merge:
  src/foo.ts
Please commit your changes or stash them before you merge.
```

**原因**: ローカルの変更とリモートの変更が競合

**解決策**:

1. 変更をコミット:
```bash
git add .
git commit -m "feat: implement feature X"
```

2. または変更を一時退避:
```bash
git stash
git pull --rebase
git stash pop
```

3. コンフリクトを手動解決:
```bash
# コンフリクトマーカーを編集
vim src/foo.ts

# 解決後
git add src/foo.ts
git rebase --continue
```

---

### ❌ Worktree already exists

**症状**:
```
Error: Worktree '.worktrees/issue-270' already exists
```

**原因**: 前回のWorktreeが残っている

**解決策**:

1. Worktree一覧を確認:
```bash
git worktree list
```

2. 不要なWorktreeを削除:
```bash
git worktree remove .worktrees/issue-270
```

3. すべてのstaleなWorktreeをクリーンアップ:
```bash
git worktree prune
```

4. 強制削除（最終手段）:
```bash
rm -rf .worktrees/issue-270
git worktree prune
```

---

## Webhookの問題

### ❌ Webhook connection failed

**症状**:
```
Error: Failed to connect to webhook server at http://localhost:3000
```

**原因**: Webhook serverが起動していない

**解決策**:

1. Webhook serverを起動:
```bash
npm run webhook:server
```

2. または一時的にスキップ:
```bash
git commit --no-verify
```

3. **Fallback機構を有効化**（Issue #137で実装予定）:
```yaml
# .miyabi.yml
webhook:
  enabled: true
  fallback: true  # Webhook失敗時にGitHub Actionsで実行
```

---

### ❌ Webhook signature verification failed

**症状**:
```
Error: Invalid webhook signature
```

**原因**: Webhook秘密鍵が一致していない

**解決策**:

1. `.env` のWebhook秘密鍵を確認:
```bash
WEBHOOK_SECRET=your_secret_here
```

2. GitHub Settingsで秘密鍵を更新:
   - Settings → Webhooks → Edit → Secret

3. 秘密鍵を再生成:
```bash
openssl rand -base64 32
```

---

## MCPサーバーの問題

### ❌ MCP server timeout

**症状**:
```
Error: MCP server 'context-engineering' timed out after 30000ms
```

**原因**: MCPサーバーが起動していないか、応答が遅い

**解決策**:

1. MCPサーバーのヘルスチェック:
```bash
.claude/mcp-servers/health-check.sh
```

2. Context Engineering APIサーバーを起動:
```bash
cd external/context-engineering-mcp
uvicorn main:app --port 8888
```

3. MCPサーバーを無効化（一時的）:
```json
// .claude/mcp.json
{
  "mcpServers": {
    "context-engineering": {
      "disabled": true  // 無効化
    }
  }
}
```

---

### ❌ MCP server not found

**症状**:
```
Error: MCP server 'foo-mcp' not found in .claude/mcp.json
```

**原因**: 存在しないMCPサーバー名を指定

**解決策**:

1. 利用可能なMCPサーバーを確認:
```bash
cat .claude/mcp.json | jq '.mcpServers | keys'
```

2. 利用可能なMCPサーバー一覧:
   - `ide-integration` - VS Code/Jupyter統合
   - `github-enhanced` - GitHub Issue/PR管理
   - `project-context` - プロジェクトコンテキスト
   - `miyabi-integration` - Miyabi CLI統合
   - `context-engineering` - AIコンテキスト分析

---

## ビルドの問題

### ❌ TypeScript compilation errors

**症状**:
```
Error: TS2307: Cannot find module '@miyabi/coding-agents'
```

**原因**: TypeScript path aliasが解決できない

**解決策**:

1. `tsconfig.json` のpaths設定を確認:
```json
{
  "compilerOptions": {
    "paths": {
      "@miyabi/coding-agents/*": ["packages/coding-agents/src/*"]
    }
  }
}
```

2. node_modulesを再インストール:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

3. TypeScriptコンパイラキャッシュをクリア:
```bash
rm -rf tsconfig.tsbuildinfo
npx tsc --build --clean
npx tsc --build
```

---

### ❌ ESLint errors

**症状**:
```
Error: 'foo' is assigned a value but never used (no-unused-vars)
```

**原因**: ESLintルール違反

**解決策**:

1. 自動修正:
```bash
npm run lint:fix
```

2. または手動修正:
```bash
# 該当ファイルを編集
vim src/foo.ts
```

3. ルールを一時的に無効化（推奨しない）:
```typescript
// eslint-disable-next-line no-unused-vars
const foo = 123;
```

---

## デプロイの問題

### ❌ Firebase deploy failed

**症状**:
```
Error: HTTP Error: 403, The caller does not have permission
```

**原因**: Firebase認証情報が不足または無効

**解決策**:

1. Firebaseにログイン:
```bash
firebase login
```

2. プロジェクトを選択:
```bash
firebase use your-project-id
```

3. 権限を確認:
   - Firebase Console → Project Settings → Users and permissions
   - 必要な権限: Editor以上

---

### ❌ Health check failed after deployment

**症状**:
```
⚠️ Health check failed: HTTP 500
Rolling back deployment...
```

**原因**: デプロイ後のアプリケーションが正常に起動していない

**対応**:

1. **自動ロールバック**（DeploymentAgentが自動実行）
2. ログを確認:
```bash
firebase functions:log
```

3. ローカルで再現:
```bash
npm run build
npm start
curl http://localhost:5000/health
```

---

## 🆘 それでも解決しない場合

### サポートへの連絡

1. **GitHub Issue作成**:
   - https://github.com/ShunsukeHayashi/Miyabi/issues/new
   - テンプレート: Bug Report

2. **必要な情報**:
   - Miyabiバージョン: `npx miyabi --version`
   - Node.jsバージョン: `node --version`
   - OS: `uname -a` (Mac/Linux) または `systeminfo` (Windows)
   - エラーメッセージ全文
   - 再現手順

3. **Email**:
   - supernovasyun@gmail.com
   - 件名: [Miyabi Support] Your Issue

---

## 📚 関連ドキュメント

- [QUICK_START.md](QUICK_START.md) - クイックスタートガイド
- [README.md](README.md) - Claude Code統合ガイド
- [AGENT_OPERATIONS_MANUAL.md](../docs/AGENT_OPERATIONS_MANUAL.md) - Agent運用マニュアル
- [DEPLOYMENT.md](../DEPLOYMENT.md) - デプロイガイド

---

## 📞 コミュニティ

- **Discord**: https://discord.gg/miyabi (準備中)
- **GitHub Discussions**: https://github.com/ShunsukeHayashi/Miyabi/discussions

---

🌸 **Miyabi** - Beauty in Autonomous Development

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
