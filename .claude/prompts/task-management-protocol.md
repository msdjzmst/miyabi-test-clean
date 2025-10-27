# タスク管理プロトコル - 構造化Todo管理

## 概要

このプロトコルは、Claude Codeセッション中のタスク管理を構造化し、進捗を可視化するためのルールです。

## 基本原則

### 1. タスク開始時の自動Todo作成

ユーザーからタスクを受け取った際、以下の条件でTodoListを作成：

**Todoを作成する条件:**
- ✅ 複数ステップが必要なタスク（3ステップ以上）
- ✅ 複雑なタスク（実装 + テスト + ドキュメント等）
- ✅ ユーザーが複数のタスクをリスト形式で提供
- ✅ 明示的にTodo管理を依頼された場合

**Todoを作成しない条件:**
- ❌ 単純な1ステップタスク
- ❌ 純粋な質問・情報提供
- ❌ 即座に完了できる軽微なタスク

### 2. Todo構造定義

```typescript
interface Todo {
  content: string;        // タスク内容（簡潔に、絵文字付き）
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;     // 進行中表示用（現在進行形）
}
```

**命名規則:**
- `content`: 「【カテゴリ】タスク内容 - 詳細」形式
- `activeForm`: 「【実施中 - カテゴリ】進行状況を示す文」形式
- 絵文字を適切に使用（🔧 🧪 📊 🚀 ✅等）

**例:**
```json
{
  "content": "【Phase 1】型安全性の向上 - toolCreatorのany型を解消してcircular dependency回避",
  "status": "completed",
  "activeForm": "【完了 - Phase 1】IToolCreator interface作成完了✅"
}
```

### 3. ステータス遷移ルール

```
pending → in_progress → completed
```

**遷移タイミング:**
- `pending → in_progress`: タスク実装を開始する**直前**
- `in_progress → completed`: タスクが**完全に完了**した直後

**重要:**
- 同時にin_progressは**1つのみ**
- 完了したタスクは即座にcompletedに変更（バッチ処理禁止）
- エラー・ブロックされた場合はin_progressのまま維持

### 4. 進捗更新頻度

**更新タイミング:**
1. タスク開始時（pending → in_progress）
2. サブタスク完了時（完了報告）
3. メインタスク完了時（in_progress → completed）
4. 新規タスク発見時（追加）
5. 不要タスク判明時（削除）

**更新例:**
```typescript
// タスク開始時
TodoWrite([
  { content: "TypeScript型チェック実行", status: "in_progress", activeForm: "型チェック実行中..." },
  { content: "テスト作成", status: "pending", activeForm: "テスト作成準備中" }
]);

// 完了時（即座に更新）
TodoWrite([
  { content: "TypeScript型チェック実行", status: "completed", activeForm: "型チェック完了✅" },
  { content: "テスト作成", status: "in_progress", activeForm: "テスト作成中..." }
]);
```

## 実装パターン

### パターン1: フェーズ型タスク（Phase 1-N）

**使用例:** 大規模な改善提案、複数フェーズのプロジェクト

**TodoWrite形式 (JSON):**
```typescript
[
  {
    content: "【Phase 1】型安全性の向上 - IToolCreator interface作成",
    status: "completed",
    activeForm: "【完了 - Phase 1】IToolCreator interface作成完了✅"
  },
  {
    content: "【Phase 2】エラーハンドリング強化 - 5種類のエラークラス実装",
    status: "in_progress",
    activeForm: "【実装中 - Phase 2】5種類のエラークラス + Exponential Backoff実装中"
  },
  {
    content: "【Phase 3】キャッシュ最適化 - TTLCache実装",
    status: "pending",
    activeForm: "【待機中 - Phase 3】TTLCache + LRU eviction実装準備"
  }
]
```

**視覚的表現 (Markdown):**
```markdown
# [Issue #XXX] 大規模な改善提案
> TypeScript型安全性の向上とエラーハンドリング強化

## Phase 1: 型安全性の向上
- [x] IToolCreator interface作成

## Phase 2: エラーハンドリング強化
- [ ] 5種類のエラークラス実装
- [ ] Exponential Backoff実装

## Phase 3: キャッシュ最適化
- [ ] TTLCache実装
- [ ] LRU eviction実装
```

### パターン2: 機能追加型タスク

**使用例:** 新機能追加、統合作業

**TodoWrite形式 (JSON):**
```typescript
[
  {
    content: "【実装】WebSocketサーバー作成 - port 8080で待ち受け",
    status: "completed",
    activeForm: "【完了】WebSocketサーバー作成完了 (428行)✅"
  },
  {
    content: "【実装】WebSocketクライアントフック - useAgentWebSocket",
    status: "in_progress",
    activeForm: "【実装中】useAgentWebSocket.ts作成中 - 自動再接続機能実装"
  },
  {
    content: "【統合】ImprovementsPanelにUI統合 - 4つのアクションボタン",
    status: "pending",
    activeForm: "【待機中】ImprovementsPanel統合準備"
  },
  {
    content: "【テスト】WebSocket通信テスト実行",
    status: "pending",
    activeForm: "【待機中】WebSocket通信テスト準備"
  }
]
```

**視覚的表現 (Markdown):**
```markdown
# [Issue #YYY] WebSocket統合機能の追加
> リアルタイム通信機能を実装してUIに統合

## 実装
- [x] WebSocketサーバー作成 (port 8080で待ち受け)
- [ ] WebSocketクライアントフック (useAgentWebSocket)

## 統合
- [ ] ImprovementsPanelにUI統合 (4つのアクションボタン)

## テスト
- [ ] WebSocket通信テスト実行
```

