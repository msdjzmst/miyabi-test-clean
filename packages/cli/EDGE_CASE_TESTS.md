# 🧪 Miyabi エッジケーステストリスト

## 🎯 目的

ユーザーが実際に遭遇する可能性のあるエッジケースを網羅的にテストします。

---

## ✅ 完了したテスト

### Test 1: ESモジュールでの__dirnameエラー
**ケース**: `npx miyabi init project-name` でラベル作成時にエラー
**エラー**: `__dirname is not defined`
**原因**: ESモジュールで__dirnameが使えない
**修正**: `fileURLToPath(import.meta.url)` を使用
**バージョン**: v0.3.2で修正
**ステータス**: ✅ 修正完了

---

## 🔄 実行予定のテスト

### Test 2: 環境変数 vs 設定ファイルの優先順位
**ケース**:
```bash
export GITHUB_TOKEN=token1
# .miyabi.yml には token2 が設定されている
npx miyabi status
```
**期待動作**: 環境変数が優先される
**確認項目**:
- [ ] 環境変数が優先されるか
- [ ] エラーメッセージが適切か

### Test 3: トークンが無効な場合
**ケース**:
```bash
# 無効なトークンを設定
npx miyabi config --token=invalid_token
npx miyabi init test-project
```
**期待動作**: 明確なエラーメッセージ
**確認項目**:
- [ ] 認証エラーが検出されるか
- [ ] ユーザーにトークン再作成を促すか

### Test 4: インターネット接続が無い場合
**ケース**:
```bash
# ネットワークを切断
npx miyabi init test-project
```
**期待動作**: ネットワークエラーメッセージ
**確認項目**:
- [ ] タイムアウトが適切か
- [ ] リトライ機能があるか

### Test 5: 既存リポジトリ名と重複
**ケース**:
```bash
# 既に存在するリポジトリ名で作成
npx miyabi init existing-repo-name
```
**期待動作**: 重複エラーと代替案
**確認項目**:
- [ ] 重複が検出されるか
- [ ] 別名の提案があるか

### Test 6: Gitリポジトリでないフォルダでinstall
**ケース**:
```bash
mkdir not-a-repo
cd not-a-repo
npx miyabi install
```
**期待動作**: git init を促す
**確認項目**:
- [ ] エラーメッセージが明確か
- [ ] git init の手順が示されるか

### Test 7: リモートリポジトリが設定されていない
**ケース**:
```bash
git init
npx miyabi install
```
**期待動作**: リモート設定を促す
**確認項目**:
- [ ] エラーメッセージが明確か
- [ ] git remote add の手順が示されるか

### Test 8: GitHub APIレート制限
**ケース**:
```bash
# レート制限に達した状態で実行
npx miyabi init test-project
```
**期待動作**: レート制限エラーと待機時間
**確認項目**:
- [ ] レート制限が検出されるか
- [ ] 待機時間が表示されるか

### Test 9: プロジェクト名に特殊文字
**ケース**:
```bash
npx miyabi init "my project!"  # スペースと記号
npx miyabi init "日本語プロジェクト"  # 日本語
```
**期待動作**: バリデーションエラー
**確認項目**:
- [ ] 無効な文字が検出されるか
- [ ] 許可される文字が説明されるか

### Test 10: 非常に長いプロジェクト名
**ケース**:
```bash
npx miyabi init very-long-project-name-that-exceeds-github-limits-abcdefghijklmnopqrstuvwxyz
```
**期待動作**: 長さ制限エラー
**確認項目**:
- [ ] 長さ制限が検出されるか
- [ ] 最大文字数が示されるか

### Test 11: Ctrl+Cで中断
**ケース**:
```bash
npx miyabi init test-project
# セットアップ中に Ctrl+C
```
**期待動作**: クリーンアップして終了
**確認項目**:
- [ ] 部分的に作成されたリポジトリが削除されるか
- [ ] ロールバック処理があるか

### Test 12: ディスク容量不足
**ケース**:
```bash
# ディスク容量が少ない状態で実行
npx miyabi init test-project
```
**期待動作**: ディスク容量エラー
**確認項目**:
- [ ] エラーが検出されるか
- [ ] 必要な容量が示されるか

### Test 13: 権限が無いフォルダ
**ケース**:
```bash
cd /root  # 権限が無い
npx miyabi init test-project
```
**期待動作**: 権限エラー
**確認項目**:
- [ ] エラーが検出されるか
- [ ] 解決策が示されるか

### Test 14: 複数のMiyabiインスタンスを同時実行
**ケース**:
```bash
# ターミナル1
npx miyabi init project1

# ターミナル2（同時に）
npx miyabi init project2
```
**期待動作**: 両方が正常に完了
**確認項目**:
- [ ] 競合が発生しないか
- [ ] ロックファイルがあるか

### Test 15: 設定ファイルが壊れている
**ケース**:
```bash
# .miyabi.yml を手動で編集して壊す
echo "invalid yaml: [" > .miyabi.yml
npx miyabi status
```
**期待動作**: 設定ファイルエラー
**確認項目**:
- [ ] エラーが検出されるか
- [ ] 設定リセット方法が示されるか

