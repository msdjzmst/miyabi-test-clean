#!/usr/bin/env tsx
/**
 * Local Environment Collector
 *
 * Collects local development environment information and sends to dashboard webhook.
 * Called by Git hooks (pre-push, post-push, pre-commit, post-commit).
 *
 * Usage:
 *   tsx scripts/local-env-collector.ts <event-type>
 *
 * Event types:
 *   - pre-push: Before git push
 *   - post-push: After git push
 *   - pre-commit: Before git commit
 *   - post-commit: After git commit
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

interface WebhookConfig {
  dashboard_endpoint: string;
  device_identifier: string;
  notifications_enabled: boolean;
  webhook_targets: {
    dashboard_server: {
      url: string;
      enabled: boolean;
      events: string[];
    };
    slack?: {
      url: string;
      enabled: boolean;
      events: string[];
    };
    discord?: {
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

interface WebhookPayload {
  event: string;
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
    };
  };
  project: {
    name: string;
    path: string;
  };
}

/**
 * Load webhook configuration
 */
function loadConfig(): WebhookConfig | null {
  try {
    const configPath = join(PROJECT_ROOT, '.webhook-config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error('❌ Failed to load .webhook-config.json:', error);
    return null;
  }
}

/**
 * Execute git command and return output
 */
function gitCommand(command: string): string {
  try {
    return execSync(command, { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Collect local environment information
 */
function collectEnvironment(eventType: string): WebhookPayload {
  const config = loadConfig();

  // Git information
  const branch = gitCommand('git rev-parse --abbrev-ref HEAD');
  const commitHash = gitCommand('git rev-parse HEAD');
  const commitShortHash = gitCommand('git rev-parse --short HEAD');
  const commitMessage = gitCommand('git log -1 --pretty=%B');

  // Device information
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;
  const deviceIdentifier = config?.device_identifier || hostname;

  // Project information
  const projectName = 'Miyabi'; // Could be read from package.json
  const projectPath = PROJECT_ROOT;

  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    device: {
      identifier: deviceIdentifier,
      hostname,
      platform,
      arch,
      nodeVersion,
    },
    git: {
      branch,
      commit: {
        hash: commitHash,
        short_hash: commitShortHash,
        message: commitMessage,
      },
    },
    project: {
      name: projectName,
      path: projectPath,
    },
  };
}

/**
 * Send webhook to dashboard
 */
async function sendWebhook(payload: WebhookPayload, url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`❌ Webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const result = await response.json();
    console.log('✅ Webhook sent successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ Webhook request failed:', error);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  const eventType = process.argv[2];

  if (!eventType) {
    console.error('❌ Usage: tsx local-env-collector.ts <event-type>');
    console.error('   Event types: pre-push, post-push, pre-commit, post-commit');
    process.exit(1);
  }

  const validEvents = ['pre-push', 'post-push', 'pre-commit', 'post-commit'];
  if (!validEvents.includes(eventType)) {
    console.error(`❌ Invalid event type: ${eventType}`);
    console.error(`   Valid types: ${validEvents.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔍 Collecting local environment for event: ${eventType}`);

  // Load configuration
  const config = loadConfig();
  if (!config) {
    console.error('❌ Failed to load webhook configuration');
    process.exit(1);
  }

  // Check if dashboard webhook is enabled
  const dashboardTarget = config.webhook_targets.dashboard_server;
  if (!dashboardTarget.enabled) {
    console.log('⚠️  Dashboard webhook is disabled');
    process.exit(0);
  }

  // Check if this event is enabled
  if (!dashboardTarget.events.includes(eventType)) {
    console.log(`⚠️  Event '${eventType}' is not enabled in webhook configuration`);
    process.exit(0);
  }

  // Collect environment data
  const payload = collectEnvironment(eventType);

  console.log('\n📊 Collected Data:');
  console.log(`   Event: ${payload.event}`);
  console.log(`   Device: ${payload.device.identifier}`);
  console.log(`   Branch: ${payload.git.branch}`);
  console.log(`   Commit: ${payload.git.commit.short_hash}`);
  console.log(`   Time: ${payload.timestamp}`);

  // Send webhook
  console.log(`\n📤 Sending webhook to: ${dashboardTarget.url}`);
  const success = await sendWebhook(payload, dashboardTarget.url);

  if (!success) {
    console.error('❌ Failed to send webhook');
    process.exit(1);
  }

  console.log('✅ Webhook sent successfully\n');
  process.exit(0);
}

// Execute
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
