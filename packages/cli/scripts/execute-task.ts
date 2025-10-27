#!/usr/bin/env tsx
/**
 * Task Executor — 自動タスク実行ツール
 *
 * GitHub Issueから自動的にタスクを読み込み、
 * Claude Code Task Toolを使って実行します
 *
 * Usage:
 *   npx tsx scripts/execute-task.ts --issue 4
 */

import { logger, theme } from '@miyabi/coding-agents/ui/index';
import { execSync } from 'child_process';
import * as readline from 'readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function ask(question: string): Promise<string> {
  return await rl.question(question);
}

interface Task {
  issueNumber: number;
  title: string;
  description: string;
  labels: string[];
  assignees: string[];
  state: string;
}

async function fetchIssue(issueNumber: number): Promise<Task | null> {
  try {
    const issueJson = execSync(
      `gh issue view ${issueNumber} --json number,title,body,labels,assignees,state`,
      { encoding: 'utf-8' }
    );

    const issue = JSON.parse(issueJson);

    return {
      issueNumber: issue.number,
      title: issue.title,
      description: issue.body || '',
      labels: issue.labels.map((l: any) => l.name),
      assignees: issue.assignees.map((a: any) => a.login),
      state: issue.state,
    };
  } catch (error: any) {
    return null;
  }
}

function analyzeTask(task: Task): {
  subagentType: string;
  estimatedTime: number;
  complexity: string;
} {
  // ラベルから判定
  const labels = task.labels.map((l) => l.toLowerCase());

  let subagentType = 'general-purpose';
  let complexity = 'medium';
  let estimatedTime = 120;

  if (labels.some((l) => l.includes('research') || l.includes('investigation'))) {
    estimatedTime = 60;
    complexity = 'low';
  }

  if (labels.some((l) => l.includes('critical') || l.includes('urgent'))) {
    complexity = 'high';
    estimatedTime = 240;
  }

  if (task.title.toLowerCase().includes('implement')) {
    estimatedTime = 180;
    complexity = 'high';
  }

  return {
    subagentType,
    estimatedTime,
    complexity,
  };
}

