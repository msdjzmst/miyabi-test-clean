/**
 * TemplateEngine - Markdownドキュメント生成エンジン
 *
 * Handlebarsを使用してTypeScriptの解析結果から
 * Markdownドキュメントを生成します。
 *
 * @module TemplateEngine
 */

import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AnalysisResult,
  FunctionInfo,
  ClassInfo,
  InterfaceInfo,
} from '../analyzer/CodeAnalyzer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * テンプレートの種類
 */
export type TemplateType = 'function' | 'class' | 'interface' | 'index';

/**
 * ドキュメント生成オプション
 */
export interface GenerationOptions {
  outputDir: string;
  includePrivate?: boolean;
  includeSourceCode?: boolean;
  groupByFile?: boolean;
  title?: string;
}

/**
 * TemplateEngine - Markdownドキュメント生成エンジン
 *
 * Handlebarsテンプレートを使用して、TypeScriptの解析結果から
 * 見やすいMarkdownドキュメントを生成します。
 */
export class TemplateEngine {
  private templates: Map<TemplateType, HandlebarsTemplateDelegate>;

  /**
   * TemplateEngineを初期化します
   *
   * @param customTemplateDir - カスタムテンプレートディレクトリ（オプション）
   */
  constructor(customTemplateDir?: string) {
    this.templates = new Map();
    this.registerHelpers();
    this.loadTemplates(customTemplateDir);
  }

