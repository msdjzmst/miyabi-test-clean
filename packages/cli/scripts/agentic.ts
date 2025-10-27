#!/usr/bin/env tsx
/**
 * Agentic OS — Beginner-Friendly CLI
 *
 * 超初心者でも使える、自動ガイド付きCLIツール
 * Claude Code、Agent、Task toolの概念を自動的に説明し、使い方を誘導
 *
 * Usage:
 *   npx tsx scripts/agentic.ts
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

async function main() {
  logger.clear();

  // ===== ウェルカムバナー =====
  logger.header('🌍 Agentic OS へようこそ！', true);
  logger.newline();

  logger.box(
    `このツールは、Claude Codeを使った自動開発を\n超初心者でも簡単に始められるように設計されています。\n\n専門知識は一切不要です！\n質問に答えるだけで、AIエージェントが自動的に作業を進めます。`,
    {
      title: '✨ 初心者に優しい自動ガイド',
      borderStyle: 'round',
      borderColor: theme.colors.success,
      padding: 1,
    }
  );

  logger.newline();

  // ===== ステップ1: 環境チェック =====
  logger.section('1️⃣', 'Step 1: 環境をチェックしています...');
  logger.newline();

  const checks = [
    { name: 'Node.js', command: 'node --version', required: true },
    { name: 'npm', command: 'npm --version', required: true },
    { name: 'Git', command: 'git --version', required: true },
    { name: 'GitHub CLI', command: 'gh --version', required: false },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const version = execSync(check.command, { encoding: 'utf-8' }).trim();
      logger.success(`${check.name}: ${version.split('\n')[0]}`);
    } catch (error) {
      if (check.required) {
        logger.error(`${check.name}: インストールされていません`);
        allPassed = false;
      } else {
        logger.warning(`${check.name}: インストールされていません (オプション)`);
      }
    }
  }

  logger.newline();

  if (!allPassed) {
    logger.error('必要なツールがインストールされていません。');
    logger.muted('以下をインストールしてから再実行してください:');
    logger.bullet('Node.js: https://nodejs.org/');
    logger.bullet('Git: https://git-scm.com/');
    process.exit(1);
  }

  logger.success('すべての環境チェックに合格しました！');
  logger.newline();
  logger.divider('light');
  logger.newline();

  // ===== ステップ2: Claude Codeの説明 =====
  logger.section('2️⃣', 'Step 2: Claude Codeとは？');
  logger.newline();

  logger.box(
    `Claude Codeは、AIがコードを書いてくれる強力なツールです。\n\n特徴:\n• コードの自動生成\n• バグの自動修正\n• ドキュメントの自動作成\n• テストの自動実行\n\nあなたは「何をしたいか」を伝えるだけ！\nClaude Codeが自動的に作業を進めます。`,
    {
      title: '🤖 Claude Code',
      borderStyle: 'round',
      borderColor: theme.colors.info,
      padding: 1,
    }
  );

  logger.newline();

  const understand1 = await ask('理解できましたか？ (yes/no): ');
  if (understand1.toLowerCase() !== 'yes' && understand1.toLowerCase() !== 'y') {
    logger.info('もっと詳しく知りたい場合は、以下をご覧ください:');
    logger.bullet('Claude Code公式ドキュメント: https://docs.claude.com/claude-code');
    logger.newline();
  }

  logger.divider('light');
  logger.newline();

  // ===== ステップ3: Agentの説明 =====
  logger.section('3️⃣', 'Step 3: AI Agentとは？');
  logger.newline();

  logger.box(
    `AI Agentは、特定のタスクを自動的に実行するAIです。\n\nAgentic OSには6種類のAgentがいます:\n\n🎯 CoordinatorAgent - 全体の調整役\n💻 CodeGenAgent - コードを書く専門家\n🔍 ReviewAgent - コードレビューの専門家\n📝 IssueAgent - Issue管理の専門家\n🔀 PRAgent - Pull Request管理の専門家\n🚀 DeploymentAgent - デプロイの専門家\n\nAgentは並行で動くので、複数の作業が同時に進みます！`,
    {
      title: '🤖 AI Agent',
      borderStyle: 'round',
      borderColor: theme.colors.agent,
      padding: 1,
    }
  );

  logger.newline();

  const understand2 = await ask('理解できましたか？ (yes/no): ');
  if (understand2.toLowerCase() !== 'yes' && understand2.toLowerCase() !== 'y') {
    logger.info('詳細はこちら:');
    logger.bullet('AGENTS.md: プロジェクトルートのAGENTS.mdファイルをご覧ください');
    logger.newline();
  }

  logger.divider('light');
  logger.newline();

  // ===== ステップ4: Task Toolの説明 =====
  logger.section('4️⃣', 'Step 4: Task Toolとは？');
  logger.newline();

  logger.box(
    `Task Toolは、Agentに仕事を依頼する仕組みです。\n\n使い方:\n1. やりたいことを説明する\n2. Task Toolが自動的にAgentを起動\n3. Agentが作業を実行\n4. 結果が報告される\n\nあなたは「何をしたいか」を説明するだけ！\n後は全部自動です。`,
    {
      title: '🛠️ Task Tool',
      borderStyle: 'round',
      borderColor: theme.colors.primary,
      padding: 1,
    }
  );

  logger.newline();

  const understand3 = await ask('理解できましたか？ (yes/no): ');
  if (understand3.toLowerCase() !== 'yes' && understand3.toLowerCase() !== 'y') {
    logger.info('詳細はこちら:');
    logger.bullet('docs/CLAUDE_CODE_TASK_TOOL.md: 詳しい使い方が書いてあります');
    logger.newline();
  }

  logger.divider('light');
  logger.newline();

  // ===== ステップ5: 最初のタスクを作成 =====
  logger.section('5️⃣', 'Step 5: 最初のタスクを作成しましょう！');
  logger.newline();

  logger.info('これから、あなたの最初のタスクを作成します。');
  logger.muted('心配しないでください！質問に答えるだけで大丈夫です。');
  logger.newline();

  // ===== 質問1: 何をしたいか =====
  logger.keyValue('質問 1/5', '何を作りたいですか？', theme.colors.primary);
  logger.muted('例: ログイン機能、ダッシュボード、APIエンドポイント など');
  const taskTitle = await ask('>> ');
  logger.newline();

  // ===== 質問2: 詳細 =====
  logger.keyValue('質問 2/5', 'もう少し詳しく教えてください', theme.colors.primary);
  logger.muted('例: ユーザー名とパスワードでログインできるようにしたい');
  const taskDescription = await ask('>> ');
  logger.newline();

  // ===== 質問3: 優先度 =====
  logger.keyValue('質問 3/5', 'どのくらい急ぎですか？', theme.colors.primary);
  logger.muted('1: すぐやりたい / 2: できれば早めに / 3: 時間があるとき');
  const priorityInput = await ask('>> ');
  const priorityMap: Record<string, string> = {
    '1': 'critical',
    '2': 'high',
    '3': 'medium',
  };
  const priority = priorityMap[priorityInput] || 'medium';
  logger.newline();

  // ===== 質問4: 推定時間 =====
  logger.keyValue('質問 4/5', 'どのくらい時間がかかりそうですか？', theme.colors.primary);
  logger.muted('1: 1時間以内 / 2: 数時間 / 3: 1日くらい / 4: わからない');
  const timeInput = await ask('>> ');
  const timeMap: Record<string, number> = {
    '1': 60,
    '2': 180,
    '3': 480,
    '4': 240,
  };
  const estimatedTime = timeMap[timeInput] || 240;
  logger.newline();

  // ===== 質問5: 確認 =====
  logger.keyValue('質問 5/5', '確認', theme.colors.primary);
  logger.newline();

  logger.box(
    `タイトル: ${taskTitle}\n\n説明: ${taskDescription}\n\n優先度: ${priority}\n\n推定時間: ${estimatedTime}分`,
    {
      title: '📋 タスク内容',
      borderStyle: 'round',
      borderColor: theme.colors.info,
      padding: 1,
    }
  );

  logger.newline();
  const confirm = await ask('この内容でGitHub Issueを作成しますか？ (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    logger.warning('キャンセルされました。');
    rl.close();
    return;
  }

  logger.newline();

  // ===== GitHub Issueを作成 =====
  logger.section('🚀', 'GitHub Issueを作成しています...');
  logger.newline();

  const spinner = logger.startSpinner('Issue作成中...');

  try {
    // Check if gh is available
    execSync('gh --version', { stdio: 'ignore' });

    const issueBody = `
## 📋 概要
${taskDescription}

## 📊 詳細情報
- **優先度**: ${priority}
- **推定時間**: ${estimatedTime}分
- **作成者**: 初心者ガイド (agentic.ts)

## ✅ 実行方法
このIssueは、Claude Code Task Toolを使って自動的に実行されます。

\`\`\`bash
# Task Toolで実行
npx tsx scripts/execute-task.ts --issue <issue-number>
\`\`\`

## 📖 参考資料
- [Workflow Rules](.github/WORKFLOW_RULES.md)
- [Task Tool Guide](docs/CLAUDE_CODE_TASK_TOOL.md)

---

🤖 Generated by Agentic OS Beginner Guide
`;

    const issueUrl = execSync(
      `gh issue create --title "${taskTitle}" --body "${issueBody.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8' }
    ).trim();

    logger.stopSpinnerSuccess(spinner, 'Issue作成完了！');
    logger.newline();

    logger.success(`Issue URL: ${issueUrl}`);
    logger.newline();

    // ===== 次のステップ =====
    logger.section('🎉', '完成！次のステップ');
    logger.newline();

    logger.box(
      `おめでとうございます！\n最初のIssueが作成されました！\n\n次にやること:\n\n1️⃣ Claude Codeを起動\n2️⃣ 以下のコマンドを実行:\n\n   npx tsx scripts/execute-task.ts --issue ${issueUrl.split('/').pop()}\n\n3️⃣ Agentが自動的に作業を開始します！\n\nあとは待つだけです。\nAgentが完了したら通知が来ます。`,
      {
        title: '✨ Success',
        borderStyle: 'bold',
        borderColor: theme.colors.success,
        padding: 1,
      }
    );

    logger.newline();

    // ===== チュートリアルモード =====
    const tutorial = await ask('このまま自動実行を開始しますか？ (yes/no): ');

    if (tutorial.toLowerCase() === 'yes' || tutorial.toLowerCase() === 'y') {
      logger.newline();
      logger.section('🤖', 'Task Toolを起動しています...');
      logger.newline();

      logger.info(
        'Claude Code Task Toolが自動的にAgentを起動し、作業を開始します。'
      );
      logger.muted('これには数分〜数十分かかる場合があります。');
      logger.newline();

      const issueNumber = issueUrl.split('/').pop();

      logger.box(
        `次のステップ:\n\n1. Claude Codeのチャットで以下をリクエストしてください:\n\n   "Issue #${issueNumber}を実行して"\n\n2. Agentが自動的に:\n   • コードを生成\n   • テストを実行\n   • Pull Requestを作成\n\n3. 完了したら通知が来ます！`,
        {
          title: '📖 次にやること',
          borderStyle: 'round',
          borderColor: theme.colors.primary,
          padding: 1,
        }
      );

      logger.newline();
    }
  } catch (error: any) {
    logger.stopSpinnerFail(spinner, 'Issue作成に失敗しました');
    logger.newline();

    if (error.message.includes('gh: command not found')) {
      logger.warning('GitHub CLIがインストールされていません。');
      logger.newline();
      logger.info('手動でIssueを作成してください:');
      logger.bullet(`タイトル: ${taskTitle}`);
      logger.bullet(`説明: ${taskDescription}`);
      logger.bullet(`優先度: ${priority}`);
      logger.newline();
    } else {
      logger.error('エラー', error);
    }
  }

  // ===== ヘルプ情報 =====
  logger.divider('light');
  logger.newline();

  logger.section('❓', 'わからないことがあったら');
  logger.newline();

  logger.bullet('GitHub Issues: プロジェクトのIssuesタブで質問');
  logger.bullet('ドキュメント: docs/ フォルダに詳しいガイドがあります');
  logger.bullet('Guardian: @ShunsukeHayashi に連絡');
  logger.newline();

  logger.box(
    `🌟 Agentic OSへようこそ！\n\nこれからAIと一緒に、素晴らしいものを作りましょう！`,
    {
      title: '🎉 スタート！',
      borderStyle: 'bold',
      borderColor: theme.colors.success,
      padding: 1,
      align: 'center',
    }
  );

  logger.newline();

  rl.close();
}

main().catch((error) => {
  logger.error('エラーが発生しました', error);
  process.exit(1);
});
