/**
 * AIエージェント向け出力ユーティリティ
 * Claude Codeなどのコーディングエージェントが機械可読な形式で結果を取得するための機能
 */

export interface AgentSuccessOutput<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface AgentErrorOutput {
  success: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
    details?: any;
  };
  timestamp: string;
}

export type AgentOutput<T = any> = AgentSuccessOutput<T> | AgentErrorOutput;

/**
 * Exit codes for agent consumption
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  CONFIG_ERROR = 2,      // GITHUB_TOKEN missing, etc.
  VALIDATION_ERROR = 3,  // Directory exists, invalid args, etc.
  NETWORK_ERROR = 4,     // GitHub API unreachable
  AUTH_ERROR = 5,        // Authentication failed
}

/**
 * Check if JSON output is requested
 */
export function isJsonMode(): boolean {
  return process.argv.includes('--json') || process.env.MIYABI_JSON === '1';
}

/**
 * Check if auto-yes mode is enabled
 */
export function isAutoYes(): boolean {
  return process.argv.includes('--yes') ||
         process.argv.includes('-y') ||
         process.env.MIYABI_AUTO_YES === '1' ||
         process.env.CI === 'true';
}

/**
 * Check if verbose mode is enabled
 */
export function isVerbose(): boolean {
  return process.argv.includes('--verbose') ||
         process.argv.includes('-v') ||
         process.env.MIYABI_VERBOSE === '1';
}

/**
 * Output success result
 */
export function outputSuccess<T>(data: T, message?: string): void {
  const output: AgentSuccessOutput<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  if (isJsonMode()) {
    console.log(JSON.stringify(output, null, 2));
  } else if (message) {
    console.log(message);
  }
}

/**
 * Output error and exit
 */
export function outputError(
  code: string,
  message: string,
  recoverable: boolean = true,
  suggestion?: string,
  details?: any
): never {
  const output: AgentErrorOutput = {
    success: false,
    error: {
      code,
      message,
      recoverable,
      suggestion,
      details,
    },
    timestamp: new Date().toISOString(),
  };

  if (isJsonMode()) {
    console.error(JSON.stringify(output, null, 2));
  } else {
    console.error(`❌ ${message}`);
    if (suggestion) {
      console.error(`\n💡 ${suggestion}`);
    }
  }

  const exitCode = getExitCodeFromError(code);
  process.exit(exitCode);
}

/**
 * Map error code to exit code
 */
function getExitCodeFromError(errorCode: string): ExitCode {
  if (errorCode.includes('GITHUB_TOKEN') || errorCode.includes('CONFIG')) {
    return ExitCode.CONFIG_ERROR;
  }
  if (errorCode.includes('VALIDATION') || errorCode.includes('EXISTS')) {
    return ExitCode.VALIDATION_ERROR;
  }
  if (errorCode.includes('NETWORK') || errorCode.includes('API')) {
    return ExitCode.NETWORK_ERROR;
  }
  if (errorCode.includes('AUTH')) {
    return ExitCode.AUTH_ERROR;
  }
  return ExitCode.GENERAL_ERROR;
}

/**
 * Log verbose message
 */
export function logVerbose(message: string, data?: any): void {
  if (isVerbose() && !isJsonMode()) {
    console.log(`[VERBOSE] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Log debug message
 */
export function logDebug(message: string, data?: any): void {
  if (process.env.MIYABI_DEBUG === '1' && !isJsonMode()) {
    console.log(`[DEBUG] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Confirm action with user (or auto-yes in agent mode)
 */
export async function confirmAction(message: string, defaultValue: boolean = false): Promise<boolean> {
  if (isAutoYes()) {
    logVerbose(`Auto-confirmed: ${message}`);
    return true;
  }

  if (isJsonMode()) {
    // JSONモードでは確認できないのでエラー
    outputError(
      'INTERACTIVE_NOT_SUPPORTED',
      'Interactive prompts are not supported in JSON mode',
      true,
      'Use --yes flag to auto-confirm'
    );
  }

  // 対話型確認（既存のinquirerなどを使用）
  const inquirer = await import('inquirer');
  const { confirm } = await inquirer.default.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message,
      default: defaultValue,
    },
  ]);

  return confirm;
}

/**
 * Get GitHub token from environment or config
 */
export function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    outputError(
      'MISSING_GITHUB_TOKEN',
      'GITHUB_TOKEN not found in environment',
      true,
      'Set GITHUB_TOKEN environment variable: export GITHUB_TOKEN=ghp_xxx'
    );
  }

  return token;
}
