#!/bin/bash
# Autonomous Operations - Project Initialization Script
# プロジェクト初期化スクリプト
#
# Usage: ./scripts/init-project.sh

set -e

echo "🚀 Autonomous Operations - プロジェクト初期化"
echo "================================================"
echo ""

# 現在のディレクトリを確認
if [ ! -f "package.json" ]; then
  echo "❌ エラー: package.json が見つかりません。プロジェクトルートで実行してください。"
  exit 1
fi

# 既に初期化済みかチェック
if [ -f ".ai/.initialized" ]; then
  echo "⚠️  このプロジェクトは既に初期化されています。"
  read -p "再初期化しますか？ (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "初期化をキャンセルしました。"
    exit 0
  fi
fi

echo "📝 プロジェクト情報を入力してください"
echo "========================================"
echo ""

# プロジェクト名
read -p "プロジェクト名 (例: my-awesome-project): " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
  echo "❌ プロジェクト名は必須です。"
  exit 1
fi

# GitHubオーナー
read -p "GitHub オーナー名 (例: your-username): " GITHUB_OWNER
if [ -z "$GITHUB_OWNER" ]; then
  echo "❌ GitHubオーナー名は必須です。"
  exit 1
fi

# プロジェクト説明
read -p "プロジェクト説明 (任意): " PROJECT_DESC
if [ -z "$PROJECT_DESC" ]; then
  PROJECT_DESC="AI-driven autonomous development system"
fi

# デバイス識別子
DEVICE_DEFAULT=$(hostname)
read -p "デバイス識別子 (デフォルト: $DEVICE_DEFAULT): " DEVICE_IDENTIFIER
if [ -z "$DEVICE_IDENTIFIER" ]; then
  DEVICE_IDENTIFIER="$DEVICE_DEFAULT"
fi

echo ""
echo "🔧 設定を適用しています..."
echo "========================================"

# 1. package.json の置換
echo "📦 package.json を更新中..."
sed -i.bak "s/\"name\": \"autonomous-operations\"/\"name\": \"$PROJECT_NAME\"/g" package.json
sed -i.bak "s/\"description\": \".*\"/\"description\": \"$PROJECT_DESC\"/g" package.json
sed -i.bak "s|ShunsukeHayashi/Autonomous-Operations|$GITHUB_OWNER/$PROJECT_NAME|g" package.json
rm -f package.json.bak

# 2. README.md の置換
echo "📄 README.md を更新中..."
if [ -f "README.md" ]; then
  sed -i.bak "s/Autonomous-Operations/$PROJECT_NAME/g" README.md
  sed -i.bak "s/ShunsukeHayashi/$GITHUB_OWNER/g" README.md
  rm -f README.md.bak
fi

# 3. .env ファイル生成
echo "🔐 .env ファイルを生成中..."
if [ -f ".env" ]; then
  echo "⚠️  .env ファイルが既に存在します。バックアップを作成します。"
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

cat > .env << EOF
# Autonomous Operations - Environment Variables
# Generated: $(date)

# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
REPOSITORY=$GITHUB_OWNER/$PROJECT_NAME

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Device Identifier
DEVICE_IDENTIFIER=$DEVICE_IDENTIFIER

# Optional: Firebase Configuration (for deployment)
# FIREBASE_PROJECT_ID=your-firebase-project-id
# FIREBASE_TOKEN=your-firebase-token

# Optional: Logging Level
LOG_LEVEL=info
EOF

echo "✅ .env ファイルを作成しました"

# 4. .claude/settings.local.json 生成
echo "⚙️  Claude Code 設定を生成中..."
mkdir -p .claude

if [ ! -f ".claude/settings.local.json" ]; then
  cat > .claude/settings.local.json << EOF
{
  "projectContext": "$PROJECT_NAME - $PROJECT_DESC",
  "workingDirectory": "$(pwd)",
  "preferredStyle": {
    "language": "TypeScript",
    "typeMode": "strict",
    "commitMessage": "conventional",
    "documentation": "JSDoc",
    "testing": "Vitest"
  },
  "env": {
    "DEVICE_IDENTIFIER": "$DEVICE_IDENTIFIER"
  }
}
EOF
  echo "✅ .claude/settings.local.json を作成しました"