### パターン3: バグ修正型タスク

**使用例:** バグ修正、エラー対応

**TodoWrite形式 (JSON):**
```typescript
[
  {
    content: "【調査】エラー原因特定 - ツール作成失敗の原因調査",
    status: "completed",
    activeForm: "【完了】原因特定: IToolCreatorインターフェース不一致✅"
  },
  {
    content: "【修正】createSimpleTool引数修正 - インターフェース準拠",
    status: "in_progress",
    activeForm: "【修正中】demo/intelligent-demo.ts修正中"
  },
  {
    content: "【検証】修正後の動作確認 - 全シナリオテスト",
    status: "pending",
    activeForm: "【待機中】npm run demo:intelligent実行準備"
  }
]
```

**視覚的表現 (Markdown):**
```markdown
# [Issue #ZZZ] ツール作成失敗のバグ修正
> IToolCreatorインターフェース不一致の修正

## 調査
- [x] エラー原因特定 (ツール作成失敗の原因調査)

## 修正
- [ ] createSimpleTool引数修正 (インターフェース準拠)

## 検証
- [ ] 修正後の動作確認 (全シナリオテスト)
```

## エラー処理とリカバリ

### ブロックされた場合

```typescript
// エラーでブロックされた場合、in_progressのまま維持
[
  {
    content: "【実装】機能X実装",
    status: "in_progress",  // エラー発生時もin_progressのまま
    activeForm: "【ブロック中】依存関係エラー解決待ち"
  },
  {
    content: "【対応】依存関係エラー解決",
    status: "pending",  // 新規タスクとして追加
    activeForm: "【待機中】エラー解決準備"
  }
]
```

### 完了条件を満たさない場合

```typescript
// テスト失敗の場合、completedにしない
[
  {
    content: "【実装】機能Y実装",
    status: "in_progress",  // テスト失敗時はin_progressのまま
    activeForm: "【実装中】テスト修正中 - 3件のテストが失敗"
  }
]

// テスト成功後に初めてcompleted
[
  {
    content: "【実装】機能Y実装",
    status: "completed",
    activeForm: "【完了】機能Y実装完了 - 全テスト成功✅"
  }
]
```

## 完了基準

タスクをcompletedにする基準:

### 実装タスク
- ✅ コード実装完了
- ✅ TypeScriptコンパイル成功
- ✅ テスト作成完了（該当する場合）
- ✅ テスト全て成功
- ✅ ドキュメント更新完了（該当する場合）

### 調査タスク
- ✅ 調査完了
- ✅ 結果をユーザーに報告

### 統合タスク
- ✅ 統合完了
- ✅ 動作確認成功

## セッション開始時のチェックリスト

1. ユーザーのリクエストを分析
2. 複数ステップが必要か判断
3. 必要ならTodoWrite実行
4. タスク開始前にpending → in_progress
5. タスク完了後に即座にcompleted
6. 新規タスク発見時に追加
7. セッション終了前にステータス確認

## 禁止事項

❌ **やってはいけないこと:**
1. 複数タスクをまとめてcompletedに変更（バッチ更新禁止）
2. テスト失敗時にcompletedにする
3. 部分的な実装でcompletedにする
4. 複数のタスクを同時にin_progressにする
5. Todo更新を忘れて作業を進める

✅ **推奨される動作:**
1. タスク開始前に必ずin_progressに変更
2. サブタスク完了ごとに状況報告
3. 完全完了後に即座にcompletedに変更
4. ブロックされたらin_progressのまま維持
5. 新規タスク発見時に即座に追加

## 例: 理想的なTodo管理フロー

```typescript
// Step 1: タスク受領時
[
  { content: "【実装】WebSocket統合", status: "pending", activeForm: "WebSocket統合準備" },
  { content: "【テスト】動作確認", status: "pending", activeForm: "テスト準備" }
]

// Step 2: 実装開始
[
  { content: "【実装】WebSocket統合", status: "in_progress", activeForm: "【実装中】サーバー作成中" },
  { content: "【テスト】動作確認", status: "pending", activeForm: "テスト準備" }
]

// Step 3: サーバー完了、クライアント開始（新規タスク発見）
[
  { content: "【実装】WebSocket統合", status: "in_progress", activeForm: "【実装中】クライアント作成中" },
  { content: "【ドキュメント】使用方法記載", status: "pending", activeForm: "ドキュメント準備" },  // 新規追加
  { content: "【テスト】動作確認", status: "pending", activeForm: "テスト準備" }
]

// Step 4: 実装完了
[
  { content: "【実装】WebSocket統合", status: "completed", activeForm: "【完了】WebSocket統合完了✅" },
  { content: "【ドキュメント】使用方法記載", status: "in_progress", activeForm: "【作成中】ドキュメント作成中" },
  { content: "【テスト】動作確認", status: "pending", activeForm: "テスト準備" }
]

// Step 5: 全タスク完了
[
  { content: "【実装】WebSocket統合", status: "completed", activeForm: "【完了】WebSocket統合完了✅" },
  { content: "【ドキュメント】使用方法記載", status: "completed", activeForm: "【完了】ドキュメント作成完了✅" },
  { content: "【テスト】動作確認", status: "completed", activeForm: "【完了】全テスト成功✅" }
]
```

---

このプロトコルに従うことで:
- ✅ 進捗が可視化される
- ✅ タスクの抜け漏れを防げる
- ✅ ユーザーが状況を把握しやすくなる
- ✅ セッションの継続性が向上する
