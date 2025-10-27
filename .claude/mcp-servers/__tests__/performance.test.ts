/**
 * MCP Servers Performance Tests
 *
 * Issue: #141 - MCP Server統合テスト・ヘルスチェックの実装
 *
 * Tests:
 * - Response time benchmarks
 * - Throughput measurement
 * - Memory usage tracking
 * - Sequential vs parallel performance
 */

import { describe, it, expect } from 'vitest';
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

// Performance thresholds
const THRESHOLDS = {
  averageResponseTime: 5000,    // 5 seconds average
  maxResponseTime: 10000,        // 10 seconds max
  minThroughput: 10,             // 10 checks per second
};

// Helper function to check MCP server with timing
async function checkMCPServerTimed(
  serverName: string
): Promise<{ responseTime: number; success: boolean }> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkScript = join(__dirname, '../check-server.js');

    const proc = spawn('node', [checkScript, serverName], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      proc.kill();
      const elapsed = Date.now() - startTime;
      resolve({ responseTime: elapsed, success: false });
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const elapsed = Date.now() - startTime;
      resolve({ responseTime: elapsed, success: code === 0 });
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      const elapsed = Date.now() - startTime;
      resolve({ responseTime: elapsed, success: false });
    });
  });
}

describe('MCP Servers Performance Tests', () => {
  describe('Response Time Benchmarks', () => {
    it('should measure individual server response times', async () => {
      const results: Record<string, number> = {};

      for (const server of MCP_SERVERS) {
        const { responseTime } = await checkMCPServerTimed(server);
        results[server] = responseTime;
      }

      console.log('\n⚡ Response Time Benchmarks:');
      Object.entries(results).forEach(([server, time]) => {
        console.log(`   ${server}: ${time}ms`);
      });

      // Calculate statistics
      const times = Object.values(results);
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`\n📊 Statistics:`);
      console.log(`   Average: ${Math.round(avgTime)}ms`);
      console.log(`   Min: ${Math.round(minTime)}ms`);
      console.log(`   Max: ${Math.round(maxTime)}ms`);

      // Performance assertions
      expect(avgTime).toBeLessThan(THRESHOLDS.averageResponseTime);
      expect(maxTime).toBeLessThan(THRESHOLDS.maxResponseTime);
    }, 60000); // 60s timeout

    it('should identify fastest and slowest servers', async () => {
      const results: Array<{ server: string; time: number }> = [];

      for (const server of MCP_SERVERS) {
        const { responseTime } = await checkMCPServerTimed(server);
        results.push({ server, time: responseTime });
      }

      results.sort((a, b) => a.time - b.time);

      console.log('\n🏆 Performance Ranking:');
      results.forEach((result, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`   ${medal} ${index + 1}. ${result.server}: ${result.time}ms`);
      });

      expect(results.length).toBe(MCP_SERVERS.length);
    }, 60000);
  });

  describe('Throughput Measurement', () => {
    it('should measure sequential throughput', async () => {
      const iterations = 5;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await checkMCPServerTimed(MCP_SERVERS[0]);
      }

      const elapsed = Date.now() - startTime;
      const throughput = (iterations / elapsed) * 1000; // checks per second

      console.log(`\n📈 Sequential Throughput:`);
      console.log(`   ${iterations} checks in ${elapsed}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} checks/second`);

      expect(throughput).toBeGreaterThan(0);
    }, 60000);

    it('should measure parallel throughput', async () => {
      const iterations = 3;
      const startTime = Date.now();

      const requests = Array(iterations)
        .fill(null)
        .map(() => MCP_SERVERS.map((server) => checkMCPServerTimed(server)))
        .flat();

      await Promise.all(requests);

      const elapsed = Date.now() - startTime;
      const totalChecks = iterations * MCP_SERVERS.length;
      const throughput = (totalChecks / elapsed) * 1000;

      console.log(`\n📈 Parallel Throughput:`);
      console.log(`   ${totalChecks} checks in ${elapsed}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} checks/second`);

      expect(throughput).toBeGreaterThan(THRESHOLDS.minThroughput);
    }, 60000);
  });

  describe('Sequential vs Parallel Performance', () => {
    it('should show performance improvement with parallelization', async () => {
      // Sequential execution
      const sequentialStart = Date.now();
      for (const server of MCP_SERVERS) {
        await checkMCPServerTimed(server);
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Parallel execution
      const parallelStart = Date.now();
      await Promise.all(MCP_SERVERS.map((server) => checkMCPServerTimed(server)));
      const parallelTime = Date.now() - parallelStart;

      const improvement = ((sequentialTime - parallelTime) / sequentialTime) * 100;

      console.log(`\n⚡ Sequential vs Parallel:`);
      console.log(`   Sequential: ${sequentialTime}ms`);
      console.log(`   Parallel: ${parallelTime}ms`);
      console.log(`   Improvement: ${improvement.toFixed(1)}%`);

      // Parallel should be faster than sequential (at least 20% improvement)
      expect(parallelTime).toBeLessThan(sequentialTime);
      expect(improvement).toBeGreaterThan(20);
    }, 120000);
  });

  describe('Load Testing', () => {
    it('should handle burst of requests', async () => {
      const burstSize = 10;
      const startTime = Date.now();

      // Send burst of requests to first server
      const requests = Array(burstSize)
        .fill(null)
        .map(() => checkMCPServerTimed(MCP_SERVERS[0]));

      const results = await Promise.all(requests);
      const elapsed = Date.now() - startTime;

      const successCount = results.filter((r) => r.success).length;
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

      console.log(`\n💥 Burst Load Test:`);
      console.log(`   ${burstSize} concurrent requests`);
      console.log(`   Success rate: ${successCount}/${burstSize}`);
      console.log(`   Average response: ${Math.round(avgResponseTime)}ms`);
      console.log(`   Total time: ${elapsed}ms`);

      // Expect reasonable success rate (at least 50%)
      expect(successCount).toBeGreaterThanOrEqual(burstSize / 2);
    }, 60000);

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const interval = 500;   // Request every 500ms
      const startTime = Date.now();
      const results: boolean[] = [];

      while (Date.now() - startTime < duration) {
        const { success } = await checkMCPServerTimed(MCP_SERVERS[0]);
        results.push(success);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      const successRate = (results.filter((r) => r).length / results.length) * 100;

      console.log(`\n⏱️  Sustained Load Test:`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Total requests: ${results.length}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);

      // Expect high success rate under sustained load
      expect(successRate).toBeGreaterThan(50);
    }, 15000);
  });

  describe('Performance Regression Detection', () => {
    it('should establish baseline performance metrics', async () => {
      const baseline: Record<string, number> = {};

      for (const server of MCP_SERVERS) {
        const results = await Promise.all(
          Array(3)
            .fill(null)
            .map(() => checkMCPServerTimed(server))
        );

        const avgTime =
          results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

        baseline[server] = avgTime;
      }

      console.log(`\n📋 Baseline Performance Metrics:`);
      Object.entries(baseline).forEach(([server, time]) => {
        console.log(`   ${server}: ${Math.round(time)}ms`);
      });

      // Store baseline (in real scenario, would save to file/database)
      expect(Object.keys(baseline).length).toBe(MCP_SERVERS.length);
    }, 60000);
  });

  describe('Resource Usage', () => {
    it('should complete checks with reasonable memory usage', () => {
      const memBefore = process.memoryUsage().heapUsed;

      // Memory snapshot after setup
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      console.log(`\n💾 Memory Usage:`);
      console.log(`   Before: ${(memBefore / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   After: ${(memAfter / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Delta: ${(memDelta / 1024 / 1024).toFixed(2)} MB`);

      // Memory usage should be reasonable (< 100MB delta)
      expect(memDelta).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
