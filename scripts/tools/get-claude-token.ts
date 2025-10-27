#!/usr/bin/env tsx
/**
 * Claude Code OAuth Token取得スクリプト
 *
 * Claude Codeの内部認証トークンを取得します。
 * このトークンは claude-headless.ts で使用できます。
 *
 * 注意: このトークンは期限があります（通常24時間）
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

interface ClaudeConfig {
  auth?: {
    sessionToken?: string;
    apiKey?: string;
    oauth?: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  };
}

/**
 * Claude Codeの設定ファイルを探す
 */
function findClaudeConfig(): string | null {
  const possiblePaths = [
    // Claude Code設定の可能性のあるパス
    join(homedir(), '.claude', 'config.json'),
    join(homedir(), '.config', 'claude', 'config.json'),
    join(homedir(), '.anthropic', 'config.json'),
    join(homedir(), 'Library', 'Application Support', 'Claude', 'config.json'),
    join(homedir(), 'Library', 'Application Support', 'claude-code', 'config.json'),
    // VS Code拡張の設定
    join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'anthropics.claude-code'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log(chalk.green(`✅ 設定ファイル発見: ${path}`));
      return path;
    }
  }

  return null;
}

/**
 * Claude Codeのセッショントークンを探す
 */
function findSessionToken(): string | null {
  // VS Code拡張のストレージを探す
  const vscodeStorage = join(
    homedir(),
    'Library',
    'Application Support',
    'Code',
    'User',
    'globalStorage',
    'anthropics.claude-code',
  );

  if (existsSync(vscodeStorage)) {
    console.log(chalk.blue(`📂 VS Code拡張ストレージ: ${vscodeStorage}`));

    try {
      const files = readdirSync(vscodeStorage);
      console.log(chalk.gray(`  ファイル数: ${files.length}`));

      // state.vscstateファイルを探す
      const stateFile = files.find(f => f.includes('state') || f.endsWith('.json'));
      if (stateFile) {
        const statePath = join(vscodeStorage, stateFile);
        console.log(chalk.blue(`  状態ファイル: ${stateFile}`));

        const content = readFileSync(statePath, 'utf-8');
        const data = JSON.parse(content);

        // トークンを探す
        if (data.auth?.accessToken) {
          return data.auth.accessToken;
        }
        if (data.sessionToken) {
          return data.sessionToken;
        }
      }
    } catch (error) {
      console.error(chalk.yellow(`⚠️  ストレージ読み込みエラー: ${error}`));
    }
  }

  return null;
}

/**
 * 環境変数からトークンを取得
 */
function getTokenFromEnv(): string | null {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
}

/**
 * トークンの有効性を確認
 */
function validateToken(token: string): boolean {
  // トークンの形式を確認
  if (!token || token.length < 20) {
    return false;
  }

  // Anthropicのトークン形式
  // sk-ant-api03-... (APIキー)
  // sk-ant-oat01-... (OAuthトークン)
  const validPrefixes = ['sk-ant-api', 'sk-ant-oat'];
  return validPrefixes.some(prefix => token.startsWith(prefix));
}

/**
 * メイン実行
 */
async function main() {
  console.log(chalk.bold.blue('\n🔑 Claude Code OAuth Token 取得ツール\n'));

  // 1. 環境変数をチェック
  console.log(chalk.bold('1️⃣  環境変数をチェック...'));
  const envToken = getTokenFromEnv();
  if (envToken) {
    console.log(chalk.green('✅ ANTHROPIC_API_KEY が見つかりました'));
    console.log(chalk.gray(`   ${envToken.substring(0, 20)}...`));

    if (validateToken(envToken)) {
      console.log(chalk.green('✅ トークン形式は有効です'));
    } else {
      console.log(chalk.yellow('⚠️  トークン形式が無効な可能性があります'));
    }
  } else {
    console.log(chalk.yellow('⚠️  環境変数にトークンが見つかりません'));
  }

  // 2. 設定ファイルをチェック
  console.log(chalk.bold('\n2️⃣  設定ファイルをチェック...'));
  const configPath = findClaudeConfig();
  if (configPath) {
    try {
      const config: ClaudeConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

      if (config.auth?.oauth?.accessToken) {
        console.log(chalk.green('✅ OAuthアクセストークンが見つかりました'));
        console.log(chalk.gray(`   ${config.auth.oauth.accessToken.substring(0, 20)}...`));

        if (config.auth.oauth.expiresAt) {
          const expiresAt = new Date(config.auth.oauth.expiresAt);
          const now = new Date();
          if (expiresAt > now) {
            console.log(chalk.green(`✅ 有効期限: ${expiresAt.toLocaleString()}`));
          } else {
            console.log(chalk.red(`❌ 有効期限切れ: ${expiresAt.toLocaleString()}`));
          }
        }
      }

      if (config.auth?.apiKey) {
        console.log(chalk.green('✅ APIキーが見つかりました'));
        console.log(chalk.gray(`   ${config.auth.apiKey.substring(0, 20)}...`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ 設定ファイル読み込みエラー: ${error}`));
    }
  } else {
    console.log(chalk.yellow('⚠️  設定ファイルが見つかりません'));
  }

  // 3. セッショントークンをチェック
  console.log(chalk.bold('\n3️⃣  セッショントークンをチェック...'));
  const sessionToken = findSessionToken();
  if (sessionToken) {
    console.log(chalk.green('✅ セッショントークンが見つかりました'));
    console.log(chalk.gray(`   ${sessionToken.substring(0, 20)}...`));

    if (validateToken(sessionToken)) {
      console.log(chalk.green('✅ トークン形式は有効です'));
    }
  } else {
    console.log(chalk.yellow('⚠️  セッショントークンが見つかりません'));
  }

  // 推奨アクション
  console.log(chalk.bold('\n📋 推奨アクション:\n'));

  if (!envToken && !configPath && !sessionToken) {
    console.log(chalk.yellow('⚠️  トークンが見つかりません。以下の方法でAPIキーを取得してください:\n'));
    console.log('1. Anthropic Console でAPIキーを作成');
    console.log('   https://console.anthropic.com/account/keys\n');
    console.log('2. 環境変数に設定');
    console.log('   export ANTHROPIC_API_KEY="sk-ant-api03-..."\\n');
    console.log('3. .envファイルに追加');
    console.log('   echo "ANTHROPIC_API_KEY=sk-ant-api03-..." >> .env\n');
  } else if (envToken && !validateToken(envToken)) {
    console.log(chalk.yellow('⚠️  現在のトークンは無効です。新しいAPIキーを取得してください。'));
  } else if (envToken && validateToken(envToken)) {
    console.log(chalk.green('✅ トークンは利用可能です。以下のコマンドで実行できます:\n'));
    console.log('   npm run claude-headless -- "プロンプト"\n');
  }

  console.log(chalk.gray('\n注意: OAuthトークン (sk-ant-oat01-) は期限付きです。'));
  console.log(chalk.gray('長期利用には APIキー (sk-ant-api03-) の使用を推奨します。\n'));
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('\n❌ エラーが発生しました:'), error);
    process.exit(1);
  });
}
