#!/usr/bin/env tsx
/**
 * Claude Headless並列実行デモ
 *
 * 複数のIssueを並列処理するシナリオのデモ
 */

import { ClaudeHeadless } from './claude-headless.js';
import chalk from 'chalk';
import ora from 'ora';

interface Task {
  id: number;
  title: string;
  prompt: string;
}

/**
 * 並列実行のデモ
 */
async function parallelExecutionDemo() {
  console.log(chalk.bold.blue('\n🚀 Claude Headless 並列実行デモ\n'));

  // シミュレーション: 5つのIssueを並列処理
  const tasks: Task[] = [
    {
      id: 1,
      title: 'TypeScriptの型定義',
      prompt: 'TypeScriptの型安全性を1行で説明して',
    },
    {
      id: 2,
      title: 'ESLint設定',
      prompt: 'ESLintの役割を1行で説明して',
    },
    {
      id: 3,
      title: 'Git Worktree',
      prompt: 'Git Worktreeのメリットを1行で説明して',
    },
    {
      id: 4,
      title: 'MCP統合',
      prompt: 'Model Context Protocolの目的を1行で説明して',
    },
    {
      id: 5,
      title: 'Agent System',
      prompt: '自律型Agentの特徴を1行で説明して',
    },
  ];

  console.log(chalk.bold('📋 処理対象タスク:\n'));
  tasks.forEach(task => {
    console.log(chalk.gray(`  ${task.id}. ${task.title}`));
  });
  console.log('');

  const startTime = Date.now();
  const spinner = ora('並列実行中...').start();

  try {
    // 並列実行
    const results = await Promise.all(
      tasks.map(async (task) => {
        const client = new ClaudeHeadless();

        try {
          const result = await client.execute({
            prompt: task.prompt,
            maxTokens: 200,
            enableMCP: false,
            verbose: false,
          });

          return {
            taskId: task.id,
            title: task.title,
            result: result.trim(),
            success: true,
          };
        } catch (error) {
          return {
            taskId: task.id,
            title: task.title,
            error: String(error),
            success: false,
          };
        } finally {
          await client.close();
        }
      }),
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    spinner.succeed(chalk.green(`✅ 並列実行完了 (${duration}秒)`));

    // 結果を表示
    console.log(chalk.bold('\n📊 実行結果:\n'));

    results.forEach(({ taskId, title, result, error, success }) => {
      if (success) {
        console.log(chalk.green(`✅ Task ${taskId}: ${title}`));
        console.log(chalk.gray(`   ${result}`));
        console.log('');
      } else {
        console.log(chalk.red(`❌ Task ${taskId}: ${title}`));
        console.log(chalk.gray(`   エラー: ${error}`));
        console.log('');
      }
    });

    // 統計情報
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(chalk.bold('📈 統計情報:\n'));
    console.log(chalk.gray(`  総タスク数: ${tasks.length}`));
    console.log(chalk.green(`  成功: ${successCount}`));
    if (failureCount > 0) {
      console.log(chalk.red(`  失敗: ${failureCount}`));
    }
    console.log(chalk.gray(`  実行時間: ${duration}秒`));
    console.log(chalk.gray(`  平均時間/タスク: ${(parseFloat(duration) / tasks.length).toFixed(2)}秒`));
    console.log('');

    // コスト効果の計算
    console.log(chalk.bold('💰 コスト効果分析:\n'));
    console.log(chalk.gray('  並列実行により、直列実行と比較して:'));
    console.log(chalk.green(`  ⚡ 実行時間: ${duration}秒 (直列なら ~${(parseFloat(duration) * tasks.length).toFixed(1)}秒)`));
    console.log(chalk.green(`  ⚡ 時間短縮: ~${((1 - 1 / tasks.length) * 100).toFixed(0)}%`));
    console.log(chalk.gray('  💵 API コスト: 同じ (並列でも直列でも同額)'));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red('❌ 並列実行失敗'));
    console.error(error);
    process.exit(1);
  }
}

/**
 * 並行数制限付き並列実行のデモ
 */
async function limitedConcurrencyDemo() {
  console.log(chalk.bold.blue('\n🚀 並行数制限付き並列実行デモ\n'));

  const tasks: Task[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    title: `Task ${i + 1}`,
    prompt: `数字 ${i + 1} の意味を1行で説明して`,
  }));

  const concurrency = 3; // 同時実行数を3に制限

  console.log(chalk.bold(`📋 ${tasks.length}個のタスクを同時実行数${concurrency}で処理\n`));

  const startTime = Date.now();
  const spinner = ora('並列実行中...').start();

  try {
    const results = [];

    // 同時実行数を制限
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (task) => {
          const client = new ClaudeHeadless();

          try {
            const result = await client.execute({
              prompt: task.prompt,
              maxTokens: 100,
              enableMCP: false,
              verbose: false,
            });

            return {
              taskId: task.id,
              result: result.trim(),
              success: true,
            };
          } catch (error) {
            return {
              taskId: task.id,
              error: String(error),
              success: false,
            };
          } finally {
            await client.close();
          }
        }),
      );

      results.push(...batchResults);

      spinner.text = `処理中... ${results.length}/${tasks.length} 完了`;
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    spinner.succeed(chalk.green(`✅ 全タスク完了 (${duration}秒)`));

    const successCount = results.filter(r => r.success).length;

    console.log(chalk.bold('\n📈 統計情報:\n'));
    console.log(chalk.gray(`  総タスク数: ${tasks.length}`));
    console.log(chalk.green(`  成功: ${successCount}`));
    console.log(chalk.gray(`  同時実行数: ${concurrency}`));
    console.log(chalk.gray(`  実行時間: ${duration}秒`));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red('❌ 並列実行失敗'));
    console.error(error);
    process.exit(1);
  }
}

/**
 * メイン実行
 */
async function main() {
  const mode = process.argv[2];

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('\n❌ エラー: ANTHROPIC_API_KEY環境変数が設定されていません\n'));
    process.exit(1);
  }

  try {
    switch (mode) {
      case 'parallel':
        await parallelExecutionDemo();
        break;
      case 'limited':
        await limitedConcurrencyDemo();
        break;
      default:
        console.log(chalk.bold.blue('🚀 Claude Headless 並列実行デモ\n'));
        console.log('使用方法:');
        console.log('  tsx scripts/tools/claude-parallel-demo.ts <mode>\n');
        console.log('モード:');
        console.log('  parallel  - 完全並列実行（5タスク）');
        console.log('  limited   - 並行数制限付き実行（10タスク、同時3実行）\n');
        console.log('例:');
        console.log('  tsx scripts/tools/claude-parallel-demo.ts parallel\n');
        break;
    }
  } catch (error) {
    console.error(chalk.red('\n❌ エラーが発生しました:'), error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
