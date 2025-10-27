#!/usr/bin/env node

/**
 * Webhook Fallback Mechanism
 *
 * Issue: #137 - Webhook Fallback機構の実装
 *
 * Features:
 * - Connection check with 5-second timeout
 * - Local queue storage when webhook server is offline
 * - Batch send functionality
 * - Graceful degradation (git operations never blocked)
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhook';
const TIMEOUT_MS = 5000; // 5 seconds
const QUEUE_DIR = join(__dirname, '../../.ai/logs/webhook-queue');

// ============================================================================
// Core Functionality
// ============================================================================

/**
 * Send webhook with automatic fallback to local queue
 *
 * @param {string} url - Webhook URL
 * @param {object} payload - JSON payload
 * @returns {Promise<{ success: boolean, fallback?: boolean, error?: string }>}
 */
export async function sendWebhookWithFallback(url, payload) {
  try {
    // Attempt to send webhook with timeout
    const result = await sendWithTimeout(url, payload, TIMEOUT_MS);

    if (result.success) {
      console.log('✅ Webhook sent successfully');
      return { success: true };
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    // Fallback: Save to local queue
    const queueFile = await saveToLocalQueue(payload);
    console.log(`⚠️  Webhook server offline - saved to local queue: ${queueFile}`);
    console.log('   Run "npm run webhook:flush" when server is available');

    return {
      success: false,
      fallback: true,
      error: error.message,
    };
  }
}

/**
 * Send HTTP request with timeout
 *
 * @param {string} url - Webhook URL
 * @param {object} payload - JSON payload
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendWithTimeout(url, payload, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return { success: false, error: 'Connection timeout' };
    }

    return { success: false, error: error.message };
  }
}

/**
 * Save webhook payload to local queue
 *
 * @param {object} payload - JSON payload
 * @returns {string} - Queue file path
 */
async function saveToLocalQueue(payload) {
  // Ensure queue directory exists
  if (!existsSync(QUEUE_DIR)) {
    mkdirSync(QUEUE_DIR, { recursive: true });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `webhook-${timestamp}-${random}.json`;
  const filepath = join(QUEUE_DIR, filename);

  // Write payload to file
  const queueEntry = {
    timestamp: new Date().toISOString(),
    url: WEBHOOK_URL,
    payload,
    retries: 0,
  };

  writeFileSync(filepath, JSON.stringify(queueEntry, null, 2));

  return filepath;
}

// ============================================================================
// Batch Send Functionality
// ============================================================================

/**
 * Flush all queued webhooks
 *
 * @returns {Promise<{ total: number, sent: number, failed: number }>}
 */
export async function flushWebhookQueue() {
  if (!existsSync(QUEUE_DIR)) {
    console.log('ℹ️  No webhook queue found');
    return { total: 0, sent: 0, failed: 0 };
  }

  const files = readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('ℹ️  Webhook queue is empty');
    return { total: 0, sent: 0, failed: 0 };
  }

  console.log(`📤 Flushing ${files.length} queued webhooks...`);

  let sent = 0;
  let failed = 0;

  for (const file of files) {
    const filepath = join(QUEUE_DIR, file);

    try {
      const queueEntry = JSON.parse(readFileSync(filepath, 'utf-8'));

      // Attempt to send
      const result = await sendWithTimeout(
        queueEntry.url,
        queueEntry.payload,
        TIMEOUT_MS
      );

      if (result.success) {
        // Success: Delete queue file
        unlinkSync(filepath);
        sent++;
        console.log(`   ✅ Sent: ${file}`);
      } else {
        // Failed: Increment retry count
        queueEntry.retries++;

        if (queueEntry.retries >= 3) {
          // Max retries reached: Move to failed directory
          const failedDir = join(QUEUE_DIR, 'failed');
          if (!existsSync(failedDir)) {
            mkdirSync(failedDir, { recursive: true });
          }

          const failedPath = join(failedDir, file);
          writeFileSync(failedPath, JSON.stringify(queueEntry, null, 2));
          unlinkSync(filepath);

          failed++;
          console.log(`   ❌ Failed (max retries): ${file}`);
        } else {
          // Update retry count
          writeFileSync(filepath, JSON.stringify(queueEntry, null, 2));
          failed++;
          console.log(`   ⚠️  Failed (retry ${queueEntry.retries}/3): ${file}`);
        }
      }
    } catch (error) {
      failed++;
      console.error(`   ❌ Error processing ${file}: ${error.message}`);
    }
  }

  console.log(`\n📊 Results: ${sent} sent, ${failed} failed (${files.length} total)`);

  return { total: files.length, sent, failed };
}

/**
 * Check webhook server health
 *
 * @param {string} url - Webhook URL
 * @returns {Promise<boolean>}
 */
export async function checkWebhookServer(url = WEBHOOK_URL) {
  try {
    const result = await sendWithTimeout(
      url.replace('/api/webhook', '/health'),
      {},
      2000 // 2-second timeout for health check
    );
    return result.success;
  } catch {
    return false;
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'flush':
      await flushWebhookQueue();
      break;

    case 'check':
      const isOnline = await checkWebhookServer();
      console.log(`Webhook server: ${isOnline ? '✅ Online' : '❌ Offline'}`);
      process.exit(isOnline ? 0 : 1);
      break;

    case 'send':
      // Usage: node webhook-fallback.js send <payload-json>
      // Or: echo '{"foo":"bar"}' | node webhook-fallback.js send -
      let payload;

      if (process.argv[3] === '-') {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString('utf8');
        payload = JSON.parse(input);
      } else {
        // Read from argument
        payload = JSON.parse(process.argv[3] || '{}');
      }

      const result = await sendWebhookWithFallback(WEBHOOK_URL, payload);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
      break;

    default:
      console.log('Usage:');
      console.log('  node webhook-fallback.js flush   - Flush queued webhooks');
      console.log('  node webhook-fallback.js check   - Check server health');
      console.log('  node webhook-fallback.js send <payload>  - Send webhook with fallback');
      process.exit(1);
  }
}
