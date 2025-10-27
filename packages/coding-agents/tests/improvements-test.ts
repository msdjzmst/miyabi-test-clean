/**
 * Comprehensive Test Suite for Phase 1-3 Improvements
 *
 * Tests:
 * - Phase 1: IToolCreator interface compliance
 * - Phase 2: 5 error classes + Retry logic
 * - Phase 3: TTLCache with LRU eviction
 *
 * Target: 50 test cases
 */

import { DynamicToolCreator } from '../dynamic-tool-creator';
import {
  AgentError,
  AnalysisError,
  ToolCreationError,
  AssignmentError,
  ExecutionError,
  TimeoutError,
  ErrorUtils
} from '../types/errors';
import {
  retryWithBackoff,
  retryUntil,
  retryBatch,
} from '../utils/retry';
import { TTLCache, memoize } from '../utils/cache';
import { logger } from '../ui/index';

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Utility function for test assertions
function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    logger.success(`  ✓ Test ${totalTests}: ${message}`);
  } else {
    failedTests++;
    logger.error(`  ✗ Test ${totalTests}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    logger.success(`  ✓ Test ${totalTests}: ${message}`);
  } else {
    failedTests++;
    logger.error(`  ✗ Test ${totalTests}: ${message} (expected: ${expected}, actual: ${actual})`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: IToolCreator Interface Compliance
 */
async function testIToolCreatorInterface(): Promise<void> {
  logger.info('\n=== Test 1: IToolCreator Interface Compliance ===');

  const toolCreator = new DynamicToolCreator();

  // Test 1.1: createSimpleTool method exists
  assert(
    typeof toolCreator.createSimpleTool === 'function',
    'createSimpleTool method exists'
  );

  // Test 1.2: createToolFromDescription method exists
  assert(
    typeof toolCreator.createToolFromDescription === 'function',
    'createToolFromDescription method exists'
  );

  // Test 1.3: createAndExecuteTool method exists
  assert(
    typeof toolCreator.createAndExecuteTool === 'function',
    'createAndExecuteTool method exists'
  );

  // Test 1.4: executeTool method exists
  assert(
    typeof toolCreator.executeTool === 'function',
    'executeTool method exists'
  );

  // Test 1.5: getStatistics method exists
  assert(
    typeof toolCreator.getStatistics === 'function',
    'getStatistics method exists'
  );

  // Test 1.6: getExecutionHistory method exists
  assert(
    typeof toolCreator.getExecutionHistory === 'function',
    'getExecutionHistory method exists'
  );

  // Test 1.7: clear method exists
  assert(
    typeof toolCreator.clear === 'function',
    'clear method exists'
  );

  // Test 1.8: createSimpleTool returns correct structure
  const result = await toolCreator.createSimpleTool(
    'test-tool',
    'Test tool for interface compliance',
    'command',
    {}
  );

  assert(
    typeof result.success === 'boolean',
    'createSimpleTool returns success boolean'
  );

  assert(
    typeof result.durationMs === 'number',
    'createSimpleTool returns durationMs number'
  );

  // Test 1.9: getStatistics returns correct structure
  const stats = toolCreator.getStatistics();

  assert(
    typeof stats.totalExecutions === 'number',
    'getStatistics returns totalExecutions'
  );

  assert(
    typeof stats.successfulExecutions === 'number',
    'getStatistics returns successfulExecutions'
  );

  assert(
    typeof stats.failedExecutions === 'number',
    'getStatistics returns failedExecutions'
  );

  assert(
    typeof stats.averageDurationMs === 'number',
    'getStatistics returns averageDurationMs'
  );

  assert(
    typeof stats.toolsCreated === 'number',
    'getStatistics returns toolsCreated'
  );
}

/**
 * Test 2: Error Classes
 */
async function testErrorClasses(): Promise<void> {
  logger.info('\n=== Test 2: Error Classes (5 types) ===');

  // Test 2.1: AgentError base class
  const baseError = new AgentError('Test error', 'TEST_CODE', { foo: 'bar' }, true);

  assert(
    baseError.code === 'TEST_CODE',
    'AgentError has code property'
  );

  assert(
    baseError.context?.foo === 'bar',
    'AgentError has context property'
  );

  assert(
    typeof baseError.timestamp === 'string',
    'AgentError has timestamp property'
  );

  assert(
    baseError.recoverable === true,
    'AgentError has recoverable property'
  );

  // Test 2.2: AgentError toJSON
  const json = baseError.toJSON();
  assert(
    json.code === 'TEST_CODE',
    'AgentError toJSON includes code'
  );

  // Test 2.3: AnalysisError - complexityCalculationFailed
  const analysisError1 = AnalysisError.complexityCalculationFailed('task-123', 'Invalid input');

  assert(
    analysisError1 instanceof AnalysisError,
    'complexityCalculationFailed returns AnalysisError'
  );

  assert(
    analysisError1.context?.taskId === 'task-123',
    'AnalysisError has taskId in context'
  );

  assert(
    analysisError1.context?.stage === 'complexity_calculation',
    'AnalysisError has stage in context'
  );

  // Test 2.4: AnalysisError - capabilityDetectionFailed
  const analysisError2 = AnalysisError.capabilityDetectionFailed('task-456', 'No capabilities found');

  assert(
    analysisError2.context?.stage === 'capability_detection',
    'capabilityDetectionFailed has correct stage'
  );

  // Test 2.5: AnalysisError - strategyDeterminationFailed
  const analysisError3 = AnalysisError.strategyDeterminationFailed('task-789', 'No strategy');

  assert(
    analysisError3.context?.stage === 'strategy_determination',
    'strategyDeterminationFailed has correct stage'
  );

  // Test 2.6: ToolCreationError - invalidToolType
  const toolError1 = ToolCreationError.invalidToolType('my-tool', 'invalid-type');

  assert(
    toolError1 instanceof ToolCreationError,
    'invalidToolType returns ToolCreationError'
  );

  assert(
    toolError1.context?.toolName === 'my-tool',
    'ToolCreationError has toolName in context'
  );

  // Test 2.7: ToolCreationError - codeGenerationFailed
  const toolError2 = ToolCreationError.codeGenerationFailed('my-tool', 'Syntax error');

  assert(
    toolError2.context?.stage === 'code_generation',
    'codeGenerationFailed has correct stage'
  );

  // Test 2.8: ToolCreationError - toolExecutionFailed
  const toolError3 = ToolCreationError.toolExecutionFailed('tool-id', 'tool-name', 'Runtime error');

  assert(
    toolError3.context?.stage === 'execution',
    'toolExecutionFailed has correct stage'
  );

  // Test 2.9: AssignmentError - noTemplateFound
  const assignError1 = AssignmentError.noTemplateFound('feature');

  assert(
    assignError1 instanceof AssignmentError,
    'noTemplateFound returns AssignmentError'
  );

  assert(
    assignError1.recoverable === false,
    'noTemplateFound is not recoverable'
  );

  // Test 2.10: AssignmentError - agentCreationFailed
  const assignError2 = AssignmentError.agentCreationFailed('template-id', 'Out of memory');

  assert(
    assignError2.context?.stage === 'agent_creation',
    'agentCreationFailed has correct stage'
  );

  // Test 2.11: AssignmentError - maxConcurrentTasksReached
  const assignError3 = AssignmentError.maxConcurrentTasksReached('agent-id', 10);

  assert(
    assignError3.context?.maxTasks === 10,
    'maxConcurrentTasksReached has maxTasks in context'
  );

  // Test 2.12: ExecutionError - templateExecutorFailed
  const execError1 = ExecutionError.templateExecutorFailed('template-id', 'task-id', 'Failed');

  assert(
    execError1 instanceof ExecutionError,
    'templateExecutorFailed returns ExecutionError'
  );

  // Test 2.13: ExecutionError - hookExecutionFailed
  const execError2 = ExecutionError.hookExecutionFailed('my-hook', 'pre', 'Hook error');

  assert(
    execError2.context?.hookType === 'pre',
    'hookExecutionFailed has hookType in context'
  );

  // Test 2.14: ExecutionError - resourceExhausted
  const execError3 = ExecutionError.resourceExhausted('memory', '1GB');

  assert(
    execError3.recoverable === false,
    'resourceExhausted is not recoverable'
  );

  // Test 2.15: TimeoutError - analysisTimeout
  const timeoutError1 = TimeoutError.analysisTimeout('task-id', 5000, 6000);

  assert(
    timeoutError1 instanceof TimeoutError,
    'analysisTimeout returns TimeoutError'
  );

  assert(
    timeoutError1.timeoutMs === 5000,
    'TimeoutError has timeoutMs property'
  );

  assert(
    timeoutError1.elapsedMs === 6000,
    'TimeoutError has elapsedMs property'
  );

  // Test 2.16: TimeoutError - toolCreationTimeout
  const timeoutError2 = TimeoutError.toolCreationTimeout('tool-name', 10000, 12000);

  assert(
    timeoutError2.operation === 'tool_creation',
    'toolCreationTimeout has correct operation'
  );

  // Test 2.17: TimeoutError - executionTimeout
  const timeoutError3 = TimeoutError.executionTimeout('task-id', 'agent-id', 30000, 35000);

  assert(
    timeoutError3.recoverable === false,
    'TimeoutError is not recoverable'
  );

  // Test 2.18: ErrorUtils - isRecoverable (AgentError)
  const recoverableError = new AgentError('Test', 'CODE', {}, true);
  assert(
    ErrorUtils.isRecoverable(recoverableError) === true,
    'ErrorUtils detects recoverable AgentError'
  );

  // Test 2.19: ErrorUtils - isRecoverable (non-recoverable)
  const nonRecoverableError = new AgentError('Test', 'CODE', {}, false);
  assert(
    ErrorUtils.isRecoverable(nonRecoverableError) === false,
    'ErrorUtils detects non-recoverable AgentError'
  );

  // Test 2.20: ErrorUtils - isRecoverable (unknown error)
  const unknownError = new Error('Unknown');
  assert(
    ErrorUtils.isRecoverable(unknownError) === true,
    'ErrorUtils assumes unknown errors are recoverable'
  );

  // Test 2.21: ErrorUtils - getErrorCode
  assertEquals(
    ErrorUtils.getErrorCode(baseError),
    'TEST_CODE',
    'ErrorUtils extracts error code'
  );

  // Test 2.22: ErrorUtils - getErrorCode (unknown error)
  assertEquals(
    ErrorUtils.getErrorCode(unknownError),
    'UNKNOWN_ERROR',
    'ErrorUtils returns UNKNOWN_ERROR for non-AgentError'
  );

  // Test 2.23: ErrorUtils - getErrorContext
  const context = ErrorUtils.getErrorContext(baseError);
  assert(
    context?.foo === 'bar',
    'ErrorUtils extracts error context'
  );

  // Test 2.24: ErrorUtils - formatError (AgentError)
  const formatted = ErrorUtils.formatError(baseError);
  assert(
    formatted.includes('TEST_CODE'),
    'ErrorUtils formats AgentError as JSON'
  );

  // Test 2.25: ErrorUtils - wrapError (AgentError)
  const wrapped1 = ErrorUtils.wrapError(baseError);
  assertEquals(
    wrapped1.code,
    'TEST_CODE',
    'ErrorUtils returns AgentError as-is'
  );

  // Test 2.26: ErrorUtils - wrapError (Error)
  const wrapped2 = ErrorUtils.wrapError(new Error('Test error'));
  assertEquals(
    wrapped2.code,
    'WRAPPED_ERROR',
    'ErrorUtils wraps Error as AgentError'
  );

  // Test 2.27: ErrorUtils - wrapError (unknown)
  const wrapped3 = ErrorUtils.wrapError('string error');
  assertEquals(
    wrapped3.code,
    'UNKNOWN_ERROR',
    'ErrorUtils wraps unknown as AgentError'
  );
}

/**
 * Test 3: Retry Logic
 */
async function testRetryLogic(): Promise<void> {
  logger.info('\n=== Test 3: Retry Logic with Exponential Backoff ===');

  // Test 3.1: Successful operation (no retry needed)
  let attempt = 0;
  const result1 = await retryWithBackoff(
    async () => {
      attempt++;
      return 'success';
    },
    { maxRetries: 3, initialDelayMs: 100 }
  );

  assert(result1.success === true, 'Successful operation returns success');
  assertEquals(result1.attempts, 1, 'Successful operation has 1 attempt');
  assert(result1.value === 'success', 'Successful operation returns value');

  // Test 3.2: Retry until success
  attempt = 0;
  const result2 = await retryWithBackoff(
    async () => {
      attempt++;
      if (attempt < 3) {
        throw new AgentError('Transient error', 'TRANSIENT', {}, true);
      }
      return 'success after retries';
    },
    { maxRetries: 5, initialDelayMs: 50 }
  );

  assert(result2.success === true, 'Retry succeeds after failures');
  assertEquals(result2.attempts, 3, 'Retry has correct attempt count');

  // Test 3.3: Max retries reached
  attempt = 0;
  const result3 = await retryWithBackoff(
    async () => {
      attempt++;
      throw new AgentError('Persistent error', 'PERSISTENT', {}, true);
    },
    { maxRetries: 3, initialDelayMs: 50 }
  );

  assert(result3.success === false, 'Max retries returns failure');
  assertEquals(result3.attempts, 4, 'Max retries attempts all tries (initial + 3 retries)');
  assert(result3.maxRetriesReached === true, 'Max retries flag is set');

  // Test 3.4: Non-retryable error
  attempt = 0;
  const result4 = await retryWithBackoff(
    async () => {
      attempt++;
      throw new AgentError('Fatal error', 'FATAL', {}, false);
    },
    {
      maxRetries: 3,
      initialDelayMs: 50,
      isRetryable: (error) => ErrorUtils.isRecoverable(error)
    }
  );

  assert(result4.success === false, 'Non-retryable error returns failure');
  assertEquals(result4.attempts, 1, 'Non-retryable error only attempts once');
  assert(result4.maxRetriesReached === false, 'Non-retryable error does not reach max retries');

  // Test 3.5: Timeout during operation
  const result5 = await retryWithBackoff(
    async () => {
      await sleep(200);
      return 'should timeout';
    },
    {
      maxRetries: 2,
      initialDelayMs: 50,
      attemptTimeoutMs: 100
    }
  );

  assert(result5.success === false, 'Timeout returns failure');
  assert(result5.error?.message.includes('timed out') ?? false, 'Timeout error message is correct');

  // Test 3.6: onRetry callback
  let retryCallbackCount = 0;
  void await retryWithBackoff(
    async () => {
      if (retryCallbackCount < 2) {
        throw new AgentError('Retry me', 'RETRY', {}, true);
      }
      return 'success';
    },
    {
      maxRetries: 3,
      initialDelayMs: 50,
      onRetry: (attempt, error, delayMs) => {
        retryCallbackCount++;
        assert(typeof attempt === 'number', 'onRetry receives attempt number');
        assert(error instanceof Error, 'onRetry receives error');
        assert(typeof delayMs === 'number', 'onRetry receives delay');
      }
    }
  );

  assertEquals(retryCallbackCount, 2, 'onRetry callback called correct number of times');

  // Test 3.7: retryUntil - predicate satisfied
  attempt = 0;
  const result7 = await retryUntil(
    async () => {
      attempt++;
      return attempt;
    },
    (result) => result >= 3,
    { maxRetries: 5, initialDelayMs: 50 }
  );

  assert(result7.success === true, 'retryUntil succeeds when predicate satisfied');
  assertEquals(result7.value, 3, 'retryUntil returns correct value');

  // Test 3.8: retryUntil - predicate never satisfied
  attempt = 0;
  const result8 = await retryUntil(
    async () => {
      attempt++;
      return 0;
    },
    (result) => result > 10,
    { maxRetries: 3, initialDelayMs: 50 }
  );

  assert(result8.success === false, 'retryUntil fails when predicate not satisfied');
  assert(result8.maxRetriesReached === true, 'retryUntil reaches max retries');

  // Test 3.9: retryBatch - all succeed
  const operations = [
    async () => 'result1',
    async () => 'result2',
    async () => 'result3',
  ];

  const results9 = await retryBatch(operations, { maxRetries: 2, initialDelayMs: 50 });

  assertEquals(results9.length, 3, 'retryBatch returns all results');
  assert(results9.every((r) => r.success), 'retryBatch all operations succeed');

  // Test 3.10: retryBatch - some fail
  let batchAttempt = 0;
  const operations10 = [
    async () => 'success',
    async () => {
      batchAttempt++;
      if (batchAttempt < 2) {
        throw new AgentError('Retry', 'RETRY', {}, true);
      }
      return 'success after retry';
    },
    async () => 'also success',
  ];

  const results10 = await retryBatch(operations10, { maxRetries: 3, initialDelayMs: 50 });

  assert(results10.every((r) => r.success), 'retryBatch retries failed operations');
}

/**
 * Test 4: TTLCache
 */
async function testTTLCache(): Promise<void> {
  logger.info('\n=== Test 4: TTLCache with LRU Eviction ===');

  // Test 4.1: Basic set/get
  const cache = new TTLCache<string>({ maxSize: 5, ttlMs: 1000, autoCleanup: false });

  cache.set('key1', 'value1');
  assertEquals(cache.get('key1'), 'value1', 'Basic set/get works');

  // Test 4.2: TTL expiration
  cache.set('key2', 'value2', 100); // 100ms TTL
  await sleep(150);
  assertEquals(cache.get('key2'), undefined, 'TTL expiration works');

  // Test 4.3: has() method
  cache.set('key3', 'value3');
  assert(cache.has('key3') === true, 'has() returns true for existing key');
  assert(cache.has('nonexistent') === false, 'has() returns false for missing key');

  // Test 4.4: delete() method
  cache.set('key4', 'value4');
  const deleted = cache.delete('key4');
  assert(deleted === true, 'delete() returns true');
  assert(cache.has('key4') === false, 'delete() removes key');

  // Test 4.5: size() method
  cache.clear();
  cache.set('k1', 'v1');
  cache.set('k2', 'v2');
  assertEquals(cache.size(), 2, 'size() returns correct count');

  // Test 4.6: LRU eviction
  cache.clear();
  const lruCache = new TTLCache<number>({ maxSize: 3, ttlMs: 10000, autoCleanup: false });

  lruCache.set('a', 1);
  await sleep(10);
  lruCache.set('b', 2);
  await sleep(10);
  lruCache.set('c', 3);
  await sleep(10);

  // Access 'a' to make it recently used
  lruCache.get('a');
  await sleep(10);

  // Add 'd' - should evict 'b' (least recently used)
  lruCache.set('d', 4);

  assert(lruCache.has('a') === true, 'LRU keeps recently accessed key');
  assert(lruCache.has('b') === false, 'LRU evicts least recently used key');
  assert(lruCache.has('c') === true, 'LRU keeps other keys');
  assert(lruCache.has('d') === true, 'LRU adds new key');

  // Test 4.7: keys(), values(), entries()
  cache.clear();
  cache.set('x', 'value-x');
  cache.set('y', 'value-y');

  const keys = cache.keys();
  assert(keys.includes('x') && keys.includes('y'), 'keys() returns all keys');

  const values = cache.values();
  assert(values.includes('value-x') && values.includes('value-y'), 'values() returns all values');

  const entries = cache.entries();
  assert(entries.length === 2, 'entries() returns all entries');

  // Test 4.8: clear() method
  cache.clear();
  assertEquals(cache.size(), 0, 'clear() removes all entries');

  // Test 4.9: getStats()
  cache.clear();
  cache.set('stat1', 'value1');
  cache.get('stat1'); // hit
  cache.get('stat1'); // hit
  cache.get('nonexistent'); // miss

  const stats = cache.getStats();
  assertEquals(stats.hits, 2, 'Stats track hits correctly');
  assertEquals(stats.misses, 1, 'Stats track misses correctly');
  assert(stats.hitRate > 0, 'Stats calculate hit rate');

  // Test 4.10: resetStats()
  cache.resetStats();
  const resetStats = cache.getStats();
  assertEquals(resetStats.hits, 0, 'resetStats() clears hits');
  assertEquals(resetStats.misses, 0, 'resetStats() clears misses');

  // Test 4.11: refresh()
  cache.clear();
  cache.set('refresh-key', 'value', 100); // 100ms TTL
  await sleep(50);

  const refreshed = cache.refresh('refresh-key', 200); // Extend by 200ms
  assert(refreshed === true, 'refresh() returns true for existing key');

  await sleep(120); // Original TTL would have expired
  assert(cache.has('refresh-key') === true, 'refresh() extends TTL');

  // Test 4.12: getOrSet() - cache hit
  cache.clear();
  cache.set('existing', 'cached-value');

  const getOrSetResult = await cache.getOrSet('existing', async () => 'new-value');
  assertEquals(getOrSetResult, 'cached-value', 'getOrSet() returns cached value');

  // Test 4.13: getOrSet() - cache miss
  const getOrSetResult2 = await cache.getOrSet('new-key', async () => 'computed-value');
  assertEquals(getOrSetResult2, 'computed-value', 'getOrSet() computes and caches new value');
  assertEquals(cache.get('new-key'), 'computed-value', 'getOrSet() stores computed value');

  // Test 4.14: cleanup() method
  const cleanupCache = new TTLCache<string>({ maxSize: 10, ttlMs: 100, autoCleanup: false });

  cleanupCache.set('expire1', 'value1', 50);
  cleanupCache.set('expire2', 'value2', 50);
  cleanupCache.set('keep', 'value3', 10000);

  await sleep(100);

  const expiredCount = cleanupCache.cleanup();
  assertEquals(expiredCount, 2, 'cleanup() returns count of expired entries');
  assert(cleanupCache.has('keep') === true, 'cleanup() keeps non-expired entries');

  // Test 4.15: onEvict callback
  let evictedKeys: string[] = [];
  const evictCache = new TTLCache<string>({
    maxSize: 2,
    ttlMs: 10000,
    autoCleanup: false,
    onEvict: (key, _value) => {
      evictedKeys.push(key);
    },
  });

  evictCache.set('e1', 'v1');
  evictCache.set('e2', 'v2');
  evictCache.set('e3', 'v3'); // Should evict e1

  assert(evictedKeys.length === 1, 'onEvict callback called on eviction');
  assert(evictedKeys[0] === 'e1', 'onEvict callback receives correct key');

  // Test 4.16: dispose() method
  const disposeCache = new TTLCache<string>({ maxSize: 5, ttlMs: 1000, autoCleanup: true });
  disposeCache.set('dispose-key', 'value');

  disposeCache.dispose();
  assertEquals(disposeCache.size(), 0, 'dispose() clears cache');

  // Test 4.17: Memoize function - cache hit
  let memoCallCount = 0;
  const memoizedFn = memoize(
    async (x: number) => {
      memoCallCount++;
      return x * 2;
    },
    { ttlMs: 1000 }
  );

  const memo1 = await memoizedFn(5);
  const memo2 = await memoizedFn(5);

  assertEquals(memo1, 10, 'Memoized function returns correct value');
  assertEquals(memo2, 10, 'Memoized function returns cached value');
  assertEquals(memoCallCount, 1, 'Memoized function only called once for same input');

  // Test 4.18: Memoize function - different args
  const memo3 = await memoizedFn(10);
  assertEquals(memo3, 20, 'Memoized function computes new value for different input');
  assertEquals(memoCallCount, 2, 'Memoized function called again for different input');

  // Test 4.19: Memoize function - custom key generator
  let customKeyCallCount = 0;
  const customMemoFn = memoize(
    async (obj: { id: number; name: string }) => {
      customKeyCallCount++;
      return obj.id;
    },
    {
      ttlMs: 1000,
      keyGenerator: (obj) => `id-${obj.id}`,
    }
  );

  await customMemoFn({ id: 1, name: 'Alice' });
  await customMemoFn({ id: 1, name: 'Bob' }); // Same id, different name

  assertEquals(customKeyCallCount, 1, 'Custom key generator uses specified key');

  // Test 4.20: getMetadata()
  cache.clear();
  cache.set('meta-key', 'meta-value');

  const metadata = cache.getMetadata('meta-key');
  assert(metadata !== undefined, 'getMetadata() returns metadata for existing key');
  assert(typeof metadata?.createdAt === 'number', 'Metadata includes createdAt');
  assert(typeof metadata?.lastAccessedAt === 'number', 'Metadata includes lastAccessedAt');
  assert(typeof metadata?.accessCount === 'number', 'Metadata includes accessCount');
  assert(typeof metadata?.expiresAt === 'number', 'Metadata includes expiresAt');
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  logger.info('🚀 Starting Phase 4 Improvements Test Suite\n');
  logger.info('Target: 50+ test cases\n');

  const startTime = Date.now();

  try {
    // Test Suite 1: IToolCreator Interface (13 tests)
    await testIToolCreatorInterface();

    // Test Suite 2: Error Classes (27 tests)
    await testErrorClasses();

    // Test Suite 3: Retry Logic (10 tests)
    await testRetryLogic();

    // Test Suite 4: TTLCache (20 tests)
    await testTTLCache();

    const duration = Date.now() - startTime;

    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Test Results Summary');
    logger.info('='.repeat(60));
    logger.info(`Total Tests: ${totalTests}`);
    logger.success(`Passed: ${passedTests} ✓`);

    if (failedTests > 0) {
      logger.error(`Failed: ${failedTests} ✗`);
    } else {
      logger.success(`Failed: ${failedTests}`);
    }

    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    logger.info(`Success Rate: ${successRate.toFixed(1)}%`);
    logger.info(`Duration: ${duration}ms`);
    logger.info('='.repeat(60));

    if (failedTests === 0) {
      logger.success('\n🎉 All tests passed! Phase 4 complete.');
    } else {
      logger.error('\n❌ Some tests failed. Please review the output above.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`\n❌ Test suite failed: ${(error as Error).message}`);
    logger.error((error as Error).stack || '');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
