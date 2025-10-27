#!/usr/bin/env tsx
/**
 * GitHub Token Setup Helper
 *
 * Interactive script to help users set up their GitHub token with correct scopes
 */

import { logger, theme } from '@miyabi/coding-agents/ui/index';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import * as readline from 'readline/promises';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function ask(question: string): Promise<string> {
  return rl.question(question);
}

const REQUIRED_SCOPES = [
  { name: 'repo', description: 'リポジトリへのフルアクセス（必須）' },
  { name: 'workflow', description: 'GitHub Actions ワークフローの管理（必須）' },
  { name: 'read:project', description: 'GitHub Projects V2 の読み取り（必須）' },
  { name: 'write:project', description: 'GitHub Projects V2 への書き込み（必須）' },
];

const OPTIONAL_SCOPES = [
  { name: 'notifications', description: '通知へのアクセス' },
  { name: 'read:org', description: 'Organization 情報の読み取り' },
];

async function checkGhCli(): Promise<boolean> {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function getGhToken(): Promise<string | null> {
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    return token;
  } catch {
    return null;
  }
}

async function checkTokenScopes(token: string): Promise<{ scopes: string[], valid: boolean }> {
  try {
    const result = execSync(
      `curl -sI -H "Authorization: token ${token}" https://api.github.com/user`,
      { encoding: 'utf-8' },
    );

    const scopeLine = result.split('\n').find(line => line.toLowerCase().startsWith('x-oauth-scopes:'));
    if (!scopeLine) {
      return { scopes: [], valid: false };
    }

    const scopes = scopeLine
      .split(':')[1]
      .trim()
      .split(',')
      .map(s => s.trim())
      .filter(s => s);

    const hasRequired = REQUIRED_SCOPES.every(req =>
      scopes.some(scope => scope === req.name || scope.startsWith(`${req.name  }:`)),
    );

    return { scopes, valid: hasRequired };
  } catch (error) {
    logger.error('Token の検証に失敗しました', error as Error);
    return { scopes: [], valid: false };
  }
}

function getEnvPath(): string {
  return path.join(process.cwd(), '.env');
}

function loadEnvFile(): Record<string, string> {
  const envPath = getEnvPath();
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });

  return env;
}

function saveEnvFile(env: Record<string, string>): void {
  const envPath = getEnvPath();
  const content = `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')  }\n`;

  writeFileSync(envPath, content, 'utf-8');
  logger.success(`.env ファイルを更新しました: ${envPath}`);
}

