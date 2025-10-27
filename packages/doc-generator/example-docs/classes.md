# Classes


## CodeAnalyzer

CodeAnalyzer - TypeScriptコード解析エンジン

ts-morphを使用してTypeScriptのASTを解析し、
ドキュメント生成に必要な情報を抽出します。

&#x60;exported&#x60;




### Methods

#### 🟢 addSource

指定されたディレクトリまたはファイルを解析対象に追加します

```typescript
addSource(targetPath: string): void
```

**Parameters:**
- `targetPath` (`string`)

**Returns:** `void`

#### 🟢 analyze

全ての解析対象ファイルを解析し、結果を返します

```typescript
analyze(): import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/src/analyzer/CodeAnalyzer&quot;).AnalysisResult
```


**Returns:** `import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/src/analyzer/CodeAnalyzer&quot;).AnalysisResult`

#### 🟢 getProjectInfo

プロジェクト情報を取得します

```typescript
getProjectInfo(): { totalSourceFiles: number; rootDirectory: string | import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/node_modules/@ts-morph/common/lib/ts-morph-common&quot;).StandardizedFilePath; }
```


**Returns:** `{ totalSourceFiles: number; rootDirectory: string | import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/node_modules/@ts-morph/common/lib/ts-morph-common&quot;).StandardizedFilePath; }`


---