else
  echo "⚠️  .claude/settings.local.json は既に存在します。スキップしました。"
fi

# 5. ディレクトリ構造作成
echo "📁 必要なディレクトリを作成中..."
mkdir -p .ai/logs
mkdir -p .ai/parallel-reports
mkdir -p .ai/issues

touch .ai/logs/.gitkeep
touch .ai/parallel-reports/.gitkeep
touch .ai/issues/.gitkeep

# 初期化完了マーカー
touch .ai/.initialized

echo ""
echo "🔑 API Keysを設定してください"
echo "========================================"
echo ""
echo "以下のAPIキーが必要です："
echo ""
echo "1. GitHub Personal Access Token (classic)"
echo "   - https://github.com/settings/tokens で作成"
echo "   - 必要なスコープ: repo, workflow, read:org"
echo ""
echo "2. Anthropic API Key"
echo "   - https://console.anthropic.com/settings/keys で作成"
echo "   - Claude Sonnet 4 モデルへのアクセスが必要"
echo ""
read -p "今すぐAPIキーを入力しますか？ (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  read -p "GitHub Token (ghp_...): " GITHUB_TOKEN_INPUT
  read -sp "Anthropic API Key (sk-ant-...): " ANTHROPIC_API_KEY_INPUT
  echo ""

  if [ -n "$GITHUB_TOKEN_INPUT" ]; then
    sed -i.bak "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$GITHUB_TOKEN_INPUT/g" .env
    rm -f .env.bak
    echo "✅ GitHub Tokenを設定しました"
  fi

  if [ -n "$ANTHROPIC_API_KEY_INPUT" ]; then
    sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY_INPUT/g" .env
    rm -f .env.bak
    echo "✅ Anthropic API Keyを設定しました"
  fi
else
  echo "⚠️  後で .env ファイルを手動で編集してAPIキーを設定してください。"
fi

echo ""
echo "📦 依存関係をインストール中..."
echo "========================================"

if command -v npm &> /dev/null; then
  npm install
  echo "✅ 依存関係をインストールしました"
else
  echo "⚠️  npm が見つかりません。手動で 'npm install' を実行してください。"
fi

echo ""
echo "🧪 動作確認を実行中..."
echo "========================================"

# TypeScriptコンパイルチェック
if npm run typecheck > /dev/null 2>&1; then
  echo "✅ TypeScript: エラーなし"
else
  echo "⚠️  TypeScript: エラーがあります (後で確認してください)"
fi

# テスト実行
if npm test -- --run > /dev/null 2>&1; then
  echo "✅ Tests: 合格"
else
  echo "⚠️  Tests: 一部失敗 (後で確認してください)"
fi

echo ""
echo "🎉 初期化完了！"
echo "========================================"
echo ""
echo "次のステップ："
echo ""
echo "1. APIキーの設定確認:"
echo "   vim .env"
echo ""
echo "2. GitHub Secretsの設定 (GitHub Actions用):"
echo "   - Repository Settings → Secrets and variables → Actions"
echo "   - ANTHROPIC_API_KEY を追加"
echo "   - GITHUB_TOKEN は自動で利用可能"
echo ""
echo "3. 動作確認:"
echo "   npm run verify"
echo ""
echo "4. 初回Agent実行 (Claude Code内で):"
echo "   /agent-run --help"
echo ""
echo "5. ドキュメントを確認:"
echo "   - GETTING_STARTED.md (初心者向けガイド)"
echo "   - docs/AGENT_OPERATIONS_MANUAL.md (運用マニュアル)"
echo "   - QUICKSTART.md (5分クイックスタート)"
echo ""
echo "📚 詳細は GETTING_STARTED.md をご覧ください。"
echo ""
echo "🤖 Generated with Claude Code"
