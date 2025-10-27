#!/usr/bin/env tsx
/**
 * Claude Headless Mode - 実行例
 *
 * このスクリプトは、ヘッドレスモードでClaude Codeを使用する
 * プログラマティックな例を示しています。
 */

import { ClaudeHeadless } from './claude-headless.js';

/**
 * 例1: 基本的な使用方法
 */
async function example1BasicUsage() {
  console.log('\n=== 例1: 基本的な使用方法 ===\n');

  const client = new ClaudeHeadless();

  try {
    const result = await client.execute({
      prompt: 'このプロジェクトの主な機能を3つ挙げて',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
      temperature: 1.0,
      enableMCP: false, // MCPツールを無効化
      verbose: true,
    });

    console.log('\n結果:');
    console.log(result);
  } finally {
    await client.close();
  }
}

/**
 * 例2: MCPツールを使用
 */
async function example2WithMCP() {
  console.log('\n=== 例2: MCPツールを使用 ===\n');

  const client = new ClaudeHeadless();

  try {
    // 特定のMCPサーバーに接続
    await client.connectMCP(['project-context', 'filesystem']);

    const result = await client.execute({
      prompt: 'プロジェクトの構造を説明して',
      maxTokens: 2048,
      enableMCP: true,
      verbose: true,
    });

    console.log('\n結果:');
    console.log(result);
  } finally {
    await client.close();
  }
}

/**
 * 例3: カスタムシステムプロンプト
 */
async function example3CustomSystem() {
  console.log('\n=== 例3: カスタムシステムプロンプト ===\n');

  const client = new ClaudeHeadless();

  try {
    const result = await client.execute({
      prompt: 'コードレビューのベストプラクティスを教えて',
      systemPrompt: 'あなたは経験豊富なシニアエンジニアです。コードレビューの専門家として回答してください。',
      maxTokens: 2048,
      temperature: 0.7,
      enableMCP: false,
      verbose: true,
    });

    console.log('\n結果:');
    console.log(result);
  } finally {
    await client.close();
  }
}

/**
 * 例4: エラーハンドリング
 */
async function example4ErrorHandling() {
  console.log('\n=== 例4: エラーハンドリング ===\n');

  const client = new ClaudeHeadless();

  try {
    const result = await client.execute({
      prompt: 'テスト用プロンプト',
      maxTokens: 100,
      verbose: true,
    });

    console.log('\n成功:', result);
  } catch (error) {
    console.error('\nエラーが発生しました:');
    if (error instanceof Error) {
      console.error('メッセージ:', error.message);
      console.error('スタック:', error.stack);
    } else {
      console.error(error);
    }
  } finally {
    await client.close();
  }
}

/**
 * 例5: 並列実行
 */
async function example5Parallel() {
  console.log('\n=== 例5: 並列実行 ===\n');

  const prompts = [
    'TypeScriptのベストプラクティスを1つ教えて',
    'ESLintの推奨設定を説明して',
    'Vitestの使い方を簡単に説明して',
  ];

  // 各プロンプトに対して並列実行
  const results = await Promise.all(
    prompts.map(async (prompt) => {
      const client = new ClaudeHeadless();
      try {
        const result = await client.execute({
          prompt,
          maxTokens: 500,
          enableMCP: false,
          verbose: false,
        });
        return { prompt, result };
      } catch (error) {
        return { prompt, error: String(error) };
      } finally {
        await client.close();
      }
    }),
  );

  console.log('\n結果:');
  results.forEach(({ prompt, result, error }, index) => {
    console.log(`\n${index + 1}. ${prompt}`);
    if (error) {
      console.log('エラー:', error);
    } else {
      console.log('結果:', result);
    }
  });
}

/**
 * メイン実行
 */
async function main() {
  const exampleNumber = process.argv[2];

  // ANTHROPIC_API_KEYチェック
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n❌ エラー: ANTHROPIC_API_KEY環境変数が設定されていません\n');
    console.log('使用方法:');
    console.log('  export ANTHROPIC_API_KEY="your-api-key"');
    console.log('  tsx scripts/tools/claude-headless-example.ts [例番号]\n');
    process.exit(1);
  }

  console.log('🚀 Claude Headless Mode - 実行例\n');

  try {
    switch (exampleNumber) {
      case '1':
        await example1BasicUsage();
        break;
      case '2':
        await example2WithMCP();
        break;
      case '3':
        await example3CustomSystem();
        break;
      case '4':
        await example4ErrorHandling();
        break;
      case '5':
        await example5Parallel();
        break;
      default:
        console.log('利用可能な例:');
        console.log('  1 - 基本的な使用方法');
        console.log('  2 - MCPツールを使用');
        console.log('  3 - カスタムシステムプロンプト');
        console.log('  4 - エラーハンドリング');
        console.log('  5 - 並列実行\n');
        console.log('使用方法:');
        console.log('  tsx scripts/tools/claude-headless-example.ts <例番号>\n');
        console.log('例:');
        console.log('  tsx scripts/tools/claude-headless-example.ts 1\n');
        break;
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
