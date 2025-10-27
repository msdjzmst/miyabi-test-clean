/**
 * Configuration loader module
 *
 * Loads configuration from .miyabi.yml or .miyabirc
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface MiyabiConfig {
  // GitHub settings
  github?: {
    token?: string;
    defaultPrivate?: boolean;
    defaultOrg?: string;
  };

  // Project settings
  project?: {
    defaultLanguage?: string;
    defaultFramework?: string;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
  };

  // Label settings
  labels?: {
    custom?: Array<{
      name: string;
      color: string;
      description: string;
    }>;
  };

  // Workflow settings
  workflows?: {
    autoLabel?: boolean;
    autoReview?: boolean;
    autoSync?: boolean;
  };

  // CLI settings
  cli?: {
    language?: 'ja' | 'en';
    theme?: 'default' | 'minimal';
    verboseErrors?: boolean;
  };
}

/**
 * Load configuration from file
 */
export function loadConfig(options: { silent?: boolean } = {}): MiyabiConfig {
  const configPaths = [
    path.join(process.cwd(), '.miyabi.yml'),
    path.join(process.cwd(), '.miyabirc'),
    path.join(process.cwd(), '.miyabi.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');

        // Parse YAML or JSON
        let config: MiyabiConfig;
        if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
          config = parseYaml(content) as MiyabiConfig;
        } else {
          config = JSON.parse(content) as MiyabiConfig;
        }

        if (!options.silent) {
          console.log(`✓ 設定ファイルを読み込みました: ${configPath}`);
        }
        return config;
      } catch (error) {
        if (!options.silent) {
          console.warn(`⚠️  設定ファイルの読み込みに失敗: ${configPath}`);
          if (error instanceof Error) {
            console.warn(`   ${error.message}`);
          }
        }
      }
    }
  }

  // Return default config if no file found
  return getDefaultConfig();
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): MiyabiConfig {
  return {
    github: {
      defaultPrivate: false,
    },
    project: {
      gitignoreTemplate: 'Node',
      licenseTemplate: 'mit',
    },
    workflows: {
      autoLabel: true,
      autoReview: true,
      autoSync: true,
    },
    cli: {
      language: 'ja',
      theme: 'default',
      verboseErrors: true,
    },
  };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: MiyabiConfig, format: 'yaml' | 'json' = 'yaml'): void {
  const configPath = format === 'yaml'
    ? path.join(process.cwd(), '.miyabi.yml')
    : path.join(process.cwd(), '.miyabirc');

  try {
    let content: string;
    if (format === 'yaml') {
      content = stringifyYaml(config);
    } else {
      content = JSON.stringify(config, null, 2);
    }

    fs.writeFileSync(configPath, content, 'utf-8');
    console.log(`✓ 設定ファイルを保存しました: ${configPath}`);
  } catch (error) {
    console.error(`✗ 設定ファイルの保存に失敗: ${error}`);
    throw error;
  }
}

/**
 * Merge user config with default config
 */
export function mergeConfig(userConfig: Partial<MiyabiConfig>): MiyabiConfig {
  const defaultConfig = getDefaultConfig();

  return {
    github: { ...defaultConfig.github, ...userConfig.github },
    project: { ...defaultConfig.project, ...userConfig.project },
    labels: { ...defaultConfig.labels, ...userConfig.labels },
    workflows: { ...defaultConfig.workflows, ...userConfig.workflows },
    cli: { ...defaultConfig.cli, ...userConfig.cli },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: MiyabiConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate GitHub token format
  if (config.github?.token) {
    if (!config.github.token.startsWith('ghp_') && !config.github.token.startsWith('github_pat_')) {
      errors.push('GitHub token format is invalid (should start with ghp_ or github_pat_)');
    }
  }

  // Validate language
  if (config.cli?.language && !['ja', 'en'].includes(config.cli.language)) {
    errors.push('CLI language must be "ja" or "en"');
  }

  // Validate theme
  if (config.cli?.theme && !['default', 'minimal'].includes(config.cli.theme)) {
    errors.push('CLI theme must be "default" or "minimal"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Apply configuration to environment
 * Sets environment variables from config file
 */
export function applyConfigToEnvironment(config: MiyabiConfig): void {
  // Set GITHUB_TOKEN from config if not already set
  if (config.github?.token && !process.env.GITHUB_TOKEN) {
    process.env.GITHUB_TOKEN = config.github.token;
  }
}
