#!/usr/bin/env tsx
/**
 * Agentic OS Setup Script
 *
 * 2つのシナリオに対応:
 * 1. 新規プロジェクト: テンプレートとして初期段階から導入
 * 2. 既存プロジェクト: 途中からAgentic OSを取り入れる
 *
 * Usage:
 *   npx tsx scripts/setup-agentic-os.ts
 */

import { logger, theme } from '@miyabi/coding-agents/ui/index';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import * as readline from 'readline/promises';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function ask(question: string): Promise<string> {
  return rl.question(question);
}

interface SetupConfig {
  scenario: 'new' | 'existing';
  projectName: string;
  projectPath: string;
  repoUrl?: string;
  guardianName: string;
  guardianGithub: string;
  budget: number;
}

async function main() {
  logger.clear();

  // ===== ウェルカム =====
  logger.header('🌍 Agentic OS Setup', true);
  logger.newline();

  logger.box(
    `Agentic OSをセットアップします。\n\nこのスクリプトは:\n• 新規プロジェクトのテンプレート作成\n• 既存プロジェクトへの途中導入\n\n両方に対応しています。`,
    {
      title: '✨ セットアップウィザード',
      borderStyle: 'round',
      borderColor: theme.colors.primary,
      padding: 1,
    },
  );

  logger.newline();

  // ===== シナリオ選択 =====
  logger.section('1️⃣', 'シナリオを選択してください');
  logger.newline();

  logger.bullet('1: 新規プロジェクト（テンプレートとして使う）');
  logger.bullet('2: 既存プロジェクト（途中からAgentic OSを導入）');
  logger.newline();

  const scenarioInput = await ask('選択 (1 or 2): ');
  const scenario = scenarioInput === '1' ? 'new' : 'existing';

  logger.newline();

  // ===== プロジェクト情報を収集 =====
  logger.section('2️⃣', 'プロジェクト情報');
  logger.newline();

  const config: SetupConfig = {
    scenario,
    projectName: '',
    projectPath: '',
    guardianName: '',
    guardianGithub: '',
    budget: 500,
  };

  if (scenario === 'new') {
    // 新規プロジェクト
    logger.info('新規プロジェクトを作成します。');
    logger.newline();

    config.projectName = await ask('プロジェクト名: ');
    config.projectPath = path.join(process.cwd(), '..', config.projectName);

    logger.newline();
  } else {
    // 既存プロジェクト
    logger.info('既存プロジェクトにAgentic OSを導入します。');
    logger.newline();

    const currentDir = process.cwd();
    const currentDirName = path.basename(currentDir);

    const useCurrentDir = await ask(
      `現在のディレクトリ (${currentDirName}) に導入しますか？ (yes/no): `,
    );

    if (useCurrentDir.toLowerCase() === 'yes' || useCurrentDir.toLowerCase() === 'y') {
      config.projectPath = currentDir;
      config.projectName = currentDirName;
    } else {
      config.projectPath = await ask('プロジェクトのパス: ');
      config.projectName = path.basename(config.projectPath);
    }

    logger.newline();

    // 既存Gitリポジトリチェック
    if (existsSync(path.join(config.projectPath, '.git'))) {
      logger.success('Gitリポジトリを検出しました。');
      try {
        const remoteUrl = execSync('git remote get-url origin', {
          cwd: config.projectPath,
          encoding: 'utf-8',
        }).trim();
        config.repoUrl = remoteUrl;
        logger.muted(`リモートURL: ${remoteUrl}`);
      } catch (error) {
        logger.warning('リモートリポジトリが設定されていません。');
      }
    } else {
      logger.warning('Gitリポジトリではありません。');
      const initGit = await ask('Gitリポジトリを初期化しますか？ (yes/no): ');
      if (initGit.toLowerCase() === 'yes' || initGit.toLowerCase() === 'y') {
        execSync('git init', { cwd: config.projectPath });
        logger.success('Gitリポジトリを初期化しました。');
      }
    }

    logger.newline();
  }

  // ===== Guardian情報 =====
  logger.section('3️⃣', 'Guardian（管理者）情報');
  logger.newline();

  config.guardianName = await ask('Guardian名（あなたの名前）: ');
  config.guardianGithub = await ask('GitHubユーザー名: ');
  logger.newline();

  // ===== 予算設定 =====
  logger.section('4️⃣', '予算設定');
  logger.newline();

  logger.muted('Claude Code APIの月間予算上限を設定します。');
  const budgetInput = await ask('月間予算（USD, デフォルト: 500）: ');
  config.budget = budgetInput ? parseInt(budgetInput, 10) : 500;

  logger.newline();

  // ===== 確認 =====
  logger.section('5️⃣', '設定内容の確認');
  logger.newline();

  logger.box(
    `シナリオ: ${scenario === 'new' ? '新規プロジェクト' : '既存プロジェクトに導入'}\n\nプロジェクト名: ${config.projectName}\nパス: ${config.projectPath}\n\nGuardian: ${config.guardianName} (@${config.guardianGithub})\n\n月間予算: $${config.budget} USD`,
    {
      title: '📋 設定確認',
      borderStyle: 'round',
      borderColor: theme.colors.info,
      padding: 1,
    },
  );

  logger.newline();

  const confirm = await ask('この内容でセットアップしますか？ (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    logger.warning('キャンセルされました。');
    rl.close();
    return;
  }

  logger.newline();

  // ===== セットアップ実行 =====
  logger.section('🚀', 'セットアップ開始');
  logger.newline();

  if (scenario === 'new') {
    await setupNewProject(config);
  } else {
    await setupExistingProject(config);
  }

  // ===== 完了 =====
  logger.newline();
  logger.divider('heavy');
  logger.newline();

  logger.box(
    `セットアップ完了！\n\n次のステップ:\n\n1. プロジェクトディレクトリに移動:\n   cd ${config.projectPath}\n\n2. 依存関係をインストール:\n   npm install\n\n3. 初心者ガイドを起動:\n   npm start\n\n4. 最初のタスクを作成して実行！`,
    {
      title: '🎉 Success',
      borderStyle: 'bold',
      borderColor: theme.colors.success,
      padding: 1,
    },
  );

  logger.newline();

  logger.section('📚', '参考ドキュメント');
  logger.newline();

  logger.bullet('docs/GETTING_STARTED.md — 超初心者向けガイド');
  logger.bullet('docs/CLAUDE_CODE_TASK_TOOL.md — Task Toolの使い方');
  logger.bullet('.github/WORKFLOW_RULES.md — Issue-Driven Development');
  logger.bullet('AGENTS.md — エージェントの詳細');

  logger.newline();

  rl.close();
}

