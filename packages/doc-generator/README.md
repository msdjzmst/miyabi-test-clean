# @agentic-os/doc-generator

> AI-Powered TypeScript Documentation Generator

TypeScriptコードを自動解析し、美しいMarkdownドキュメントを生成します。

## 特徴

- **TypeScript AST解析**: ts-morphを使用した高精度な型情報抽出
- **Handlebarsテンプレート**: カスタマイズ可能なドキュメント生成
- **CLI統合**: シンプルなコマンドラインインターフェース
- **JSDoc対応**: コメントから説明文を自動抽出
- **プログラマブルAPI**: Node.jsスクリプトから直接使用可能

## インストール

```bash
npm install @agentic-os/doc-generator
```

## クイックスタート

### CLI使用

```bash
# 基本的な使用方法
npx doc-gen analyze ./src

# 出力先を指定
npx doc-gen analyze ./src --output ./docs

# tsconfig.jsonを使用
npx doc-gen analyze ./src --tsconfig ./tsconfig.json

# ソースコードを含める
npx doc-gen analyze ./src --include-source

# JSON形式で出力
npx doc-gen analyze ./src --json
```

### プログラマティックAPI

```typescript
import { CodeAnalyzer, TemplateEngine } from '@agentic-os/doc-generator';

// 解析エンジンを初期化
const analyzer = new CodeAnalyzer('./tsconfig.json');
analyzer.addSource('./src');

// コードを解析
const result = analyzer.analyze();

// ドキュメントを生成
const templateEngine = new TemplateEngine();
const files = templateEngine.generate(result, {
  outputDir: './docs',
  includePrivate: false,
  includeSourceCode: true,
  title: 'My API Documentation',
});

console.log('Generated:', files);
```

## CLIコマンド

### `doc-gen analyze`

TypeScriptコードを解析してドキュメントを生成します。

```bash
doc-gen analyze <source> [options]
```

**引数:**
- `<source>`: 解析対象のディレクトリまたはファイル

**オプション:**
- `-o, --output <dir>`: 出力ディレクトリ (デフォルト: `./docs`)
- `-t, --tsconfig <path>`: tsconfig.jsonのパス
- `--template <dir>`: カスタムテンプレートディレクトリ
- `--title <title>`: ドキュメントタイトル (デフォルト: `API Documentation`)
- `--include-private`: プライベートメンバーを含める
- `--include-source`: ソースコードを含める
- `--json`: JSON形式で出力

### `doc-gen init`

カスタムテンプレートを初期化します。

```bash
doc-gen init [options]
```

**オプション:**
- `-o, --output <dir>`: テンプレート出力ディレクトリ (デフォルト: `./templates`)

## カスタムテンプレート

Handlebarsテンプレートを使用してドキュメントの外観をカスタマイズできます。

```bash
# テンプレートを初期化
npx doc-gen init --output ./my-templates

# カスタムテンプレートを使用
npx doc-gen analyze ./src --template ./my-templates
```

### 利用可能なヘルパー

- `{{formatParams parameters}}`: パラメータリストをフォーマット
- `{{codeBlock code "typescript"}}`: コードブロックを生成
- `{{inlineCode text}}`: インラインコードを生成
- `{{visibilityIcon visibility}}`: 可視性アイコン (🟢🟡🔴)
- `{{modifierBadges ...}}`: 修飾子バッジを生成
- `{{formatDate isoString}}`: 日付をフォーマット
- `{{isNotEmpty array}}`: 配列が空でないかチェック

## 出力例

生成されるドキュメント構造：

```
docs/
├── README.md          # インデックスページ
├── functions.md       # 関数一覧
├── classes.md         # クラス一覧
└── interfaces.md      # インターフェース一覧
```

## 技術スタック

- **ts-morph**: TypeScript AST解析
- **Handlebars**: テンプレートエンジン
- **Commander.js**: CLI フレームワーク
- **Chalk**: ターミナル装飾
- **Ora**: スピナー表示

## API リファレンス

### CodeAnalyzer

TypeScriptコードを解析するクラス。

```typescript
class CodeAnalyzer {
  constructor(tsConfigFilePath?: string)
  addSource(targetPath: string): void
  analyze(): AnalysisResult
  getProjectInfo(): { totalSourceFiles: number; rootDirectory: string }
}
```

### TemplateEngine

Markdownドキュメントを生成するクラス。

```typescript
class TemplateEngine {
  constructor(customTemplateDir?: string)
  generate(analysisResult: AnalysisResult, options: GenerationOptions): string[]
  registerTemplate(type: TemplateType, templateContent: string): void
}
```

## ライセンス

MIT

## 開発者

Agentic OS Team

## 関連リンク

- [GitHub](https://github.com/ShunsukeHayashi/Autonomous-Operations)
- [Issues](https://github.com/ShunsukeHayashi/Autonomous-Operations/issues)