### Test 16: 古いNode.jsバージョン
**ケース**:
```bash
# Node.js v16 で実行
npx miyabi init test-project
```
**期待動作**: バージョンエラー
**確認項目**:
- [ ] バージョンチェックがあるか
- [ ] 必要バージョンが示されるか

### Test 17: プライベートリポジトリの制限
**ケース**:
```bash
# プライベートリポジトリの上限に達している
npx miyabi init new-private-project --private
```
**期待動作**: 制限エラー
**確認項目**:
- [ ] GitHub APIからのエラーが適切に処理されるか
- [ ] 公開リポジトリを提案するか

### Test 18: 組織リポジトリでの実行
**ケース**:
```bash
# 組織のリポジトリで実行
cd my-org/repo
npx miyabi install
```
**期待動作**: 組織権限の確認
**確認項目**:
- [ ] 組織の権限が確認されるか
- [ ] Admin権限が必要なことが示されるか

### Test 19: すでにMiyabiがインストール済み
**ケース**:
```bash
npx miyabi install
# → 既にインストール済み
npx miyabi install  # もう一度実行
```
**期待動作**: 既存検出と上書き確認
**確認項目**:
- [ ] 既存インストールが検出されるか
- [ ] 上書き確認があるか

### Test 20: ドライランモードのテスト
**ケース**:
```bash
npx miyabi install --dry-run
```
**期待動作**: 変更を加えずに結果を表示
**確認項目**:
- [ ] 実際に変更が加えられないか
- [ ] 何が追加されるか明確に表示されるか

---

## 🎭 UIテスト

### Test 21: プログレスバーの表示
**ケース**: 長い処理中のスピナー表示
**確認項目**:
- [ ] スピナーが正しく表示されるか
- [ ] 処理完了時に✓マークに変わるか

### Test 22: カラー出力の確認
**ケース**: ターミナルのカラー対応
**確認項目**:
- [ ] カラー非対応ターミナルでも読めるか
- [ ] 色覚異常への配慮があるか

### Test 23: 日本語と英語の切り替え
**ケース**:
```bash
miyabi config --language=en
miyabi init test-project
```
**確認項目**:
- [ ] 英語メッセージが表示されるか
- [ ] 日本語と英語で機能差が無いか

---

## 🔐 セキュリティテスト

### Test 24: トークンがログに出力されないか
**ケース**: エラー発生時のログ
**確認項目**:
- [ ] トークンがコンソールに表示されないか
- [ ] エラーログにトークンが含まれないか

### Test 25: 設定ファイルのパーミッション
**ケース**:
```bash
ls -la .miyabi.yml
```
**確認項目**:
- [ ] ファイルパーミッションが600か
- [ ] 他ユーザーから読めないか

---

## 📊 パフォーマンステスト

### Test 26: 大量のIssueがある場合
**ケース**:
```bash
# 1000個のIssueがあるリポジトリで実行
npx miyabi install
```
**確認項目**:
- [ ] タイムアウトしないか
- [ ] メモリ使用量が適切か

### Test 27: 大量のラベルがある場合
**ケース**: 既に100個のラベルがあるリポジトリ
**確認項目**:
- [ ] 既存ラベルとマージできるか
- [ ] 処理時間が許容範囲か

---

## 🌍 環境テスト

### Test 28: Windows環境
**ケース**: Windows 10/11 で実行
**確認項目**:
- [ ] パス区切り文字が正しいか
- [ ] 改行コードが正しいか

### Test 29: Mac環境
**ケース**: macOS で実行
**確認項目**:
- [ ] ファイルシステムの違いに対応しているか

### Test 30: Linux環境
**ケース**: Ubuntu/Debian で実行
**確認項目**:
- [ ] 権限の違いに対応しているか

---

## 🔄 継続的テストのための自動化

### テスト実行スクリプト

```bash
# すべてのテストを実行
npm run test:edge-cases

# 特定のカテゴリのみ
npm run test:edge-cases:security
npm run test:edge-cases:performance
npm run test:edge-cases:ui
```

### CI/CD統合

```yaml
# .github/workflows/edge-case-tests.yml
name: Edge Case Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm install
      - run: npm run test:edge-cases
```

---

## 📝 テスト結果の記録

| Test# | ケース | 状態 | バージョン | メモ |
|-------|--------|------|-----------|------|
| 1 | ESM __dirname | ✅ | v0.3.2 | 修正完了 |
| 2 | 環境変数優先順位 | ⏳ | - | 未実施 |
| 3 | 無効トークン | ⏳ | - | 未実施 |
| ... | ... | ... | ... | ... |

---

## 🎯 次のアクション

1. **Test 2-5を優先的に実行** （認証・ネットワーク関連）
2. **Test 6-10を実施** （バリデーション関連）
3. **Test 24-25を実施** （セキュリティ関連）
4. **自動化スクリプトを作成**

---

**テスト担当者へ:**
各テストを実行したら、このファイルを更新してください。
バグを見つけたら、即座にIssueを作成してください。
