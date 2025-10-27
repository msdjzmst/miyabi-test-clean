/**
 * Performance Benchmark - Phase 7
 *
 * 1000タスク並列実行ベンチマークでボトルネック特定
 * 目標: 平均実行時間50%削減 (1134ms → 567ms)
 *
 * 実行方法:
 *   npm run benchmark:performance
 */

import { DynamicToolCreator } from '../dynamic-tool-creator';
import { TTLCache } from '../utils/cache';
import { retryWithBackoff } from '../utils/retry';
import { SecurityValidator } from '../utils/security-validator';
import type { IToolCreator } from '../types/tool-creator-interface';

// ベンチマーク結果
interface BenchmarkResult {
  scenario: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  throughput: number; // tasks/sec
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

// タスク実行結果
interface TaskResult {
  taskId: number;
  success: boolean;
  duration: number;
  error?: string;
}

// パフォーマンス測定ユーティリティ
class PerformanceProfiler {
  private startTime: number = 0;
  private endTime: number = 0;
  private results: TaskResult[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  end(): void {
    this.endTime = performance.now();
  }

  addResult(result: TaskResult): void {
    this.results.push(result);
  }

  getResults(): BenchmarkResult {
    const totalDuration = this.endTime - this.startTime;
    const successfulTasks = this.results.filter((r) => r.success).length;
    const failedTasks = this.results.filter((r) => !r.success).length;
    const durations = this.results.map((r) => r.duration);

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const throughput = (this.results.length / totalDuration) * 1000; // tasks/sec

    const memUsage = process.memoryUsage();

    return {
      scenario: '',
      totalTasks: this.results.length,
      successfulTasks,
      failedTasks,
      totalDuration,
      avgDuration,
      minDuration,
      maxDuration,
      throughput,
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  }

  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.results = [];
  }
}

const profiler = new PerformanceProfiler();

/**
 * Scenario 1: 単純なツール作成（ベースライン）
 */
async function benchmark1_SimpleToolCreation(taskCount: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmark 1: 単純なツール作成 (${taskCount}タスク)`);

  const toolCreator: IToolCreator = new DynamicToolCreator();
  profiler.reset();
  profiler.start();

  const tasks: Promise<void>[] = [];

  for (let i = 0; i < taskCount; i++) {
    const task = (async () => {
      const taskStart = performance.now();
      try {
        const result = await toolCreator.createSimpleTool(
          `tool-${i}`,
          `Tool ${i} description`,
          'library',
          { value: i }
        );
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: result.success,
          duration: taskEnd - taskStart,
        });
      } catch (error) {
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: false,
          duration: taskEnd - taskStart,
          error: (error as Error).message,
        });
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);

  profiler.end();
  const result = profiler.getResults();
  result.scenario = 'Simple Tool Creation';

  console.log(`✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);

  return result;
}

/**
 * Scenario 2: キャッシュ付きツール実行
 */
async function benchmark2_CachedExecution(taskCount: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmark 2: キャッシュ付きツール実行 (${taskCount}タスク)`);

  const toolCreator: IToolCreator = new DynamicToolCreator();
  const cache = new TTLCache<any>({
    maxSize: 1000,
    ttlMs: 60000,
    autoCleanup: false,
  });

  // ツールを1つ作成
  const tool = await toolCreator.createSimpleTool('cached-tool', 'Cached tool', 'library', {});

  profiler.reset();
  profiler.start();

  const tasks: Promise<void>[] = [];
  const context = {
    agentInstanceId: 'benchmark-agent',
    taskId: 'benchmark-task',
    timestamp: new Date().toISOString(),
  };

  for (let i = 0; i < taskCount; i++) {
    const task = (async () => {
      const taskStart = performance.now();
      try {
        const cacheKey = `exec-${i % 100}`; // 100種類のキーで重複あり

        let result = cache.get(cacheKey);
        if (!result) {
          result = await toolCreator.executeTool(tool.tool!, { value: i }, context);
          cache.set(cacheKey, result);
        }

        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: true,
          duration: taskEnd - taskStart,
        });
      } catch (error) {
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: false,
          duration: taskEnd - taskStart,
          error: (error as Error).message,
        });
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);

  profiler.end();
  const result = profiler.getResults();
  result.scenario = 'Cached Execution';

  const cacheStats = cache.getStats();
  console.log(`✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);
  console.log(`💾 キャッシュヒット率: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

  cache.dispose();
  return result;
}

/**
 * Scenario 3: セキュリティ検証付き
 */
async function benchmark3_SecurityValidation(taskCount: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmark 3: セキュリティ検証付き (${taskCount}タスク)`);

