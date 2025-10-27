/**
 * Performance Benchmark Common Utilities
 *
 * 共通のベンチマーク機能を提供するモジュール
 */

// ========================================
// 型定義
// ========================================

export interface BenchmarkResult {
  scenario: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  throughput: number; // tasks/sec
  improvement?: number; // vs baseline (percentage)
  memoryUsage: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB
  };
}

export interface TaskResult {
  taskId: number;
  success: boolean;
  duration: number;
  error?: string;
}

export interface BenchmarkOptions {
  taskCount: number;
  scenario: string;
  description?: string;
}

// ========================================
// PerformanceProfiler クラス
// ========================================

/**
 * パフォーマンス測定ユーティリティ
 *
 * 使用例:
 * ```typescript
 * const profiler = new PerformanceProfiler();
 * profiler.start();
 *
 * for (let i = 0; i < 100; i++) {
 *   const taskStart = performance.now();
 *   await doSomething();
 *   const taskEnd = performance.now();
 *   profiler.addResult({ taskId: i, success: true, duration: taskEnd - taskStart });
 * }
 *
 * profiler.end();
 * const result = profiler.getResults();
 * console.log(`Average: ${result.avgDuration.toFixed(2)}ms/task`);
 * ```
 */
export class PerformanceProfiler {
  private startTime: number = 0;
  private endTime: number = 0;
  private results: TaskResult[] = [];

  /**
   * 測定開始
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * 測定終了
   */
  end(): void {
    this.endTime = performance.now();
  }

  /**
   * タスク結果を追加
   */
  addResult(result: TaskResult): void {
    this.results.push(result);
  }

  /**
   * 結果を取得
   */
  getResults(): BenchmarkResult {
    const totalDuration = this.endTime - this.startTime;
    const successfulTasks = this.results.filter((r) => r.success).length;
    const failedTasks = this.results.filter((r) => !r.success).length;
    const durations = this.results.map((r) => r.duration);

    const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const throughput = this.results.length > 0 ? (this.results.length / totalDuration) * 1000 : 0;

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
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  }

