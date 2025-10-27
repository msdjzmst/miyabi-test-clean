#!/usr/bin/env node

/**
 * MCP Server Health Check
 *
 * Issue: #141 - MCP Server統合テスト・ヘルスチェックの実装
 *
 * Usage: node check-server.js <server-name>
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load MCP configuration
const mcpConfigPath = join(__dirname, '../mcp.json');
const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));

const serverName = process.argv[2];

if (!serverName) {
  console.error('Usage: node check-server.js <server-name>');
  console.error('Available servers:', Object.keys(mcpConfig.mcpServers).join(', '));
  process.exit(1);
}

const serverConfig = mcpConfig.mcpServers[serverName];

if (!serverConfig) {
  console.error(`❌ Server "${serverName}" not found in mcp.json`);
  process.exit(1);
}

if (serverConfig.disabled) {
  console.error(`⚠️  Server "${serverName}" is disabled`);
  process.exit(2);
}

/**
 * Check if MCP server process can start
 */
async function checkServer() {
  const startTime = Date.now();

  try {
    // Spawn server process
    const proc = spawn(serverConfig.command, serverConfig.args, {
      env: {
        ...process.env,
        ...serverConfig.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(__dirname, '../..'),
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Wait for server initialization or timeout
    const timeout = serverConfig.timeout || 5000;
    const result = await Promise.race([
      new Promise((resolve) => {
        // Check for initialization success indicators
        proc.stdout.on('data', (data) => {
          const text = data.toString();
          // Common initialization patterns
          if (
            text.includes('listening') ||
            text.includes('started') ||
            text.includes('ready') ||
            text.includes('Server running') ||
            text.includes('initialized')
          ) {
            resolve({ success: true, output: text });
          }
        });

        // Process exit
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, code });
          } else {
            resolve({ success: false, code, error: errorOutput });
          }
        });
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          // Timeout - assume success if process is still running
          if (!proc.killed) {
            proc.kill();
            resolve({ success: true, timeout: true });
          }
        }, timeout);
      }),
    ]);

    const elapsed = Date.now() - startTime;

    // Cleanup
    if (!proc.killed) {
      proc.kill();
    }

    if (result.success) {
      console.log(JSON.stringify({
        server: serverName,
        status: 'healthy',
        responseTime: elapsed,
        timeout: result.timeout || false,
      }));
      process.exit(0);
    } else {
      console.error(JSON.stringify({
        server: serverName,
        status: 'failed',
        responseTime: elapsed,
        error: result.error || 'Unknown error',
        exitCode: result.code,
      }));
      process.exit(1);
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(JSON.stringify({
      server: serverName,
      status: 'error',
      responseTime: elapsed,
      error: error.message,
    }));
    process.exit(1);
  }
}

checkServer();
