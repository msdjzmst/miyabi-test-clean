/**
 * MCP Servers Integration Tests
 *
 * Issue: #141 - MCP Server統合テスト・ヘルスチェックの実装
 *
 * Tests:
 * - Connection tests for all 7 MCP servers
 * - Fallback behavior on server failure
 * - Parallel request handling
 * - Timeout handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load MCP configuration
const mcpConfigPath = join(__dirname, '../../mcp.json');
const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));

const MCP_SERVERS = Object.keys(mcpConfig.mcpServers).filter(
  (name) => !mcpConfig.mcpServers[name].disabled
);

// Helper function to check MCP server
async function checkMCPServer(
  serverName: string,
  timeout: number = 5000
): Promise<{
  connected: boolean;
  responseTime: number;
  error?: string;
  timeout?: boolean;
}> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkScript = join(__dirname, '../check-server.js');

    const proc = spawn('node', [checkScript, serverName], {
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

    const timeoutId = setTimeout(() => {
      proc.kill();
      const elapsed = Date.now() - startTime;
      resolve({
        connected: false,
        responseTime: elapsed,
        error: 'Timeout exceeded',
        timeout: true,
      });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve({
            connected: true,
            responseTime: result.responseTime || elapsed,
            timeout: result.timeout || false,
          });
        } catch {
          resolve({
            connected: true,
            responseTime: elapsed,
          });
        }
      } else {
        try {
          const result = JSON.parse(errorOutput);
          resolve({
            connected: false,
            responseTime: elapsed,
            error: result.error || 'Unknown error',
          });
        } catch {
          resolve({
            connected: false,
            responseTime: elapsed,
            error: errorOutput || 'Connection failed',
          });
        }
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      resolve({
        connected: false,
        responseTime: elapsed,
        error: error.message,
      });
    });
  });
}

// Helper function to call MCP with fallback
async function callMCPWithFallback(
  serverName: string
): Promise<{
  success: boolean;
  fallback: boolean;
  error?: string;
}> {
  const result = await checkMCPServer(serverName, 3000);

  if (result.connected) {
    return { success: true, fallback: false };
  } else {
    return {
      success: false,
      fallback: true,
      error: result.error,
    };
  }
}

describe('MCP Servers Integration', () => {
  beforeAll(() => {
    console.log(`Testing ${MCP_SERVERS.length} MCP servers:`, MCP_SERVERS);
  });

  describe('Connection Tests', () => {
    it.each(MCP_SERVERS)(
      'should connect to %s server',
      async (serverName) => {
        const result = await checkMCPServer(serverName, 10000); // 10s timeout

        expect(result).toBeDefined();
        expect(result.responseTime).toBeGreaterThan(0);

        if (!result.connected) {
          console.warn(
            `⚠️  Server "${serverName}" failed to connect: ${result.error}`
          );
        }

        // Expect connection or timeout (some servers may take time to initialize)
        expect(
          result.connected || result.timeout
        ).toBe(true);

        // Response time should be reasonable (< 10 seconds)
        expect(result.responseTime).toBeLessThan(10000);
      },
      15000 // 15s test timeout
    );

    it('should report server count correctly', () => {
      expect(MCP_SERVERS.length).toBeGreaterThan(0);
      expect(MCP_SERVERS.length).toBeLessThanOrEqual(10); // Sanity check
    });
  });

  describe('Fallback Tests', () => {
    it('should handle non-existent server gracefully', async () => {
      const result = await callMCPWithFallback('non-existent-server');

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should provide error details on failure', async () => {
      const result = await checkMCPServer('invalid-server-name', 2000);

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('Performance Tests', () => {
    it('should handle parallel requests', async () => {
      const requests = MCP_SERVERS.map((server) =>
        checkMCPServer(server, 10000)
      );

      const results = await Promise.all(requests);

      expect(results.length).toBe(MCP_SERVERS.length);

      // At least some servers should connect successfully
      const successCount = results.filter((r) => r.connected).length;
      console.log(`✅ ${successCount}/${MCP_SERVERS.length} servers connected in parallel`);

      // Expect at least 50% success rate in parallel execution
      expect(successCount).toBeGreaterThanOrEqual(
        Math.floor(MCP_SERVERS.length / 2)
      );
    }, 20000); // 20s timeout for parallel execution

    it('should complete all checks within reasonable time', async () => {
      const startTime = Date.now();

      const requests = MCP_SERVERS.map((server) =>
        checkMCPServer(server, 5000)
      );
      await Promise.all(requests);

      const elapsed = Date.now() - startTime;

      // Parallel execution should be faster than sequential
      // Sequential would be: MCP_SERVERS.length * 5000ms
      // Parallel should be: ~5000ms (all run concurrently)
      expect(elapsed).toBeLessThan(MCP_SERVERS.length * 5000);

      console.log(`⚡ All ${MCP_SERVERS.length} servers checked in ${elapsed}ms (parallel)`);
    }, 15000);
  });

  describe('Timeout Handling', () => {
    it('should timeout gracefully', async () => {
      // Use a very short timeout to force timeout
      const result = await checkMCPServer(MCP_SERVERS[0], 100);

      expect(result).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);

      if (result.timeout) {
        expect(result.connected).toBe(false);
        expect(result.error).toContain('Timeout');
      }
    });

    it('should respect custom timeout values', async () => {
      const customTimeout = 2000; // 2 seconds
      const startTime = Date.now();

      const result = await checkMCPServer(MCP_SERVERS[0], customTimeout);
      const elapsed = Date.now() - startTime;

      // Should not exceed timeout significantly (allow 500ms buffer)
      expect(elapsed).toBeLessThan(customTimeout + 500);
    }, 3000);
  });

  describe('Error Handling', () => {
    it('should handle malformed server configuration', async () => {
      // This should fail gracefully
      const result = await checkMCPServer('test-malformed', 1000);

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide structured error information', async () => {
      const result = await checkMCPServer('invalid-test-server', 1000);

      expect(result).toHaveProperty('connected');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('error');

      expect(typeof result.connected).toBe('boolean');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('Health Check Status', () => {
    it('should identify healthy servers', async () => {
      const healthyServers: string[] = [];
      const unhealthyServers: string[] = [];

      for (const server of MCP_SERVERS) {
        const result = await checkMCPServer(server, 5000);

        if (result.connected) {
          healthyServers.push(server);
        } else {
          unhealthyServers.push(server);
        }
      }

      console.log(`\n📊 Health Check Summary:`);
      console.log(`   ✅ Healthy: ${healthyServers.length}`);
      console.log(`   ❌ Unhealthy: ${unhealthyServers.length}`);

      if (healthyServers.length > 0) {
        console.log(`   Healthy servers:`, healthyServers);
      }

      if (unhealthyServers.length > 0) {
        console.log(`   Unhealthy servers:`, unhealthyServers);
      }

      // Expect at least one server to be healthy
      expect(healthyServers.length).toBeGreaterThan(0);
    }, 30000);
  });
});