  /**
   * リセット
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.results = [];
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    count: number;
    successRate: number;
    failureRate: number;
  } {
    const count = this.results.length;
    const successCount = this.results.filter((r) => r.success).length;
    const failureCount = count - successCount;

    return {
      count,
      successRate: count > 0 ? successCount / count : 0,
      failureRate: count > 0 ? failureCount / count : 0,
    };
  }
}

// ========================================
// 結果表示ユーティリティ
// ========================================

/**
 * ベンチマーク結果を表形式で表示
 */
export function displayBenchmarkResult(result: BenchmarkResult): void {
  console.log(`\n✅ 完了: ${result.successfulTasks}/${result.totalTasks} 成功`);
  console.log(`⏱️  総時間: ${result.totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均: ${result.avgDuration.toFixed(2)}ms/task`);
  console.log(`📉 最速: ${result.minDuration.toFixed(2)}ms`);
  console.log(`📈 最遅: ${result.maxDuration.toFixed(2)}ms`);
  console.log(`🚀 スループット: ${result.throughput.toFixed(2)} tasks/sec`);
  console.log(`📦 メモリ使用量: Heap ${result.memoryUsage.heapUsed}MB / RSS ${result.memoryUsage.rss}MB`);
}

/**
 * 複数のベンチマーク結果を表形式で比較表示
 */
export function displayComparisonTable(results: BenchmarkResult[]): void {
  console.log('\n');
  console.log('┌─────────────────────────┬──────────┬──────────┬────────────┬───────────┐');
  console.log('│ Scenario                │ Tasks    │ Total    │ Avg        │ Throughput│');
  console.log('│                         │          │ (ms)     │ (ms/task)  │ (tasks/s) │');
  console.log('├─────────────────────────┼──────────┼──────────┼────────────┼───────────┤');

  results.forEach((r) => {
    const scenario = r.scenario.padEnd(23).slice(0, 23);
    const tasks = r.totalTasks.toString().padStart(8);
    const total = r.totalDuration.toFixed(0).padStart(8);
    const avg = r.avgDuration.toFixed(2).padStart(10);
    const throughput = r.throughput.toFixed(2).padStart(9);

    console.log(`│ ${scenario} │ ${tasks} │ ${total} │ ${avg} │ ${throughput} │`);
  });

  console.log('└─────────────────────────┴──────────┴──────────┴────────────┴───────────┘');
}

/**
 * 2つのベンチマーク結果を比較表示
 */
export function displayComparison(original: BenchmarkResult, optimized: BenchmarkResult): void {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║   📊 Performance Comparison                                       ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('┌─────────────────────────┬──────────────┬──────────────┬────────────┐');
  console.log('│ Metric                  │ Original     │ Optimized    │ Improvement│');
  console.log('├─────────────────────────┼──────────────┼──────────────┼────────────┤');

  // 平均実行時間
  const avgImprovement = ((original.avgDuration - optimized.avgDuration) / original.avgDuration) * 100;
  console.log(
    `│ Avg Duration (ms/task)  │ ${original.avgDuration.toFixed(2).padStart(12)} │ ${optimized.avgDuration
      .toFixed(2)
      .padStart(12)} │ ${avgImprovement >= 0 ? '+' : ''}${avgImprovement.toFixed(1).padStart(9)}% │`
  );

  // スループット
  const throughputImprovement =
    ((optimized.throughput - original.throughput) / original.throughput) * 100;
  console.log(
    `│ Throughput (tasks/s)    │ ${original.throughput.toFixed(2).padStart(12)} │ ${optimized.throughput
      .toFixed(2)
      .padStart(12)} │ ${throughputImprovement >= 0 ? '+' : ''}${throughputImprovement.toFixed(1).padStart(9)}% │`
  );

  // 総時間
  const totalImprovement =
    ((original.totalDuration - optimized.totalDuration) / original.totalDuration) * 100;
  console.log(
    `│ Total Duration (ms)     │ ${original.totalDuration.toFixed(0).padStart(12)} │ ${optimized.totalDuration
      .toFixed(0)
      .padStart(12)} │ ${totalImprovement >= 0 ? '+' : ''}${totalImprovement.toFixed(1).padStart(9)}% │`
  );

  console.log('└─────────────────────────┴──────────────┴──────────────┴────────────┘');

  // 改善効果
  console.log('\n🎯 改善効果:');
  if (avgImprovement > 0) {
    console.log(
      `   ✅ 平均実行時間: ${original.avgDuration.toFixed(2)}ms → ${optimized.avgDuration.toFixed(2)}ms (${avgImprovement.toFixed(1)}%削減)`
    );
    console.log(
      `   ✅ スループット: ${original.throughput.toFixed(2)} → ${optimized.throughput.toFixed(2)} tasks/sec (${throughputImprovement.toFixed(1)}%向上)`
    );
  } else {
    console.log(`   ⚠️  最適化が期待した効果を出していません`);
  }

  // メモリ使用量
  console.log('\n📦 メモリ使用量比較:');
  console.log(`   Original  - Heap Used: ${original.memoryUsage.heapUsed} MB, RSS: ${original.memoryUsage.rss} MB`);
  console.log(
    `   Optimized - Heap Used: ${optimized.memoryUsage.heapUsed} MB, RSS: ${optimized.memoryUsage.rss} MB`
  );

  const memoryChange = optimized.memoryUsage.heapUsed - original.memoryUsage.heapUsed;
  if (memoryChange > 0) {
    console.log(`   ⚠️  メモリ使用量が ${memoryChange}MB 増加`);
  } else if (memoryChange < 0) {
    console.log(`   ✅ メモリ使用量が ${Math.abs(memoryChange)}MB 減少`);
  } else {
    console.log(`   ℹ️  メモリ使用量は変化なし`);
  }

  console.log('\n');
}

/**
 * ボトルネック分析を表示
 */
export function displayBottleneckAnalysis(results: BenchmarkResult[]): void {
  if (results.length === 0) return;

  console.log('\n🔍 ボトルネック分析:');
  const slowest = results.reduce((max, r) => (r.avgDuration > max.avgDuration ? r : max));
  const fastest = results.reduce((min, r) => (r.avgDuration < min.avgDuration ? r : min));

  console.log(`   最速: ${fastest.scenario} (${fastest.avgDuration.toFixed(2)}ms/task)`);
  console.log(`   最遅: ${slowest.scenario} (${slowest.avgDuration.toFixed(2)}ms/task)`);
  console.log(`   差分: ${(slowest.avgDuration - fastest.avgDuration).toFixed(2)}ms/task`);

  if (slowest.avgDuration > 0) {
    const improvementPotential =
      ((slowest.avgDuration - fastest.avgDuration) / slowest.avgDuration) * 100;
    console.log(`   改善可能性: ${improvementPotential.toFixed(1)}%`);
  }
}

/**
 * ベンチマークヘッダーを表示
 */
export function displayBenchmarkHeader(title: string, description?: string): void {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log(`║   ${title.padEnd(63)} ║`);
  if (description) {
    console.log('║                                                                   ║');
    console.log(`║   ${description.padEnd(63)} ║`);
  }
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * パーセンテージをフォーマット
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * 時間をフォーマット
 */
export function formatDuration(ms: number, decimals: number = 2): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(decimals)}ms`;
  } else {
    return `${(ms / 1000).toFixed(decimals)}s`;
  }
}

/**
 * サイズをフォーマット (MB)
 */
export function formatSize(mb: number): string {
  if (mb < 1) {
    return `${(mb * 1024).toFixed(0)}KB`;
  } else if (mb < 1024) {
    return `${mb.toFixed(1)}MB`;
  } else {
    return `${(mb / 1024).toFixed(2)}GB`;
  }
}
