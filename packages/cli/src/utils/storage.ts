/**
 * Agent Output Storage
 *
 * Agent間でデータを共有するためのストレージ
 * ~/.miyabi/storage/ にIssue単位でデータを保存
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

/**
 * ストレージのベースディレクトリ
 */
function getStorageDir(): string {
  return path.join(os.homedir(), '.miyabi', 'storage');
}

/**
 * Issue用のディレクトリパスを取得
 */
function getIssueDir(owner: string, repo: string, issueNumber: number): string {
  return path.join(getStorageDir(), `${owner}-${repo}`, `issue-${issueNumber}`);
}

/**
 * ディレクトリが存在しない場合は作成
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 }); // rwx------
  }
}

/**
 * CodeGenAgentの出力を保存
 */
export function saveCodeGenOutput(
  owner: string,
  repo: string,
  issueNumber: number,
  output: any
): void {
  const issueDir = getIssueDir(owner, repo, issueNumber);
  ensureDir(issueDir);

  const filePath = path.join(issueDir, 'codegen-output.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), {
    encoding: 'utf-8',
    mode: 0o600, // rw-------
  });

  console.log(chalk.gray(`✓ CodeGen output saved: ${filePath}`));
}

/**
 * CodeGenAgentの出力を読み込み
 */
export function loadCodeGenOutput(
  owner: string,
  repo: string,
  issueNumber: number
): any | null {
  const filePath = path.join(getIssueDir(owner, repo, issueNumber), 'codegen-output.json');

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Failed to load CodeGen output: ${error}`));
    return null;
  }
}

/**
 * ReviewAgentの出力を保存
 */
export function saveReviewOutput(
  owner: string,
  repo: string,
  issueNumber: number,
  output: any
): void {
  const issueDir = getIssueDir(owner, repo, issueNumber);
  ensureDir(issueDir);

  const filePath = path.join(issueDir, 'review-output.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), {
    encoding: 'utf-8',
    mode: 0o600, // rw-------
  });

  console.log(chalk.gray(`✓ Review output saved: ${filePath}`));
}

/**
 * ReviewAgentの出力を読み込み
 */
export function loadReviewOutput(
  owner: string,
  repo: string,
  issueNumber: number
): any | null {
  const filePath = path.join(getIssueDir(owner, repo, issueNumber), 'review-output.json');

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Failed to load Review output: ${error}`));
    return null;
  }
}

/**
 * Issue用のストレージをクリア
 */
export function clearIssueStorage(
  owner: string,
  repo: string,
  issueNumber: number
): void {
  const issueDir = getIssueDir(owner, repo, issueNumber);

  if (fs.existsSync(issueDir)) {
    fs.rmSync(issueDir, { recursive: true, force: true });
    console.log(chalk.gray(`✓ Cleared storage for issue #${issueNumber}`));
  }
}

/**
 * ストレージの状態を確認
 */
export function checkIssueStorage(
  owner: string,
  repo: string,
  issueNumber: number
): {
  hasCodeGen: boolean;
  hasReview: boolean;
} {
  const issueDir = getIssueDir(owner, repo, issueNumber);
  const codegenPath = path.join(issueDir, 'codegen-output.json');
  const reviewPath = path.join(issueDir, 'review-output.json');

  return {
    hasCodeGen: fs.existsSync(codegenPath),
    hasReview: fs.existsSync(reviewPath),
  };
}