async function setupNewProject(config: SetupConfig): Promise<void> {
  const spinner = logger.startSpinner('新規プロジェクトを作成中...');

  try {
    // 1. ディレクトリ作成
    if (!existsSync(config.projectPath)) {
      mkdirSync(config.projectPath, { recursive: true });
    }

    // 2. Agentic OSテンプレートをコピー
    const templatePath = process.cwd(); // 現在のAgentic OSディレクトリ
    const filesToCopy = [
      '.github',
      'agents',
      'docs',
      'scripts',
      '.gitignore',
      'package.json',
      'tsconfig.json',
      'AGENTS.md',
      'README.md',
    ];

    for (const file of filesToCopy) {
      const src = path.join(templatePath, file);
      const dest = path.join(config.projectPath, file);

      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
      }
    }

    // 3. カスタマイズファイル生成
    generateCustomFiles(config);

    // 4. Git初期化
    if (!existsSync(path.join(config.projectPath, '.git'))) {
      execSync('git init', { cwd: config.projectPath });
      execSync('git add -A', { cwd: config.projectPath });
      execSync('git commit -m "Initial commit with Agentic OS template"', {
        cwd: config.projectPath,
      });
    }

    logger.stopSpinnerSuccess(spinner, '新規プロジェクト作成完了！');
  } catch (error: any) {
    logger.stopSpinnerFail(spinner, 'エラーが発生しました');
    logger.error('セットアップエラー', error);
    throw error;
  }
}

