/**
 * Water Spider Main Entry Point
 *
 * Start Water Spider monitoring system
 *
 * Usage:
 *   npm run water-spider:start
 */

import { WaterSpiderAgent } from '@miyabi/coding-agents/water-spider/water-spider-agent';
import type { WaterSpiderConfig } from '@miyabi/coding-agents/water-spider/water-spider-agent';
import { startServer as startWebhookServer } from './webhook/webhook-server';
import { TmuxManager } from './tmux/tmux-manager';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🕷️  Miyabi Water Spider - Auto-Continue System         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      await startWaterSpider();
      break;

    case 'create-sessions':
      console.log('📋 Creating tmux sessions for all worktrees...');
      TmuxManager.createAllSessions();
      break;

    case 'kill-sessions':
      console.log('🛑 Killing all Miyabi tmux sessions...');
      TmuxManager.killAllSessions();
      break;

    case 'list':
      console.log('📋 Listing all tmux sessions...');
      TmuxManager.listSessions();
      break;

    case 'webhook-only':
      console.log('🌐 Starting webhook server only...');
      startWebhookServer();
      break;

    default:
      console.log('Water Spider - Miyabi Auto-Continue System');
      console.log('');
      console.log('Commands:');
      console.log('  start             Start Water Spider monitoring (default)');
      console.log('  create-sessions   Create tmux sessions for all worktrees');
      console.log('  kill-sessions     Kill all Miyabi tmux sessions');
      console.log('  list              List all tmux sessions');
      console.log('  webhook-only      Start webhook server only');
      console.log('');
      process.exit(1);
  }
}

async function startWaterSpider(): Promise<void> {
  console.log('🚀 Starting Water Spider monitoring system...');
  console.log('');

  // 1. Start webhook server
  console.log('1️⃣ Starting webhook server...');
  startWebhookServer();
  await sleep(1000); // Wait for server to start

  // 2. Create tmux sessions for all worktrees
  console.log('');
  console.log('2️⃣ Creating tmux sessions...');
  TmuxManager.createAllSessions();
  await sleep(2000); // Wait for sessions to initialize

  // 3. Start Water Spider Agent
  console.log('');
  console.log('3️⃣ Starting Water Spider Agent...');

  const config: WaterSpiderConfig = {
    deviceIdentifier: process.env.DEVICE_IDENTIFIER || 'localhost',
    githubToken: process.env.GITHUB_TOKEN || '',
    useTaskTool: false,
    useWorktree: true,
    logDirectory: './logs',
    reportDirectory: './reports',
    monitorInterval: 5000, // Check every 5 seconds
    maxIdleTime: 30000, // 30 seconds idle = trigger continue
    autoRestart: true,
    webhookUrl: 'http://localhost:3002',
  };

  const waterSpider = new WaterSpiderAgent(config);

  // Create dummy task to satisfy BaseAgent interface
  const task = {
    id: 'water-spider-monitoring',
    title: 'Water Spider Auto-Continue Monitoring',
    description: 'Monitor and auto-continue Claude Code sessions',
    type: 'deployment' as const,
    priority: 0,
    severity: 'Sev.3-Medium' as const,
    impact: 'High' as const,
    assignedAgent: 'WaterSpiderAgent' as const,
    dependencies: [],
    estimatedDuration: 0,
    status: 'running' as const,
  };

  await waterSpider.execute(task);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✅ Water Spider is now monitoring all sessions');
  console.log('');
  console.log('📊 Monitoring Dashboard:');
  console.log('   http://localhost:3002/api/sessions');
  console.log('');
  console.log('🔄 Auto-Continue: Enabled (every 5 seconds)');
  console.log('⏱️  Max Idle Time: 30 seconds');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 Stopping Water Spider...');
    await waterSpider.stop();
    console.log('✅ Water Spider stopped');
    process.exit(0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
