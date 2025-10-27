#!/usr/bin/env node

/**
 * Test error handling
 */

import { status } from './dist/commands/status.js';

console.log('Testing error handling...\n');

// Clear GITHUB_TOKEN
delete process.env.GITHUB_TOKEN;

console.log('Calling status command without GITHUB_TOKEN...\n');

try {
  await status({});
} catch (error) {
  console.log('\nCaught error:', error.message);
}