async function main() {
  logger.clear();

  // ===== ヘッダー =====
  logger.header('🤖 Agentic OS — Task Executor', true);
  logger.newline();

  // ===== 引数チェック =====
  const args = process.argv.slice(2);
  let issueNumber: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--issue' && args[i + 1]) {
      issueNumber = parseInt(args[i + 1], 10);
    }
  }

  if (!issueNumber) {
    logger.error('Issue番号を指定してください。');
    logger.newline();
    logger.info('使い方:');
    logger.muted('  npx tsx scripts/execute-task.ts --issue 4');
    logger.newline();
    rl.close();
    return;
  }

  // ===== Issueを取得 =====
  logger.section('📥', `Issue #${issueNumber}を読み込んでいます...`);
  logger.newline();

  const spinner = logger.startSpinner('GitHub Issueを取得中...');

  const task = await fetchIssue(issueNumber);

  if (!task) {
    logger.stopSpinnerFail(spinner, `Issue #${issueNumber}が見つかりませんでした`);
    logger.newline();
    logger.error('GitHub CLIでIssueが取得できませんでした。');
    logger.info('確認事項:');
    logger.bullet('GitHub CLIがインストールされていますか？ (gh --version)');
    logger.bullet('GitHub CLIでログインしていますか？ (gh auth status)');
    logger.bullet(`Issue #${issueNumber}は存在しますか？`);
    logger.newline();
    rl.close();
    return;
  }

  logger.stopSpinnerSuccess(spinner, 'Issue取得完了');
  logger.newline();

  // ===== Issueの表示 =====
  logger.box(
    `${task.title}\n\n${task.description.substring(0, 200)}${task.description.length > 200 ? '...' : ''}`,
    {
      title: `📋 Issue #${task.issueNumber}`,
      borderStyle: 'round',
      borderColor: theme.colors.info,
      padding: 1,
    }
  );

  logger.newline();

  // ===== タスク分析 =====
  logger.section('🔍', 'タスクを分析しています...');
  logger.newline();

  const analysis = analyzeTask(task);

  logger.keyValue('Agent種類', analysis.subagentType, theme.colors.agent);
  logger.keyValue('推定時間', `${analysis.estimatedTime}分`, theme.colors.info);
  logger.keyValue('複雑度', analysis.complexity, theme.colors.warning);
  logger.keyValue('状態', task.state, theme.colors.success);

  if (task.labels.length > 0) {
    logger.keyValue('ラベル', task.labels.join(', '), theme.colors.muted);
  }

  logger.newline();

  // ===== 実行確認 =====
  logger.divider('light');
  logger.newline();

  logger.section('⚡', 'Task Tool実行の準備完了');
  logger.newline();

  logger.box(
    `これから、Claude Code Task Toolを使って\nこのタスクを自動実行します。\n\nAgentが自動的に:\n• コードを生成・修正\n• テストを実行\n• Pull Requestを作成\n\n所要時間: 約${analysis.estimatedTime}分`,
    {
      title: '🚀 実行内容',
      borderStyle: 'round',
      borderColor: theme.colors.primary,
      padding: 1,
    }
  );

  logger.newline();

  const confirm = await ask('実行しますか？ (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    logger.warning('キャンセルされました。');
    logger.newline();
    rl.close();
    return;
  }

  logger.newline();

  // ===== Claude Code Task Toolの説明 =====
  logger.section('📖', 'Claude Code Task Toolについて');
  logger.newline();

  logger.box(
    `Task Toolは、Agentに仕事を依頼する仕組みです。\n\n⚠️  重要な注意点:\n\n1. このスクリプトは「準備」だけを行います\n2. 実際のAgent起動は、Claude Codeのチャットで行います\n3. 以下の手順に従ってください`,
    {
      title: '⚠️  注意',
      borderStyle: 'round',
      borderColor: theme.colors.warning,
      padding: 1,
    }
  );

  logger.newline();

  // ===== Task Tool起動ガイド =====
  logger.section('📋', '次のステップ（重要！）');
  logger.newline();

  const taskPrompt = generateTaskPrompt(task, analysis);

  logger.box(
    `Claude Codeのチャットで、以下をコピー&ペーストしてください:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nIssue #${task.issueNumber}を実行してください。\n\nタスク詳細:\n${taskPrompt}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nこれをコピーして、Claude Codeに送信してください！`,
    {
      title: '📝 コピー用テキスト',
      borderStyle: 'bold',
      borderColor: theme.colors.success,
      padding: 1,
    }
  );

  logger.newline();

  // ===== 次のアクション =====
  logger.divider('light');
  logger.newline();

  logger.section('✨', '実行後の流れ');
  logger.newline();

  logger.bullet('1. Claude Codeがタスクを解析');
  logger.bullet('2. 適切なAgentが自動起動');
  logger.bullet('3. Agentがコードを生成・テスト実行');
  logger.bullet('4. Pull Requestが自動作成される');
  logger.bullet('5. Guardianがレビュー');
  logger.bullet('6. 承認されたらマージ');
  logger.newline();

  logger.success('準備完了！Claude Codeでタスクを実行してください！');
  logger.newline();

  // ===== ヘルプ =====
  logger.divider('light');
  logger.newline();

  logger.section('❓', 'わからないことがあったら');
  logger.newline();

  logger.bullet('docs/CLAUDE_CODE_TASK_TOOL.md — Task Toolの詳細ガイド');
  logger.bullet('docs/PARALLEL_WORK_ARCHITECTURE.md — 並行作業の仕組み');
  logger.bullet('.github/WORKFLOW_RULES.md — ワークフロールール');
  logger.newline();

  rl.close();
}

function generateTaskPrompt(task: Task, analysis: any): string {
  return `
タイトル: ${task.title}

説明:
${task.description}

推定時間: ${analysis.estimatedTime}分
複雑度: ${analysis.complexity}

以下の手順で実行してください:
1. Issue #${task.issueNumber}の要件を確認
2. 必要なファイルを作成・修正
3. TypeScript strict modeでコードを書く
4. ユニットテストを作成（カバレッジ>80%）
5. 全テストがパスすることを確認
6. Pull Requestを作成

参考資料:
- .github/WORKFLOW_RULES.md
- docs/CLAUDE_CODE_TASK_TOOL.md
`;
}

main().catch((error) => {
  logger.error('エラーが発生しました', error);
  rl.close();
  process.exit(1);
});
