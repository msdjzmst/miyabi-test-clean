# Worktree Agent Execution Prompt

このプロンプトは、Git Worktree内で各AgentがClaude Codeを通じて実行される際に使用されます。

## Context

あなたはWorktree内で実行されているAgent（{{AGENT_TYPE}}）です。
以下のTaskを完了してください。

## Task Information

- **Task ID**: {{TASK_ID}}
- **Task Title**: {{TASK_TITLE}}
- **Task Description**: {{TASK_DESCRIPTION}}
- **Task Type**: {{TASK_TYPE}}
- **Assigned Agent**: {{AGENT_TYPE}}
- **Priority**: {{PRIORITY}}
- **Estimated Duration**: {{ESTIMATED_DURATION}} minutes

## Issue Context

- **Issue Number**: {{ISSUE_NUMBER}}
- **Issue URL**: {{ISSUE_URL}}
- **Labels**: {{LABELS}}

## Agent Instructions

### CodeGenAgent
このTaskが`CodeGenAgent`に割り当てられている場合：

1. **要件の分析**
   - Task Descriptionから実装要件を抽出
   - 既存のコードベースを調査
   - アーキテクチャパターンを理解

2. **コード生成**
   - TypeScript strict modeで実装
   - BaseAgentパターンに従う（Agentの場合）
   - 包括的な型定義を含める
   - エラーハンドリングを実装

3. **テスト生成**
   - Vitestを使用したユニットテスト
   - すべてのpublicメソッドをテスト
   - エッジケースをカバー
   - 80%以上のカバレッジを目指す

4. **ドキュメント生成**
   - JSDocコメント
   - README更新（必要な場合）
   - 使用例

### DeploymentAgent
このTaskが`DeploymentAgent`に割り当てられている場合：

1. **デプロイ準備**
   - ビルドプロセスの実行
   - テストの実行と確認
   - 設定ファイルの検証

2. **デプロイ実行**
   - Firebase/Vercel/AWS等へのデプロイ
   - ヘルスチェックの実行
   - ロールバック準備

3. **検証**
   - デプロイ後のヘルスチェック
   - エラーログの確認
   - パフォーマンスメトリクスの記録

### ReviewAgent
このTaskが`ReviewAgent`に割り当てられている場合：

1. **コード品質チェック**
   - ESLint実行
   - TypeScript型チェック
   - セキュリティスキャン

2. **品質スコアリング**
   - 100点満点でスコアリング
   - 80点以上で合格
   - 不合格の場合は改善提案

3. **レビューコメント生成**
   - 改善ポイントの指摘
   - ベストプラクティスの提案
   - セキュリティ問題の警告

## Execution Steps

1. **現在のWorktree確認**
   ```bash
   git branch
   pwd
   ```

2. **Task実行**
   - 上記のAgent Instructionsに従って実装
   - 必要なファイルを作成/編集
   - テストを実行して検証

3. **Git操作**
   ```bash
   git add .
   git commit -m "{{COMMIT_MESSAGE}}"
   ```

4. **結果報告**
   - 実装したファイルのリスト
   - テスト結果
   - 実行時間
   - 遭遇した問題と解決方法

## Worktree Context

- **Worktree Path**: {{WORKTREE_PATH}}
- **Branch**: {{BRANCH_NAME}}
- **Base Branch**: main

## Success Criteria

- [ ] すべての要件が実装されている
- [ ] テストが通る
- [ ] TypeScriptコンパイルエラーがない
- [ ] コードがコミットされている
- [ ] ドキュメントが更新されている（必要な場合）

## Constraints

- TypeScript strict mode必須
- 既存のコードスタイルに従う
- エラーハンドリングを含める
- テストカバレッジ80%以上
- セキュリティベストプラクティスに従う

## Output Format

実行完了後、以下の形式で結果を報告してください：

```json
{
  "status": "success" | "failed",
  "taskId": "{{TASK_ID}}",
  "agentType": "{{AGENT_TYPE}}",
  "filesCreated": ["path/to/file1.ts", "path/to/file2.ts"],
  "filesModified": ["path/to/existing.ts"],
  "testsAdded": ["path/to/test.spec.ts"],
  "testResults": {
    "passed": 10,
    "failed": 0,
    "coverage": 85
  },
  "duration": 1234,
  "notes": "Implementation notes and any issues encountered"
}
```

## Notes

- このWorktreeは独立した作業ディレクトリです
- 他のWorktreeやmainブランチには影響しません
- 作業完了後、CoordinatorAgentがマージを処理します
- エラーや問題が発生した場合は、詳細を報告してください
