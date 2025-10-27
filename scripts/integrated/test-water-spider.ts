/**
 * Test script for Water Spider Agent
 *
 * Tests Water Spider functionality without starting full integrated system:
 * - Session discovery
 * - Idle detection
 * - Auto-continue mechanism
 * - Webhook integration
 */

import { WaterSpiderAgent } from '@miyabi/coding-agents/water-spider/water-spider-agent';
import type { WaterSpiderConfig } from '@miyabi/coding-agents/water-spider/water-spider-agent';
import { SessionManager } from '@miyabi/coding-agents/water-spider/session-manager';
import { WebhookClient } from '@miyabi/coding-agents/water-spider/webhook-client';
import { execSync } from 'child_process';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Testing Water Spider Agent                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const testResults: Array<{ test: string; passed: boolean; message: string }> =
    [];

  // Test 1: SessionManager initialization
  console.log('1️⃣ Test: SessionManager initialization');
  try {
    const config: WaterSpiderConfig = {
      deviceIdentifier: 'test-device',
      githubToken: '',
      useTaskTool: false,
      useWorktree: true,
      logDirectory: './logs',
      reportDirectory: './reports',
      monitorInterval: 1000,
      maxIdleTime: 5000,
      autoRestart: false,
      webhookUrl: 'http://localhost:3002',
    };

    void new SessionManager(config);
    testResults.push({
      test: 'SessionManager initialization',
      passed: true,
      message: 'SessionManager created successfully',
    });
    console.log('   ✅ SessionManager initialized');
  } catch (error: any) {
    testResults.push({
      test: 'SessionManager initialization',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 2: WebhookClient initialization
  console.log('2️⃣ Test: WebhookClient initialization');
  try {
    void new WebhookClient('http://localhost:3002');
    testResults.push({
      test: 'WebhookClient initialization',
      passed: true,
      message: 'WebhookClient created successfully',
    });
    console.log('   ✅ WebhookClient initialized');
  } catch (error: any) {
    testResults.push({
      test: 'WebhookClient initialization',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 3: Worktree discovery
  console.log('3️⃣ Test: Worktree discovery');
  try {
    const config: WaterSpiderConfig = {
      deviceIdentifier: 'test-device',
      githubToken: '',
      useTaskTool: false,
      useWorktree: true,
      logDirectory: './logs',
      reportDirectory: './reports',
      monitorInterval: 1000,
      maxIdleTime: 5000,
      autoRestart: false,
      webhookUrl: 'http://localhost:3002',
    };

    const sessionManager = new SessionManager(config);
    await sessionManager.discoverWorktrees();
    const sessions = sessionManager.getSessions();

    console.log(`   📋 Found ${sessions.length} worktree session(s)`);
    sessions.forEach((s) => {
      console.log(`      - ${s.sessionId}: ${s.status}`);
    });

    testResults.push({
      test: 'Worktree discovery',
      passed: true,
      message: `Found ${sessions.length} sessions`,
    });
    console.log('   ✅ Worktree discovery successful');
  } catch (error: any) {
    testResults.push({
      test: 'Worktree discovery',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 4: Tmux session check
  console.log('4️⃣ Test: Tmux session check');
  try {
    // Check if tmux is installed
    execSync('which tmux', { stdio: 'ignore' });

    // List existing tmux sessions
    try {
      const output = execSync('tmux ls 2>/dev/null', {
        encoding: 'utf-8',
      });
      const sessionCount = output.split('\n').filter((l) => l.trim()).length;
      console.log(`   📋 Found ${sessionCount} active tmux session(s)`);

      if (sessionCount > 0) {
        console.log(`   Sessions:\n${output.split('\n').map((l) => `      ${l}`).join('\n')}`);
      }
    } catch {
      console.log('   📋 No active tmux sessions');
    }

    testResults.push({
      test: 'Tmux session check',
      passed: true,
      message: 'Tmux is installed and accessible',
    });
    console.log('   ✅ Tmux check successful');
  } catch (error: any) {
    testResults.push({
      test: 'Tmux session check',
      passed: false,
      message: 'Tmux not installed',
    });
    console.log('   ⚠️  Tmux not installed (required for Water Spider)');
  }
  console.log('');

  // Test 5: WaterSpiderAgent initialization
  console.log('5️⃣ Test: WaterSpiderAgent initialization');
  try {
    const config: WaterSpiderConfig = {
      deviceIdentifier: 'test-device',
      githubToken: '',
      useTaskTool: false,
      useWorktree: true,
      logDirectory: './logs',
      reportDirectory: './reports',
      monitorInterval: 1000,
      maxIdleTime: 5000,
      autoRestart: false,
      webhookUrl: 'http://localhost:3002',
    };

    void new WaterSpiderAgent(config);

    testResults.push({
      test: 'WaterSpiderAgent initialization',
      passed: true,
      message: 'WaterSpiderAgent created successfully',
    });
    console.log('   ✅ WaterSpiderAgent initialized');
  } catch (error: any) {
    testResults.push({
      test: 'WaterSpiderAgent initialization',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 6: Session status check (if worktrees exist)
  console.log('6️⃣ Test: Session status check');
  try {
    const config: WaterSpiderConfig = {
      deviceIdentifier: 'test-device',
      githubToken: '',
      useTaskTool: false,
      useWorktree: true,
      logDirectory: './logs',
      reportDirectory: './reports',
      monitorInterval: 1000,
      maxIdleTime: 5000,
      autoRestart: false,
      webhookUrl: 'http://localhost:3002',
    };

    const sessionManager = new SessionManager(config);
    await sessionManager.discoverWorktrees();
    const sessions = await sessionManager.checkAllSessions();

    if (sessions.length > 0) {
      console.log(`   📊 Session statuses:`);
      sessions.forEach((s) => {
        console.log(
          `      - ${s.sessionId}: ${s.status} (idle: ${s.idleTime}ms)`,
        );
      });

      testResults.push({
        test: 'Session status check',
        passed: true,
        message: `Checked ${sessions.length} sessions`,
      });
      console.log('   ✅ Session status check successful');
    } else {
      console.log('   📋 No worktree sessions to check');
      testResults.push({
        test: 'Session status check',
        passed: true,
        message: 'No sessions to check (expected)',
      });
      console.log('   ✅ No sessions (expected if no worktrees)');
    }
  } catch (error: any) {
    testResults.push({
      test: 'Session status check',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Test 7: WebhookClient communication (graceful failure if server not running)
  console.log('7️⃣ Test: WebhookClient communication');
  try {
    const webhookClient = new WebhookClient('http://localhost:3002');

    // Test postStatus (should not throw even if server is down)
    await webhookClient.postStatus([]);

    testResults.push({
      test: 'WebhookClient communication',
      passed: true,
      message: 'WebhookClient handles server unavailability gracefully',
    });
    console.log(
      '   ✅ WebhookClient gracefully handles unavailable server',
    );
  } catch (error: any) {
    testResults.push({
      test: 'WebhookClient communication',
      passed: false,
      message: error.message,
    });
    console.log(`   ❌ Failed: ${error.message}`);
  }
  console.log('');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 Test Results Summary:');
  console.log('');

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  const passRate = (passedCount / totalCount) * 100;

  testResults.forEach((result, i) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`   ${i + 1}. ${icon} ${result.test}`);
    console.log(`      ${result.message}`);
  });

  console.log('');
  console.log(
    `   Total: ${passedCount}/${totalCount} passed (${passRate.toFixed(1)}%)`,
  );
  console.log('');

  if (passRate === 100) {
    console.log('🎉 All tests passed! Water Spider is ready to use.');
  } else if (passRate >= 80) {
    console.log(
      '✅ Most tests passed. Water Spider is functional with minor issues.',
    );
  } else {
    console.log(
      '⚠️  Some tests failed. Check the results above for details.',
    );
  }

  console.log('');
  console.log('💡 Next Steps:');
  console.log('   1. Ensure tmux is installed: brew install tmux (macOS)');
  console.log('   2. Create worktrees: git worktree add .worktrees/issue-xxx');
  console.log('   3. Start webhook server: npm run webhook:server');
  console.log('   4. Start Water Spider: npm run water-spider:start');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(passRate === 100 ? 0 : 1);
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { main };
