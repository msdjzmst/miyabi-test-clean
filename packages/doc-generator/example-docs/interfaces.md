# Interfaces


## FunctionInfo

関数情報の型定義


### Properties

| Name | Type | Optional | Description |
|------|------|----------|-------------|
| `name` | `string` | No |  |
| `description` | `string` | No |  |
| `parameters` | `{ name: string; type: string; optional: boolean; description: string; }[]` | No |  |
| `returnType` | `string` | No |  |
| `isAsync` | `boolean` | No |  |
| `isExported` | `boolean` | No |  |
| `decorators` | `string[]` | No |  |
| `sourceCode` | `string` | No |  |
| `filePath` | `string` | No |  |
| `line` | `number` | No |  |


---

## ClassInfo

クラス情報の型定義


### Properties

| Name | Type | Optional | Description |
|------|------|----------|-------------|
| `name` | `string` | No |  |
| `description` | `string` | No |  |
| `extends` | `string` | No |  |
| `implements` | `string[]` | No |  |
| `properties` | `{ name: string; type: string; visibility: &quot;public&quot; | &quot;private&quot; | &quot;protected&quot;; isStatic: boolean; isReadonly: boolean; description: string; }[]` | No |  |
| `methods` | `{ name: string; description: string; parameters: { name: string; type: string; optional: boolean; }[]; returnType: string; visibility: &quot;public&quot; | &quot;private&quot; | &quot;protected&quot;; isStatic: boolean; isAsync: boolean; }[]` | No |  |
| `isAbstract` | `boolean` | No |  |
| `isExported` | `boolean` | No |  |
| `decorators` | `string[]` | No |  |
| `filePath` | `string` | No |  |
| `line` | `number` | No |  |


---

## InterfaceInfo

インターフェース情報の型定義


### Properties

| Name | Type | Optional | Description |
|------|------|----------|-------------|
| `name` | `string` | No |  |
| `description` | `string` | No |  |
| `extends` | `string[]` | No |  |
| `properties` | `{ name: string; type: string; optional: boolean; description: string; }[]` | No |  |
| `methods` | `{ name: string; description: string; parameters: { name: string; type: string; optional: boolean; }[]; returnType: string; }[]` | No |  |
| `isExported` | `boolean` | No |  |
| `filePath` | `string` | No |  |
| `line` | `number` | No |  |


---

## AnalysisResult

解析結果の型定義


### Properties

| Name | Type | Optional | Description |
|------|------|----------|-------------|
| `functions` | `import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/src/analyzer/CodeAnalyzer&quot;).FunctionInfo[]` | No |  |
| `classes` | `import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/src/analyzer/CodeAnalyzer&quot;).ClassInfo[]` | No |  |
| `interfaces` | `import(&quot;/Users/shunsuke/Dev/Autonomous-Operations/packages/doc-generator/src/analyzer/CodeAnalyzer&quot;).InterfaceInfo[]` | No |  |
| `totalFiles` | `number` | No |  |
| `analysisDate` | `string` | No |  |
| `projectPath` | `string` | No |  |


---