  /**
   * Handlebarsヘルパーを登録します
   *
   * @private
   */
  private registerHelpers(): void {
    // 配列が空でないかチェック
    Handlebars.registerHelper('isNotEmpty', function (array: any[]) {
      return array && array.length > 0;
    });

    // コードブロックをフォーマット
    Handlebars.registerHelper('codeBlock', function (code: string, lang = 'typescript') {
      return new Handlebars.SafeString(`\`\`\`${lang}\n${code}\n\`\`\``);
    });

    // インラインコードをフォーマット
    Handlebars.registerHelper('inlineCode', function (text: string) {
      return new Handlebars.SafeString(`\`${text}\`>`);
    });

    // パラメータリストをフォーマット
    Handlebars.registerHelper('formatParams', function (params: any[]) {
      if (!params || params.length === 0) return '()';
      const paramStrings = params.map(
        (p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`
      );
      return `(${paramStrings.join(', ')})`;
    });

    // プロパティの可視性アイコン
    Handlebars.registerHelper('visibilityIcon', function (visibility: string) {
      const icons = {
        public: '🟢',
        private: '🔴',
        protected: '🟡',
      };
      return icons[visibility as keyof typeof icons] || '';
    });

    // 修飾子バッジを生成
    Handlebars.registerHelper('modifierBadges', function (options: any) {
      const badges: string[] = [];
      if (options.hash.isStatic) badges.push('`static`');
      if (options.hash.isAsync) badges.push('`async`');
      if (options.hash.isReadonly) badges.push('`readonly`');
      if (options.hash.isAbstract) badges.push('`abstract`');
      if (options.hash.isExported) badges.push('`exported`');
      return badges.join(' ');
    });

    // 日付をフォーマット
    Handlebars.registerHelper('formatDate', function (isoString: string) {
      const date = new Date(isoString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // 相対パスを取得
    Handlebars.registerHelper('relativePath', function (filePath: string, basePath: string) {
      return path.relative(basePath, filePath);
    });
  }

  /**
   * テンプレートファイルを読み込みます
   *
   * @private
   * @param customTemplateDir - カスタムテンプレートディレクトリ
   */
  private loadTemplates(customTemplateDir?: string): void {
    const templateDir = customTemplateDir || this.getDefaultTemplateDir();

    // デフォルトテンプレートを使用する場合は、インラインテンプレートを使用
    if (!customTemplateDir) {
      this.loadInlineTemplates();
      return;
    }

    // カスタムテンプレートを読み込む
    const templateTypes: TemplateType[] = ['function', 'class', 'interface', 'index'];

    for (const type of templateTypes) {
      const templatePath = path.join(templateDir, `${type}.hbs`);
      if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        this.templates.set(type, Handlebars.compile(templateContent));
      }
    }
  }

  /**
   * インラインテンプレートを読み込みます
   *
   * @private
   */
  private loadInlineTemplates(): void {
    // 関数用テンプレート
    const functionTemplate = `
## {{name}}

{{#if description}}
{{description}}
{{/if}}

**Signature:**
\`\`\`typescript
{{#if isAsync}}async {{/if}}function {{name}}{{formatParams parameters}}: {{returnType}}
\`\`\`

{{#if (isNotEmpty parameters)}}
**Parameters:**
{{#each parameters}}
- \`{{name}}\` (\`{{type}}\`){{#if optional}} - Optional{{/if}}{{#if description}} - {{description}}{{/if}}
{{/each}}
{{/if}}

**Returns:** \`{{returnType}}\`

{{modifierBadges isExported=isExported isAsync=isAsync}}

{{#if includeSourceCode}}
**Source Code:**
{{codeBlock sourceCode}}
{{/if}}

---
`;

    // クラス用テンプレート
    const classTemplate = `
## {{name}}

{{#if description}}
{{description}}
{{/if}}

{{modifierBadges isExported=isExported isAbstract=isAbstract}}

{{#if extends}}
**Extends:** \`{{extends}}\`
{{/if}}

{{#if (isNotEmpty implements)}}
**Implements:** {{#each implements}}\`{{this}}\`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{#if (isNotEmpty properties)}}
### Properties

| Name | Type | Visibility | Modifiers | Description |
|------|------|------------|-----------|-------------|
{{#each properties}}
| {{visibilityIcon visibility}} \`{{name}}\` | \`{{type}}\` | {{visibility}} | {{#if isStatic}}\`static\` {{/if}}{{#if isReadonly}}\`readonly\` {{/if}} | {{description}} |
{{/each}}
{{/if}}

{{#if (isNotEmpty methods)}}
### Methods

{{#each methods}}
#### {{visibilityIcon visibility}} {{name}}

{{#if description}}
{{description}}
{{/if}}

\`\`\`typescript
{{#if isAsync}}async {{/if}}{{name}}{{formatParams parameters}}: {{returnType}}
\`\`\`

{{#if (isNotEmpty parameters)}}
**Parameters:**
{{#each parameters}}
- \`{{name}}\` (\`{{type}}\`){{#if optional}} - Optional{{/if}}
{{/each}}
{{/if}}

**Returns:** \`{{returnType}}\`

{{/each}}
{{/if}}

---
`;

    // インターフェース用テンプレート
    const interfaceTemplate = `
## {{name}}

{{#if description}}
{{description}}
{{/if}}

{{#if (isNotEmpty extends)}}
**Extends:** {{#each extends}}\`{{this}}\`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{#if (isNotEmpty properties)}}
### Properties

| Name | Type | Optional | Description |
|------|------|----------|-------------|
{{#each properties}}
| \`{{name}}\` | \`{{type}}\` | {{#if optional}}Yes{{else}}No{{/if}} | {{description}} |
{{/each}}
{{/if}}

{{#if (isNotEmpty methods)}}
### Methods

{{#each methods}}
#### {{name}}

{{#if description}}
{{description}}
{{/if}}

\`\`\`typescript
{{name}}{{formatParams parameters}}: {{returnType}}
\`\`\`

{{/each}}
{{/if}}

---
`;

    // インデックス用テンプレート
    const indexTemplate = `
# {{title}}

> Generated on {{formatDate analysisDate}}

## Overview

- **Total Files:** {{totalFiles}}
- **Functions:** {{functions.length}}
- **Classes:** {{classes.length}}
- **Interfaces:** {{interfaces.length}}

---

{{#if (isNotEmpty functions)}}
## Functions

{{#each functions}}
- [{{name}}](#{{name}}) - {{description}}
{{/each}}
{{/if}}

{{#if (isNotEmpty classes)}}
## Classes

{{#each classes}}
- [{{name}}](#{{name}}) - {{description}}
{{/each}}
{{/if}}

{{#if (isNotEmpty interfaces)}}
## Interfaces

{{#each interfaces}}
- [{{name}}](#{{name}}) - {{description}}
{{/each}}
{{/if}}

---
`;

    this.templates.set('function', Handlebars.compile(functionTemplate));
    this.templates.set('class', Handlebars.compile(classTemplate));
    this.templates.set('interface', Handlebars.compile(interfaceTemplate));
    this.templates.set('index', Handlebars.compile(indexTemplate));
  }

  /**
   * デフォルトのテンプレートディレクトリを取得します
   *
   * @private
   * @returns {string} テンプレートディレクトリのパス
   */
  private getDefaultTemplateDir(): string {
    return path.join(__dirname, '../../templates');
  }

  /**
   * 解析結果からMarkdownドキュメントを生成します
   *
   * @param analysisResult - コード解析結果
   * @param options - ドキュメント生成オプション
   * @returns {string[]} 生成されたファイルのパスリスト
   */
  public generate(analysisResult: AnalysisResult, options: GenerationOptions): string[] {
    const generatedFiles: string[] = [];

    // 出力ディレクトリを作成
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // インデックスページを生成
    const indexPath = path.join(options.outputDir, 'README.md');
    const indexContent = this.generateIndex(analysisResult, options);
    fs.writeFileSync(indexPath, indexContent, 'utf-8');
    generatedFiles.push(indexPath);

    // 関数ドキュメントを生成
    if (analysisResult.functions.length > 0) {
      const functionsPath = path.join(options.outputDir, 'functions.md');
      const functionsContent = this.generateFunctions(analysisResult.functions, options);
      fs.writeFileSync(functionsPath, functionsContent, 'utf-8');
      generatedFiles.push(functionsPath);
    }

    // クラスドキュメントを生成
    if (analysisResult.classes.length > 0) {
      const classesPath = path.join(options.outputDir, 'classes.md');
      const classesContent = this.generateClasses(analysisResult.classes, options);
      fs.writeFileSync(classesPath, classesContent, 'utf-8');
      generatedFiles.push(classesPath);
    }

    // インターフェースドキュメントを生成
    if (analysisResult.interfaces.length > 0) {
      const interfacesPath = path.join(options.outputDir, 'interfaces.md');
      const interfacesContent = this.generateInterfaces(analysisResult.interfaces, options);
      fs.writeFileSync(interfacesPath, interfacesContent, 'utf-8');
      generatedFiles.push(interfacesPath);
    }

    return generatedFiles;
  }

  /**
   * インデックスページを生成します
   *
   * @private
   * @param analysisResult - 解析結果
   * @param options - 生成オプション
   * @returns {string} Markdownコンテンツ
   */
  private generateIndex(analysisResult: AnalysisResult, options: GenerationOptions): string {
    const template = this.templates.get('index');
    if (!template) {
      throw new Error('Index template not found');
    }

    return template({
      ...analysisResult,
      title: options.title || 'API Documentation',
    });
  }

  /**
   * 関数ドキュメントを生成します
   *
   * @private
   * @param functions - 関数情報の配列
   * @param options - 生成オプション
   * @returns {string} Markdownコンテンツ
   */
  private generateFunctions(functions: FunctionInfo[], options: GenerationOptions): string {
    const template = this.templates.get('function');
    if (!template) {
      throw new Error('Function template not found');
    }

    let content = '# Functions\n\n';
    for (const fn of functions) {
      content += template({
        ...fn,
        includeSourceCode: options.includeSourceCode,
      });
    }

    return content;
  }

  /**
   * クラスドキュメントを生成します
   *
   * @private
   * @param classes - クラス情報の配列
   * @param options - 生成オプション
   * @returns {string} Markdownコンテンツ
   */
  private generateClasses(classes: ClassInfo[], options: GenerationOptions): string {
    const template = this.templates.get('class');
    if (!template) {
      throw new Error('Class template not found');
    }

    let content = '# Classes\n\n';
    for (const cls of classes) {
      // プライベートメンバーをフィルタリング
      const filteredClass = {
        ...cls,
        properties: options.includePrivate
          ? cls.properties
          : cls.properties.filter((p) => p.visibility !== 'private'),
        methods: options.includePrivate
          ? cls.methods
          : cls.methods.filter((m) => m.visibility !== 'private'),
      };

      content += template(filteredClass);
    }

    return content;
  }

  /**
   * インターフェースドキュメントを生成します
   *
   * @private
   * @param interfaces - インターフェース情報の配列
   * @param _options - 生成オプション（将来の拡張用）
   * @returns {string} Markdownコンテンツ
   */
  private generateInterfaces(interfaces: InterfaceInfo[], _options: GenerationOptions): string {
    const template = this.templates.get('interface');
    if (!template) {
      throw new Error('Interface template not found');
    }

    let content = '# Interfaces\n\n';
    for (const iface of interfaces) {
      content += template(iface);
    }

    return content;
  }

  /**
   * カスタムテンプレートを登録します
   *
   * @param type - テンプレートタイプ
   * @param templateContent - テンプレートの内容
   */
  public registerTemplate(type: TemplateType, templateContent: string): void {
    this.templates.set(type, Handlebars.compile(templateContent));
  }
}
