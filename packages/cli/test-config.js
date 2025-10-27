#!/usr/bin/env node

/**
 * Test configuration loading
 */

import { loadConfig, applyConfigToEnvironment } from './dist/config/loader.js';

console.log('Testing configuration loading...\n');

// Clear GITHUB_TOKEN first
delete process.env.GITHUB_TOKEN;
console.log('1. GITHUB_TOKEN before loading:', process.env.GITHUB_TOKEN || 'undefined');

// Load configuration
try {
  const config = loadConfig({ silent: false });
  console.log('\n2. Config loaded:', JSON.stringify(config, null, 2));

  // Apply to environment
  applyConfigToEnvironment(config);
  console.log('\n3. GITHUB_TOKEN after applying config:',
    process.env.GITHUB_TOKEN ? '✓ Set (hidden)' : '✗ Not set');

  // Verify
  if (process.env.GITHUB_TOKEN) {
    console.log('\n✅ SUCCESS: Token loaded from config file');
  } else {
    console.log('\n❌ FAIL: Token not loaded');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