  const testCodes = [
    `function add(a, b) { return a + b; }`,
    `function multiply(x, y) { return x * y; }`,
    `function divide(a, b) { return a / b; }`,
    `const sum = (arr) => arr.reduce((a, b) => a + b, 0);`,
    `const filter = (arr, fn) => arr.filter(fn);`,
  ];

  profiler.reset();
  profiler.start();

  const tasks: Promise<void>[] = [];

  for (let i = 0; i < taskCount; i++) {
    const task = (async () => {
      const taskStart = performance.now();
      try {
        const code = testCodes[i % testCodes.length];
        const validation = SecurityValidator.validate(code);
        const score = SecurityValidator.getSecurityScore(code);

        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: validation.safe && score > 0,
          duration: taskEnd - taskStart,
        });
      } catch (error) {
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: false,
          duration: taskEnd - taskStart,
          error: (error as Error).message,
        });
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);

  profiler.end();
  const result = profiler.getResults();
  result.scenario = 'Security Validation';

  console.log(`✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);

  return result;
}

/**
 * Scenario 4: リトライ付き実行
 */
async function benchmark4_RetryExecution(taskCount: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmark 4: リトライ付き実行 (${taskCount}タスク)`);

  profiler.reset();
  profiler.start();

  const tasks: Promise<void>[] = [];

  for (let i = 0; i < taskCount; i++) {
    const task = (async () => {
      const taskStart = performance.now();
      try {
        let attempt = 0;
        const operation = async () => {
          attempt++;
          // 30%の確率で失敗（リトライテスト）
          if (Math.random() < 0.3 && attempt < 2) {
            throw new Error('Temporary failure');
          }
          return `Result ${i}`;
        };

        const result = await retryWithBackoff(operation, {
          maxRetries: 3,
          initialDelayMs: 10,
          backoffMultiplier: 2,
        });

        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: result.success,
          duration: taskEnd - taskStart,
        });
      } catch (error) {
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: false,
          duration: taskEnd - taskStart,
          error: (error as Error).message,
        });
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);

  profiler.end();
  const result = profiler.getResults();
  result.scenario = 'Retry Execution';

  console.log(`✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);

  return result;
}

/**
 * Scenario 5: E2E統合（全機能）
 */
async function benchmark5_E2EIntegration(taskCount: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmark 5: E2E統合 - 全機能 (${taskCount}タスク)`);

  const toolCreator: IToolCreator = new DynamicToolCreator();
  const cache = new TTLCache<any>({
    maxSize: 500,
    ttlMs: 60000,
    autoCleanup: false,
  });

  profiler.reset();
  profiler.start();

  const tasks: Promise<void>[] = [];
  const context = {
    agentInstanceId: 'benchmark-e2e',
    taskId: 'benchmark-e2e',
    timestamp: new Date().toISOString(),
  };

  for (let i = 0; i < taskCount; i++) {
    const task = (async () => {
      const taskStart = performance.now();
      try {
        // 1. キャッシュチェック
        const cacheKey = `e2e-${i % 50}`;
        let result = cache.get(cacheKey);

        if (!result) {
          // 2. リトライ付きツール作成
          const toolResult = await retryWithBackoff(
            async () => {
              return await toolCreator.createSimpleTool(
                `e2e-tool-${i}`,
                `E2E tool ${i}`,
                'library',
                { value: i }
              );
            },
            {
              maxRetries: 2,
              initialDelayMs: 5,
            }
          );

          const toolValue = toolResult.success ? toolResult.value : null;
          if (toolValue?.tool) {
            // 3. セキュリティ検証（簡易版）
            const code = `function test() { return ${i}; }`;
            const validation = SecurityValidator.validate(code);

            // 4. ツール実行
            if (validation.safe) {
              result = await toolCreator.executeTool(toolValue.tool, { value: i }, context);
              cache.set(cacheKey, result);
            }
          }
        }

        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: result?.success || false,
          duration: taskEnd - taskStart,
        });
      } catch (error) {
        const taskEnd = performance.now();
        profiler.addResult({
          taskId: i,
          success: false,
          duration: taskEnd - taskStart,
          error: (error as Error).message,
        });
      }
    })();

    tasks.push(task);
  }

  await Promise.all(tasks);

  profiler.end();
  const result = profiler.getResults();
  result.scenario = 'E2E Integration';

  const cacheStats = cache.getStats();
  console.log(`✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);
  console.log(`💾 キャッシュヒット率: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

  cache.dispose();
  return result;
}

