/**
 * Non-interactive mode utility
 * 非対話モードユーティリティ
 */

/**
 * Check if running in non-interactive mode
 * 非対話モードで実行中かチェック
 */
export function isNonInteractive(): boolean {
  // Environment variable check
  if (process.env.MIYABI_AUTO_APPROVE === 'true') {
    return true;
  }

  // CI environment detection
  if (process.env.CI === 'true') {
    return true;
  }

  // Non-TTY detection (pipe, redirect, etc.)
  if (!process.stdin.isTTY) {
    return true;
  }

  return false;
}

/**
 * Wrapper for inquirer.prompt with non-interactive support
 * 非対話モード対応のinquirer.promptラッパー
 */
export async function promptOrDefault<T = any>(
  promptFn: () => Promise<T>,
  defaultValue: T,
  options: {
    nonInteractive?: boolean;
    yes?: boolean;
  } = {}
): Promise<T> {
  // Check if non-interactive mode is enabled
  const shouldSkipPrompt = options.nonInteractive || options.yes || isNonInteractive();

  if (shouldSkipPrompt) {
    return defaultValue;
  }

  return promptFn();
}

/**
 * Simple confirm with non-interactive support
 * 非対話モード対応のシンプル確認
 */
export async function confirmOrDefault(
  message: string,
  defaultValue: boolean,
  options: {
    nonInteractive?: boolean;
    yes?: boolean;
  } = {}
): Promise<boolean> {
  const shouldSkipPrompt = options.nonInteractive || options.yes || isNonInteractive();

  if (shouldSkipPrompt) {
    return defaultValue;
  }

  // @ts-ignore - inquirer is an ESM-only module
  const inquirer = (await import('inquirer')).default;

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);

  return confirmed;
}
