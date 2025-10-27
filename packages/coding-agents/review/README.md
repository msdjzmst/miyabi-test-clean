# ReviewAgent - セキュリティスキャナーのStrategy Pattern実装

## 概要

ReviewAgentは、Strategy Patternを使用してセキュリティスキャンの拡張性と保守性を向上させています。

## アーキテクチャ

### Strategy Pattern

```
┌─────────────────────┐
│   ReviewAgent       │
│                     │
│  runSecurityScan()  │
└──────────┬──────────┘
           │
           │ uses
           ▼
┌──────────────────────────┐
│ SecurityScannerRegistry  │
│                          │
│  - getAll()              │
│  - register(scanner)     │
└────────────┬─────────────┘
             │
             │ manages
             ▼
   ┌─────────────────────┐
   │ SecurityScanner     │◄─────── Interface
   │                     │
   │  + scan(files)      │
   └─────────────────────┘
             △
             │ implements
    ┌────────┼────────┐
    │        │        │
    │        │        │
┌───▼───┐ ┌─▼──────┐ ┌▼──────────┐
│Secrets│ │Vuln    │ │NpmAudit   │
│Scanner│ │Scanner │ │Scanner    │
└───────┘ └────────┘ └───────────┘
```

## 使用方法

### 既存のスキャナーを使用

```typescript
import { SecurityScannerRegistry } from './security-scanner.js';

// 全てのスキャナーを取得
const scanners = SecurityScannerRegistry.getAll();

// 並列実行
const results = await Promise.all(
  scanners.map(scanner => scanner.scan(files))
);

const allIssues = results.flat();
```

### 新しいスキャナーを追加

```typescript
import { SecurityScanner, SecurityScannerRegistry } from './security-scanner.js';
import { QualityIssue } from '../types/index.js';

// 1. SecurityScannerインターフェースを実装
class CustomSecurityScanner implements SecurityScanner {
  readonly name = 'CustomSecurityScanner';

  async scan(files: string[]): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // カスタムスキャンロジック
    for (const file of files) {
      // ... スキャン処理 ...
    }

    return issues;
  }
}

// 2. レジストリに登録
SecurityScannerRegistry.register(new CustomSecurityScanner());

// 3. ReviewAgentが自動的に使用
```

## 利用可能なスキャナー

### 1. SecretsScanner

**検出対象**:
- API keys (`api_key`, `apikey`)
- Passwords (`password`, `passwd`, `pwd`)
- Secrets/Tokens
- Anthropic API keys (`sk-*`)
- GitHub tokens (`ghp_*`)

**重大度**: Critical

### 2. VulnerabilityScanner

**検出対象**:
- `eval()` の使用 (Critical)
- `innerHTML` XSS リスク (High)
- `document.write()` XSS リスク (High)
- Command injection リスク (High)

### 3. NpmAuditScanner

**検出対象**:
- 依存パッケージの脆弱性 (Critical/High)

**実行**: `npm audit --json`

## メリット

### 1. 拡張性 ✅

新しいスキャナーの追加が容易：
- インターフェースを実装
- レジストリに登録
- ReviewAgentの変更不要

### 2. テスト容易性 ✅

各スキャナーを独立してテスト可能：
```typescript
import { SecretsScanner } from './security-scanner.js';

const scanner = new SecretsScanner();
const issues = await scanner.scan(['test.ts']);

expect(issues.length).toBeGreaterThan(0);
```

### 3. 並列実行 ⚡

全スキャナーを並列実行：
```typescript
const scanResults = await Promise.all(
  scanners.map(scanner => scanner.scan(files))
);
```

### 4. 保守性 ✅

- 各スキャナーが独立
- 責任の分離
- コードの再利用性

## パフォーマンス

### Before (密結合)
```
runSecurityScan() {
  - scanForSecrets()      // メソッド内に実装
  - scanForVulnerabilities()
  - runNpmAudit()
}
```

### After (Strategy Pattern)
```
runSecurityScan() {
  const scanners = SecurityScannerRegistry.getAll();
  await Promise.all(scanners.map(s => s.scan(files)));
}
```

**並列実行**: 全スキャナーが同時実行
**拡張性**: レジストリに登録するだけ

## テスト

```bash
# SecurityScannerのテスト
npm test -- SecurityScanner

# ReviewAgentを含む全テスト
npm test
```

## 例: カスタムDockerfileスキャナー

```typescript
class DockerfileScanner implements SecurityScanner {
  readonly name = 'DockerfileScanner';

  async scan(files: string[]): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    for (const file of files) {
      if (!file.endsWith('Dockerfile')) continue;

      const content = await fs.promises.readFile(file, 'utf-8');

      // ROOTユーザーの使用を検出
      if (content.match(/^USER root/m)) {
        issues.push({
          type: 'security',
          severity: 'high',
          message: 'Dockerfile uses ROOT user',
          file,
          scoreImpact: 20,
        });
      }
    }

    return issues;
  }
}

// 登録
SecurityScannerRegistry.register(new DockerfileScanner());
```

## 参考資料

- [Strategy Pattern - Refactoring Guru](https://refactoring.guru/design-patterns/strategy)
- [agents/review/security-scanner.ts](security-scanner.ts) - 実装
- [tests/SecurityScanner.test.ts](../../tests/SecurityScanner.test.ts) - テスト
- [agents/review/review-agent.ts](review-agent.ts) - 使用例

---

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
