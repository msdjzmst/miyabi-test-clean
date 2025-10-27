#!/usr/bin/env tsx
/**
 * Local Environment Information Collector
 *
 * Collects local environment information and sends to dashboard via webhook
 * Used by Git hooks (pre-push, post-push, etc.)
 *
 * Features:
 * - Git repository information
 * - Commit stats and metadata
 * - System information (OS, Node version, etc.)
 * - Project metrics
 * - Security: excludes secrets and sensitive data
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Types
// ============================================================================

interface LocalEnvPayload {
  event: 'pre-push' | 'post-push' | 'pre-commit' | 'post-commit';
  timestamp: string;
  device: {
    identifier: string;
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  git: {
    branch: string;
    commit: {
      hash: string;
      short_hash: string;
      message: string;
      author: {
        name: string;
        email: string;
      };
      date: string;
    };
    remote: {
      url: string;
      name: string;
    };
    stats: {
      files_changed: number;
      insertions: number;
      deletions: number;
    };
  };
  project: {
    name: string;
    path: string;
    package_version?: string;
  };
}

interface WebhookConfig {
  dashboard_endpoint: string;
  device_identifier: string;
  notifications_enabled: boolean;
  webhook_targets: {
    [key: string]: {
      url: string;
      enabled: boolean;
      events: string[];
    };
  };
  collect_metrics: {
    git_stats: boolean;
    system_info: boolean;
    project_info: boolean;
    timestamp: boolean;
  };
  security: {
    exclude_secrets: boolean;
    exclude_env_vars: boolean;
    sanitize_paths: boolean;
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Execute git command safely
 */
function gitExec(command: string): string {
  try {
    return execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    console.error(`Git command failed: ${command}`, error);
    return '';
  }
}

/**
 * Load webhook configuration
 */
function loadConfig(): WebhookConfig {
  const configPath = path.join(PROJECT_ROOT, '.webhook-config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`.webhook-config.json not found at ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Load package.json version
 */
function getPackageVersion(): string | undefined {
  try {
    const pkgPath = path.join(PROJECT_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return undefined;
  }
}

/**
 * Get git stats for the current commit
 */
function getGitStats(): { files_changed: number; insertions: number; deletions: number } {
  try {
    const diffStat = gitExec('git diff --stat HEAD~1..HEAD');
    const match = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

    if (match) {
      return {
        files_changed: parseInt(match[1] || '0', 10),
        insertions: parseInt(match[2] || '0', 10),
        deletions: parseInt(match[3] || '0', 10),
      };
    }
  } catch (error) {
    // Fallback for initial commit or no previous commits
  }

  return {
    files_changed: 0,
    insertions: 0,
    deletions: 0,
  };
}

/**
 * Sanitize URL to remove credentials
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    // If not a valid URL, remove any potential credentials
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  }
}

// ============================================================================
// Collector
// ============================================================================

class LocalEnvCollector {
  private config: WebhookConfig;

  constructor() {
    this.config = loadConfig();
  }

  /**
   * Collect all local environment information
   */
  collect(event: LocalEnvPayload['event']): LocalEnvPayload {
    const branch = gitExec('git rev-parse --abbrev-ref HEAD');
    const commitHash = gitExec('git rev-parse HEAD');
    const commitShortHash = gitExec('git rev-parse --short HEAD');
    const commitMessage = gitExec('git log -1 --pretty=%B');
    const authorName = gitExec('git log -1 --pretty=%an');
    const authorEmail = gitExec('git log -1 --pretty=%ae');
    const commitDate = gitExec('git log -1 --pretty=%aI');
    const remoteName = gitExec('git remote') || 'origin';
    const remoteUrl = gitExec(`git remote get-url ${remoteName}`);

    const payload: LocalEnvPayload = {
      event,
      timestamp: new Date().toISOString(),
      device: {
        identifier: this.config.device_identifier || os.hostname(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
      git: {
        branch,
        commit: {
          hash: commitHash,
          short_hash: commitShortHash,
          message: commitMessage,
          author: {
            name: authorName,
            email: authorEmail,
          },
          date: commitDate,
        },
        remote: {
          url: this.config.security.sanitize_paths ? sanitizeUrl(remoteUrl) : remoteUrl,
          name: remoteName,
        },
        stats: this.config.collect_metrics.git_stats ? getGitStats() : {
          files_changed: 0,
          insertions: 0,
          deletions: 0,
        },
      },
      project: {
        name: path.basename(PROJECT_ROOT),
        path: this.config.security.sanitize_paths ? '[REDACTED]' : PROJECT_ROOT,
        package_version: this.config.collect_metrics.project_info ? getPackageVersion() : undefined,
      },
    };

    return payload;
  }

  /**
   * Send webhook to configured endpoints
   */
  async sendWebhook(payload: LocalEnvPayload): Promise<void> {
    if (!this.config.notifications_enabled) {
      console.log('🔕 Webhooks disabled in config');
      return;
    }

    const promises: Array<Promise<void>> = [];

    for (const [name, target] of Object.entries(this.config.webhook_targets)) {
      if (!target.enabled || !target.events.includes(payload.event)) {
        continue;
      }

      console.log(`📤 Sending ${payload.event} webhook to ${name}...`);

      promises.push(
        fetch(target.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Miyabi-Event': payload.event,
            'X-Miyabi-Device': payload.device.identifier,
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (response.ok) {
              console.log(`✅ Webhook sent to ${name} (${response.status})`);
            } else {
              console.warn(`⚠️  Webhook to ${name} failed: ${response.status} ${response.statusText}`);
            }
          })
          .catch((error) => {
            console.error(`❌ Failed to send webhook to ${name}:`, error.message);
          }),
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * Run collector and send webhooks
   */
  async run(event: LocalEnvPayload['event']): Promise<void> {
    console.log(`\n🤖 Miyabi Local Environment Collector`);
    console.log(`📋 Event: ${event}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);

    try {
      const payload = this.collect(event);
      console.log(`📦 Collected payload:`);
      console.log(JSON.stringify(payload, null, 2));
      console.log('');

      await this.sendWebhook(payload);

      console.log('\n✨ Done!\n');
    } catch (error) {
      console.error(`\n❌ Error:`, error);
      process.exit(1);
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: local-env-collector.ts <event>');
    console.error('');
    console.error('Events:');
    console.error('  pre-push     - Before git push');
    console.error('  post-push    - After git push');
    console.error('  pre-commit   - Before git commit');
    console.error('  post-commit  - After git commit');
    process.exit(1);
  }

  const event = args[0] as LocalEnvPayload['event'];
  const validEvents = ['pre-push', 'post-push', 'pre-commit', 'post-commit'];

  if (!validEvents.includes(event)) {
    console.error(`❌ Invalid event: ${event}`);
    console.error(`Valid events: ${validEvents.join(', ')}`);
    process.exit(1);
  }

  const collector = new LocalEnvCollector();
  await collector.run(event);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { LocalEnvCollector };
export type { LocalEnvPayload, WebhookConfig };