async function setupExistingProject(config: SetupConfig): Promise<void> {
  const spinner = logger.startSpinner('既存プロジェクトにAgentic OSを統合中...');

  try {
    // 1. 必要なディレクトリ作成
    const dirsToCreate = [
      '.github/workflows',
      '.ai/logs',
      'agents/ui',
      'agents/coordination',
      'docs',
      'scripts',
    ];

    for (const dir of dirsToCreate) {
      const dirPath = path.join(config.projectPath, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    // 2. 必須ファイルをコピー（既存ファイルは上書きしない）
    const templatePath = process.cwd();
    const essentialFiles = [
      // Workflows
      { src: '.github/workflows/project-sync.yml', required: true },
      { src: '.github/WORKFLOW_RULES.md', required: true },
      { src: '.github/GUARDIAN.md', required: true },

      // Agents
      { src: 'agents/ui/index.ts', required: true },
      { src: 'agents/ui/logger.ts', required: true },
      { src: 'agents/ui/theme.ts', required: true },

      // Docs
      { src: 'docs/GETTING_STARTED.md', required: true },
      { src: 'docs/CLAUDE_CODE_TASK_TOOL.md', required: true },
      { src: 'docs/PARALLEL_WORK_ARCHITECTURE.md', required: true },

      // Scripts
      { src: 'scripts/agentic.ts', required: true },
      { src: 'scripts/execute-task.ts', required: true },
      { src: 'scripts/demo-rich-cli.ts', required: false },

      // Core files (マージ必要)
      { src: 'AGENTS.md', required: false },
      { src: 'tsconfig.json', required: false },
    ];

    for (const file of essentialFiles) {
      const src = path.join(templatePath, file.src);
      const dest = path.join(config.projectPath, file.src);

      if (existsSync(src)) {
        if (existsSync(dest) && !file.required) {
          // 既存ファイルはバックアップ
          const backup = `${dest}.agentic-backup`;
          cpSync(dest, backup);
          logger.muted(`  既存ファイルをバックアップ: ${file.src}`);
        }

        cpSync(src, dest, { recursive: file.src.includes('/') });
        logger.muted(`  コピー: ${file.src}`);
      }
    }

    // 3. package.jsonにスクリプト追加
    mergePackageJson(config);

    // 4. カスタマイズファイル生成
    generateCustomFiles(config);

    // 5. Gitコミット
    if (existsSync(path.join(config.projectPath, '.git'))) {
      try {
        execSync('git add -A', { cwd: config.projectPath });
        execSync('git commit -m "feat: integrate Agentic OS framework"', {
          cwd: config.projectPath,
        });
      } catch (error) {
        logger.warning('Gitコミットに失敗しました（手動でコミットしてください）');
      }
    }

    logger.stopSpinnerSuccess(spinner, 'Agentic OS統合完了！');
  } catch (error: any) {
    logger.stopSpinnerFail(spinner, 'エラーが発生しました');
    logger.error('セットアップエラー', error);
    throw error;
  }
}

function generateCustomFiles(config: SetupConfig): void {
  // 1. BUDGET.yml
  const budgetYml = `# Economic Governance — Budget Limits
#
# Circuit Breaker: Automatic shutdown at threshold
# Guardian: Manual approval for critical overages

budget:
  # Monthly budget limit (USD)
  monthly_limit: ${config.budget}

  # Circuit breaker threshold (% of monthly_limit)
  circuit_breaker_threshold: 150

  # Warning threshold (% of monthly_limit)
  warning_threshold: 80

  # Daily budget limit (USD)
  daily_limit: ${Math.round(config.budget / 30)}

guardian:
  # Guardian information
  name: "${config.guardianName}"
  github: "@${config.guardianGithub}"

  # Approval required for costs exceeding (USD)
  approval_threshold: ${Math.round(config.budget * 0.5)}

tracking:
  # Cost tracking enabled
  enabled: true

  # Report frequency
  report_frequency: daily

  # Cost allocation by agent
  per_agent_tracking: true
`;

  writeFileSync(path.join(config.projectPath, 'BUDGET.yml'), budgetYml);

  // 2. .github/GUARDIAN.md
  const guardianMd = `# Guardian Profile

**Guardian**: ${config.guardianName} (@${config.guardianGithub})

## Contact Information

| Channel | URL |
|---------|-----|
| GitHub | https://github.com/${config.guardianGithub} |

## Responsibilities

- Final approval for critical decisions
- Budget oversight
- Security reviews
- Architecture decisions
- Emergency interventions

## Escalation Protocol

### Level 1: Agent Decision
- Agent makes autonomous decision
- No Guardian approval required
- Logged in .ai/logs/

### Level 2: Guardian Review
- Agent creates Draft PR
- Guardian reviews within 24 hours
- Approve or request changes

### Level 3: Guardian Intervention
- Critical security issue
- Budget threshold exceeded
- Architectural change required
- Manual override needed

## Authority Matrix

| Decision | Agent Authority | Guardian Required |
|----------|----------------|-------------------|
| Code changes | ✅ Yes | ❌ No |
| Dependency updates | ✅ Yes | ❌ No |
| Breaking API changes | ⚠️ Draft PR | ✅ Yes |
| Security fixes | ✅ Yes (immediate) | 📋 Post-review |
| Budget >50% | ❌ No | ✅ Yes |
| Architecture changes | ❌ No | ✅ Yes |
| Production deployment | ⚠️ Draft PR | ✅ Yes |

---

Generated by Agentic OS Setup
`;

  writeFileSync(
    path.join(config.projectPath, '.github', 'GUARDIAN.md'),
    guardianMd,
  );

  // 3. README.md (既存があればマージしない)
  const readmePath = path.join(config.projectPath, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeMd = `# ${config.projectName}

> Powered by **Agentic OS** — AI-driven autonomous development platform

## 🌟 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start beginner guide
npm start

# Execute a task
npm run task -- --issue <number>

# See demo
npm run demo
\`\`\`

## 📖 Documentation

- [Getting Started](docs/GETTING_STARTED.md) — 超初心者向けガイド
- [Task Tool Guide](docs/CLAUDE_CODE_TASK_TOOL.md) — Task Toolの使い方
- [Workflow Rules](.github/WORKFLOW_RULES.md) — Issue-Driven Development
- [Agent Constitution](AGENTS.md) — エージェント統治規定

## 🤖 AI Agents

This project uses **6 specialized AI agents** for autonomous development:

- 🎯 **CoordinatorAgent** — Overall coordination
- 💻 **CodeGenAgent** — Code generation
- 🔍 **ReviewAgent** — Code reviews
- 📝 **IssueAgent** — Issue management
- 🔀 **PRAgent** — Pull request management
- 🚀 **DeploymentAgent** — Deployments

## 📊 Budget

Monthly budget: **$${config.budget} USD**
Guardian: **${config.guardianName}** (@${config.guardianGithub})

See [BUDGET.yml](BUDGET.yml) for details.

## 📝 License

MIT

---

🤖 Generated with Agentic OS
`;

    writeFileSync(readmePath, readmeMd);
  }
}

function mergePackageJson(config: SetupConfig): void {
  const packageJsonPath = path.join(config.projectPath, 'package.json');

  let packageJson: any;

  if (existsSync(packageJsonPath)) {
    // 既存package.jsonを読み込み
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  } else {
    // 新規作成
    packageJson = {
      name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: `${config.projectName} powered by Agentic OS`,
      type: 'module',
      scripts: {},
      dependencies: {},
      devDependencies: {},
    };
  }

  // Agentic OS scriptsを追加（既存は上書きしない）
  const agenticScripts = {
    start: 'tsx scripts/agentic.ts',
    task: 'tsx scripts/execute-task.ts',
    demo: 'tsx scripts/demo-rich-cli.ts',
  };

  packageJson.scripts = { ...agenticScripts, ...packageJson.scripts };

  // 必須依存関係を追加
  const requiredDeps = {
    chalk: '^5.3.0',
    ora: '^8.0.1',
    boxen: '^7.1.1',
    'gradient-string': '^2.0.2',
    figlet: '^1.7.0',
    'log-symbols': '^6.0.0',
    'cli-table3': '^0.6.5',
  };

  const requiredDevDeps = {
    tsx: '^4.7.0',
    typescript: '^5.8.3',
    '@types/node': '^20.10.0',
    '@types/figlet': '^1.5.8',
  };

  packageJson.dependencies = { ...packageJson.dependencies, ...requiredDeps };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    ...requiredDevDeps,
  };

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

main().catch((error) => {
  logger.error('セットアップに失敗しました', error);
  rl.close();
  process.exit(1);
});
