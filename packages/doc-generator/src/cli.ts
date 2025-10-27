#!/usr/bin/env node
/**
 * doc-generator CLI - TypeScriptドキュメント自動生成ツール
 *
 * Commander.jsを使用したCLIインターフェース
 *
 * @module cli
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { CodeAnalyzer } from './analyzer/CodeAnalyzer';
import { TemplateEngine } from './generator/TemplateEngine';

const program = new Command();

/**
 * バージョン情報
 */
const VERSION = '1.0.0';

/**
 * CLIのメイン設定
 */
program
  .name('doc-gen')
  .description('AI-Powered TypeScript Documentation Generator')
  .version(VERSION);

/**
 * analyze コマンド - TypeScriptコードを解析してドキュメント生成
 */
program
  .command('analyze')
  .description('Analyze TypeScript code and generate documentation')
  .argument('<source>', 'Source directory or file to analyze')
  .option('-o, --output <dir>', 'Output directory for documentation', './docs')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--template <dir>', 'Custom template directory')
  .option('--title <title>', 'Documentation title', 'API Documentation')
  .option('--include-private', 'Include private members in documentation', false)
  .option('--include-source', 'Include source code in documentation', false)
  .option('--json', 'Output analysis result as JSON', false)
  .action(async (source: string, options) => {
    console.log(chalk.bold.blue('\n🚀 TypeScript Documentation Generator\n'));

    const spinner = ora('Initializing analyzer...').start();

    try {
      // 入力パスを検証
      const sourcePath = path.resolve(source);
      if (!fs.existsSync(sourcePath)) {
        spinner.fail(chalk.red(`Source path does not exist: ${sourcePath}`));
        process.exit(1);
      }

      // CodeAnalyzerを初期化
      spinner.text = 'Loading TypeScript project...';
      const analyzer = new CodeAnalyzer(options.tsconfig);

      // ソースを追加
      spinner.text = `Analyzing ${sourcePath}...`;
      analyzer.addSource(sourcePath);

      // 解析実行
      spinner.text = 'Parsing TypeScript AST...';
      const result = await analyzer.analyze();

      spinner.succeed(
        chalk.green(
          `✅ Analysis complete: ${result.functions.length} functions, ${result.classes.length} classes, ${result.interfaces.length} interfaces`
        )
      );

      // JSON出力モード
      if (options.json) {
        const jsonPath = path.join(options.output, 'analysis.json');
        fs.mkdirSync(options.output, { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(chalk.green(`\n📄 Analysis result saved to: ${jsonPath}`));
        return;
      }

      // ドキュメント生成
      const genSpinner = ora('Generating Markdown documentation...').start();

      const templateEngine = new TemplateEngine(options.template);
      const generatedFiles = templateEngine.generate(result, {
        outputDir: options.output,
        includePrivate: options.includePrivate,
        includeSourceCode: options.includeSource,
        title: options.title,
      });

      genSpinner.succeed(chalk.green(`✅ Documentation generated`));

      // 結果を表示
      console.log(chalk.bold('\n📚 Generated Files:\n'));
      for (const file of generatedFiles) {
        console.log(chalk.cyan(`  • ${path.relative(process.cwd(), file)}`));
      }

      console.log(
        chalk.bold.green(
          `\n✨ Documentation successfully generated in ${chalk.cyan(options.output)}\n`
        )
      );
    } catch (error) {
      spinner.fail(chalk.red('❌ Generation failed'));
      console.error(chalk.red('\nError:'), (error as Error).message);
      if (process.env.DEBUG) {
        console.error(chalk.gray('\nStack trace:'));
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

/**
 * init コマンド - テンプレートディレクトリを初期化
 */
program
  .command('init')
  .description('Initialize custom template directory')
  .option('-o, --output <dir>', 'Output directory for templates', './templates')
  .action(async (options) => {
    console.log(chalk.bold.blue('\n🎨 Template Initialization\n'));

    const spinner = ora('Creating template directory...').start();

    try {
      const templateDir = path.resolve(options.output);

      // テンプレートディレクトリを作成
      if (fs.existsSync(templateDir)) {
        spinner.warn(chalk.yellow(`Template directory already exists: ${templateDir}`));
      } else {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      // デフォルトテンプレートを生成
      const templates = {
        'function.hbs': generateDefaultFunctionTemplate(),
        'class.hbs': generateDefaultClassTemplate(),
        'interface.hbs': generateDefaultInterfaceTemplate(),
        'index.hbs': generateDefaultIndexTemplate(),
      };

      for (const [filename, content] of Object.entries(templates)) {
        const templatePath = path.join(templateDir, filename);
        fs.writeFileSync(templatePath, content, 'utf-8');
      }

      spinner.succeed(chalk.green('✅ Templates initialized'));

      console.log(chalk.bold('\n📝 Template Files:\n'));
      for (const filename of Object.keys(templates)) {
        console.log(chalk.cyan(`  • ${path.join(options.output, filename)}`));
      }

      console.log(
        chalk.bold.green(
          `\n✨ Templates successfully created in ${chalk.cyan(templateDir)}\n`
        )
      );
      console.log(
        chalk.gray(
          'Tip: Edit these templates to customize your documentation output.\n'
        )
      );
    } catch (error) {
      spinner.fail(chalk.red('❌ Initialization failed'));
      console.error(chalk.red('\nError:'), (error as Error).message);
      process.exit(1);
    }
  });

/**
 * デフォルトテンプレートを生成する関数群
 */

function generateDefaultFunctionTemplate(): string {
  return `## {{name}}

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

---
`;
}

function generateDefaultClassTemplate(): string {
  return `## {{name}}

{{#if description}}
{{description}}
{{/if}}

{{#if extends}}
**Extends:** \`{{extends}}\`
{{/if}}

{{#if (isNotEmpty properties)}}
### Properties

| Name | Type | Visibility | Description |
|------|------|------------|-------------|
{{#each properties}}
| \`{{name}}\` | \`{{type}}\` | {{visibility}} | {{description}} |
{{/each}}
{{/if}}

{{#if (isNotEmpty methods)}}
### Methods

{{#each methods}}
#### {{name}}

\`\`\`typescript
{{name}}{{formatParams parameters}}: {{returnType}}
\`\`\`
{{/each}}
{{/if}}

---
`;
}

function generateDefaultInterfaceTemplate(): string {
  return `## {{name}}

{{#if description}}
{{description}}
{{/if}}

{{#if (isNotEmpty properties)}}
### Properties

| Name | Type | Optional |
|------|------|----------|
{{#each properties}}
| \`{{name}}\` | \`{{type}}\` | {{#if optional}}Yes{{else}}No{{/if}} |
{{/each}}
{{/if}}

---
`;
}

function generateDefaultIndexTemplate(): string {
  return `# {{title}}

> Generated on {{formatDate analysisDate}}

## Overview

- **Total Files:** {{totalFiles}}
- **Functions:** {{functions.length}}
- **Classes:** {{classes.length}}
- **Interfaces:** {{interfaces.length}}

---
`;
}

/**
 * エラーハンドリング
 */
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error: any) {
  if (error.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (error.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red('\n❌ CLI Error:'), error.message);
  process.exit(1);
}

// コマンドが指定されていない場合はヘルプを表示
if (process.argv.length === 2) {
  program.help();
}