async function main() {
  logger.clear();

  // ===== ヘッダー =====
  logger.header('🔑 GitHub Token セットアップ');

  logger.info('このスクリプトは GitHub Token の設定をサポートします。');
  logger.newline();

  // ===== 現在の状態を確認 =====
  logger.section('📊', '現在の設定を確認中...');

  const hasGh = await checkGhCli();
  const envToken = process.env.GITHUB_TOKEN;
  const ghToken = hasGh ? await getGhToken() : null;

  logger.newline();
  logger.keyValue('gh CLI', hasGh ? '✓ インストール済み' : '✗ 未インストール', hasGh ? theme.colors.success : theme.colors.error);
  logger.keyValue('環境変数 GITHUB_TOKEN', envToken ? '✓ 設定済み' : '✗ 未設定', envToken ? theme.colors.success : theme.colors.warning);
  logger.keyValue('gh auth token', ghToken ? '✓ 認証済み' : '✗ 未認証', ghToken ? theme.colors.success : theme.colors.warning);

  logger.newline();
  logger.divider();

  // ===== Token のチェック =====
  const tokenToCheck = envToken || ghToken;

  if (tokenToCheck) {
    logger.section('🔍', 'Token のスコープを検証中...');
    logger.newline();

    const { scopes, valid } = await checkTokenScopes(tokenToCheck);

    if (valid) {
      logger.success('✓ Token には必要なスコープが全て含まれています！');
      logger.newline();
      logger.muted('検出されたスコープ:');
      scopes.forEach(scope => {
        logger.bullet(scope, 1);
      });
      logger.newline();
      logger.success('セットアップ完了！プロジェクト管理機能を使用できます。');
      rl.close();
      return;
    } else {
      logger.warning('⚠ Token に必要なスコープが不足しています');
      logger.newline();
      logger.muted('現在のスコープ:');
      scopes.forEach(scope => {
        logger.bullet(scope, 1);
      });
      logger.newline();
    }
  }

  // ===== 必要なスコープを表示 =====
  logger.section('📋', '必要なスコープ');
  logger.newline();

  logger.subheader('必須:');
  REQUIRED_SCOPES.forEach(({ name, description }) => {
    logger.bullet(`${theme.symbols.squareFilled} ${name} - ${description}`, 0);
  });

  logger.newline();
  logger.subheader('推奨:');
  OPTIONAL_SCOPES.forEach(({ name, description }) => {
    logger.bullet(`${theme.symbols.square} ${name} - ${description}`, 0);
  });

  logger.newline();
  logger.divider();

  // ===== Token 作成手順 =====
  logger.section('🛠️', 'Token 作成手順');
  logger.newline();

  logger.log('1. ブラウザで以下の URL を開いてください:');
  logger.indent();
  logger.info('https://github.com/settings/tokens/new');
  logger.outdent();
  logger.newline();

  logger.log('2. Token 名を入力（例: Autonomous Operations）');
  logger.newline();

  logger.log('3. 有効期限を選択（推奨: 90 days 以上）');
  logger.newline();

  logger.log('4. 以下のスコープを選択:');
  logger.indent();
  REQUIRED_SCOPES.forEach(({ name }) => {
    logger.bullet(`✅ ${name}`, 0);
  });
  logger.outdent();
  logger.newline();

  logger.log('5. "Generate token" をクリックして Token を生成');
  logger.newline();

  logger.log('6. 生成された Token をコピー（ghp_ で始まる文字列）');
  logger.newline();

  logger.divider();
  logger.newline();

  // ===== Token 入力 =====
  const answer = await ask('Token を作成しましたか？ (y/n): ');

  if (answer.toLowerCase() !== 'y') {
    logger.info('Token 作成後、再度このスクリプトを実行してください。');
    logger.newline();
    logger.muted('詳細なガイド: docs/GITHUB_TOKEN_SETUP.md');
    rl.close();
    return;
  }

  logger.newline();
  const token = await ask('Token を貼り付けてください (ghp_...): ');

  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    logger.error('無効な Token 形式です。Token は "ghp_" または "github_pat_" で始まる必要があります。');
    rl.close();
    return;
  }

  logger.newline();
  logger.info('Token を検証中...');

  const { scopes, valid } = await checkTokenScopes(token);

  logger.newline();

  if (!valid) {
    logger.error('⚠ Token に必要なスコープが不足しています');
    logger.newline();
    logger.muted('検出されたスコープ:');
    scopes.forEach(scope => {
      logger.bullet(scope, 1);
    });
    logger.newline();
    logger.warning('Token を再生成し、必要なスコープを全て追加してください。');
    rl.close();
    return;
  }

  logger.success('✓ Token の検証に成功しました！');
  logger.newline();

  // ===== .env ファイルに保存 =====
  const saveAnswer = await ask('.env ファイルに保存しますか？ (y/n): ');

  if (saveAnswer.toLowerCase() === 'y') {
    const env = loadEnvFile();
    env['GITHUB_TOKEN'] = token;
    saveEnvFile(env);
    logger.newline();
    logger.success('✓ セットアップ完了！');
    logger.newline();
    logger.info('以下のコマンドで機能をテストできます:');
    logger.indent();
    logger.bullet('npm run project:info', 0);
    logger.bullet('npm run project:add', 0);
    logger.bullet('npm run project:report', 0);
    logger.outdent();
  } else {
    logger.newline();
    logger.info('環境変数を手動で設定してください:');
    logger.newline();
    logger.muted('Linux/macOS:');
    logger.indent();
    logger.log(`export GITHUB_TOKEN=${token}`);
    logger.outdent();
    logger.newline();
    logger.muted('または .env ファイルに追加:');
    logger.indent();
    logger.log(`GITHUB_TOKEN=${token}`);
    logger.outdent();
  }

  logger.newline();
  logger.divider();
  logger.newline();
  logger.success('🎉 GitHub Token のセットアップが完了しました！');

  rl.close();
}

main().catch(error => {
  logger.error('エラーが発生しました', error);
  rl.close();
  process.exit(1);
});
