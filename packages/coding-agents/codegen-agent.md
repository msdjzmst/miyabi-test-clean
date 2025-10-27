---
description: AI駆動コード生成Agent（Claude Sonnet 4使用）
capabilities: ["code-generation", "test-generation", "documentation-generation", "typescript-strict"]
---

# CodeGenAgent

Claude Sonnet 4を使用してコードを自動生成するSpecialist Agent。TypeScript strict mode完全対応、テスト自動生成、ドキュメント生成を含む。

## Responsibilities
- **Code Generation**: 仕様からTypeScript/JavaScriptコード生成
- **Test Generation**: Vitest/Jest ユニットテスト自動生成（並列）
- **Documentation**: README/APIドキュメント生成（Streaming）
- **Type Safety**: TypeScript strict mode完全対応
- **Code Validation**: 構文チェック、Lint、セキュリティスキャン

## When to Use
- `type:feature` のIssue
- `type:bug` のIssue（修正コード生成）
- `type:refactor` のIssue
- `type:test` のIssue（テストのみ生成）

## Claude API Integration
**Model**: `claude-sonnet-4-20250514`

**Standard API** (Code generation):
- Max tokens: 8,000
- Retry: 3回、指数バックオフ（2秒〜8秒）

**Streaming API** (Tests & Docs):
- Max tokens: 4,000 (tests), 3,000 (docs)
- TTFB: 2-3倍高速化
- Parallel test generation: 3倍高速化

## Prompt Structure
7セクション構造で曖昧性排除:
```
## Task
## Requirements
## Existing Codebase Context
## Architecture
## Constraints
## Instructions
## Output Format
```

## Code Parsing
正規表現パース（決められたフォーマットのみ受け入れ）:
```typescript
/```typescript
// FILE: path/to/file.ts

[code here]
```/
```

## Validation Rules
- ファイルが空でない
- import/export文が存在
- TODO/FIXMEコメント警告
- TypeScript構文チェック

## Performance Optimizations
- **Parallel test generation**: 3ファイル×20秒 = 60秒 → max(20秒) = 20秒
- **Streaming API**: TTFB 2-3倍高速化
- **LRU cache**: 既存ファイル読み込み高速化

## Success Criteria
- TypeScript compilation success
- ESLint errors: 0
- Test coverage: ≥ 80%
- Files generated: ≥ 1

## Escalation Conditions
- TypeScript compile error（自動修正不能）
- Architecture整合性違反
- Security risk検出

## Output
- `GeneratedCode`: ファイルリスト + テスト + ドキュメント
- Metrics: 生成行数、テスト数、カバレッジ

## Example
```typescript
Input: "Add dark mode toggle to settings"
Output:
- src/components/Settings.tsx (120 lines)
- src/components/Settings.test.tsx (85 lines)
- docs/DARK_MODE.md (documentation)
Metrics: 205 lines, 5 tests, 87% coverage
```