/**
 * 結果サマリー表示
 */
function displaySummary(results: BenchmarkResult[]): void {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║   📊 Performance Benchmark Results - Phase 7                      ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // 表形式で結果表示
  console.log('┌─────────────────────────┬──────────┬──────────┬────────────┬───────────┐');
  console.log('│ Scenario                │ Tasks    │ Total    │ Avg        │ Throughput│');
  console.log('│                         │          │ (ms)     │ (ms/task)  │ (tasks/s) │');
  console.log('├─────────────────────────┼──────────┼──────────┼────────────┼───────────┤');

  results.forEach((r) => {
    const scenario = r.scenario.padEnd(23);
    const tasks = r.totalTasks.toString().padStart(8);
    const total = r.totalDuration.toFixed(0).padStart(8);
    const avg = r.avgDuration.toFixed(2).padStart(10);
    const throughput = r.throughput.toFixed(2).padStart(9);

    console.log(`│ ${scenario} │ ${tasks} │ ${total} │ ${avg} │ ${throughput} │`);
  });

  console.log('└─────────────────────────┴──────────┴──────────┴────────────┴───────────┘');

  // メモリ使用量
  console.log('\n📦 メモリ使用量 (最終測定):');
  const lastResult = results[results.length - 1];
  console.log(`   Heap Used: ${lastResult.memoryUsage.heapUsed} MB`);
  console.log(`   Heap Total: ${lastResult.memoryUsage.heapTotal} MB`);
  console.log(`   RSS: ${lastResult.memoryUsage.rss} MB`);

  // ボトルネック分析
  console.log('\n🔍 ボトルネック分析:');
  const slowest = results.reduce((max, r) => (r.avgDuration > max.avgDuration ? r : max));
  const fastest = results.reduce((min, r) => (r.avgDuration < min.avgDuration ? r : min));

  console.log(`   最速: ${fastest.scenario} (${fastest.avgDuration.toFixed(2)}ms/task)`);
  console.log(`   最遅: ${slowest.scenario} (${slowest.avgDuration.toFixed(2)}ms/task)`);
  console.log(`   差分: ${(slowest.avgDuration - fastest.avgDuration).toFixed(2)}ms/task`);
  console.log(`   改善率: ${(((slowest.avgDuration - fastest.avgDuration) / slowest.avgDuration) * 100).toFixed(1)}%`);

  // 最適化提案
  console.log('\n💡 最適化提案:');
  if (slowest.scenario.includes('E2E')) {
    console.log('   1. E2E統合が最も遅い → 各コンポーネントの軽量化が必要');
    console.log('   2. キャッシュヒット率を向上させることで高速化可能');
    console.log('   3. 並列実行数を調整することで最適化可能');
  }
  if (results.find((r) => r.scenario.includes('Retry'))) {
    console.log('   4. リトライ回数を最小限に抑える（初回成功率向上）');
  }
  console.log('   5. TTLCache maxSizeを調整してヒット率向上');
  console.log('   6. SecurityValidationを並列化して高速化');

  console.log('\n');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║   🚀 Performance Benchmark - Phase 7                              ║');
  console.log('║                                                                   ║');
  console.log('║   目標: 平均実行時間50%削減 (1134ms → 567ms)                      ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  const results: BenchmarkResult[] = [];

  try {
    // Scenario 1: Simple Tool Creation (100タスク)
    results.push(await benchmark1_SimpleToolCreation(100));

    // Scenario 2: Cached Execution (1000タスク)
    results.push(await benchmark2_CachedExecution(1000));

    // Scenario 3: Security Validation (1000タスク)
    results.push(await benchmark3_SecurityValidation(1000));

    // Scenario 4: Retry Execution (500タスク)
    results.push(await benchmark4_RetryExecution(500));

    // Scenario 5: E2E Integration (200タスク)
    results.push(await benchmark5_E2EIntegration(200));

    // サマリー表示
    displaySummary(results);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ベンチマーク実行中にエラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合のみmainを実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runPerformanceBenchmark };
