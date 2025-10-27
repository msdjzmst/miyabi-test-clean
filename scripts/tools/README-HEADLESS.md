# Claude Code Headless Mode

ヘッドレスモードでClaude Codeを実行するためのスクリプトとサンプルコードです。

## クイックスタート

### 1. 環境変数の設定

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 2. ヘルプを表示

```bash
npm run claude-headless:help
```

### 3. 簡単なプロンプトを実行

```bash
npm run claude-headless -- "このプロジェクトについて教えて"
```

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `claude-headless.ts` | メインスクリプト（CLI + プログラマティックAPI） |
| `claude-headless-example.ts` | 5つの実行例を含むサンプルコード |
| `../../docs/CLAUDE_HEADLESS_MODE.md` | 詳細ドキュメント |

## 使用例

### CLI経由

```bash
# 基本的な使用
npm run claude-headless -- "プロンプト"

# MCPツールを使用
npm run claude-headless -- "プロンプト" --mcp-servers github-enhanced

# 詳細ログを表示
npm run claude-headless -- "プロンプト" --verbose
```

### TypeScriptから使用

```typescript
import { ClaudeHeadless } from './scripts/tools/claude-headless.js';

const client = new ClaudeHeadless();
try {
  const result = await client.execute({
    prompt: 'プロンプト',
    enableMCP: true,
    verbose: true,
  });
  console.log(result);
} finally {
  await client.close();
}
```

### サンプルコードの実行

```bash
# 利用可能な例を表示
tsx scripts/tools/claude-headless-example.ts

# 例1を実行
tsx scripts/tools/claude-headless-example.ts 1

# 例2を実行（MCP使用）
tsx scripts/tools/claude-headless-example.ts 2
```

## 主な機能

- ✅ Anthropic API直接統合
- ✅ MCP (Model Context Protocol) サーバー統合
- ✅ 環境変数からのオーストークン取得
- ✅ プログラマティックAPI（TypeScriptから呼び出し可能）
- ✅ 詳細ログオプション
- ✅ カスタムシステムプロンプト
- ✅ 並列実行サポート

## サポートされるオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--model` | モデル名 | `claude-sonnet-4-20250514` |
| `--max-tokens` | 最大トークン数 | `4096` |
| `--temperature` | 温度パラメータ | `1.0` |
| `--no-mcp` | MCPツールを無効化 | - |
| `--mcp-servers` | 使用するMCPサーバー（カンマ区切り） | 全サーバー |
| `--system` | システムプロンプト | - |
| `--verbose, -v` | 詳細ログを表示 | - |
| `--help, -h` | ヘルプを表示 | - |

## トラブルシューティング

### APIキーエラー

```
Error: ANTHROPIC_API_KEY環境変数が設定されていません
```

**解決方法**: 環境変数を設定してください。

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### MCP接続エラー

```
❌ 接続失敗: github-enhanced
```

**解決方法**:
1. `.claude/mcp.json`を確認
2. 必要な環境変数を設定（例: `GITHUB_TOKEN`）
3. MCPサーバースクリプトが存在するか確認

## 詳細ドキュメント

より詳しい情報は、以下のドキュメントを参照してください：

- [CLAUDE_HEADLESS_MODE.md](../../docs/CLAUDE_HEADLESS_MODE.md) - 完全なドキュメント

## ライセンス

Apache-2.0
