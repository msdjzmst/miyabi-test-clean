#!/usr/bin/env tsx

/**
 * Webhook Queue Flush Script
 *
 * Issue: #137 - Webhook Fallback機構の実装
 *
 * Usage: npm run webhook:flush
 */

import { flushWebhookQueue, checkWebhookServer } from '../.claude/hooks/webhook-fallback.js';

async function main() {
  console.log('🚀 Webhook Queue Flush Script\n');

  // Check webhook server status
  console.log('Checking webhook server status...');
  const isOnline = await checkWebhookServer();

  if (!isOnline) {
    console.error('❌ Webhook server is offline (http://localhost:3001)');
    console.error('   Please start the webhook server before flushing the queue.\n');
    process.exit(1);
  }

  console.log('✅ Webhook server is online\n');

  // Flush the queue
  const result = await flushWebhookQueue();

  // Exit with appropriate code
  if (result.failed > 0 && result.sent === 0) {
    console.error('\n❌ All webhook sends failed');
    process.exit(1);
  }

  if (result.total === 0) {
    console.log('\n✅ No webhooks to flush');
    process.exit(0);
  }

  console.log('\n✅ Webhook queue flushed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
