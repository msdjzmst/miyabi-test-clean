/**
 * Security Validator Test Suite
 *
 * Tests dangerous pattern detection and code validation
 */

import {
  SecurityValidator,
  SecurityIssueType,
} from '../utils/security-validator';
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

/**
 * Test 1: Safe Code Detection
 */
async function testSafeCodeDetection(): Promise<void> {
  logger.info('\n=== Test 1: Safe Code Detection ===');

  // Test 1.1: Simple function
  const safeCode1 = `
function add(a, b) {
  return a + b;
}
  `.trim();

  const result1 = SecurityValidator.validate(safeCode1);
  assert(result1.safe === true, 'Simple function is safe');
  assert(result1.issues.length === 0, 'Simple function has no issues');

  // Test 1.2: Class with methods
  const safeCode2 = `
class Calculator {
  add(a, b) {
    return a + b;
  }
  multiply(a, b) {
    return a * b;
  }
}
  `.trim();

  const result2 = SecurityValidator.validate(safeCode2);
  assert(result2.safe === true, 'Class with methods is safe');

  // Test 1.3: Arrow functions
  const safeCode3 = `
const multiply = (a, b) => a * b;
const square = (x) => x * x;
  `.trim();

  const result3 = SecurityValidator.validate(safeCode3);
  assert(result3.safe === true, 'Arrow functions are safe');

  // Test 1.4: Safe JSON operations
  const safeCode4 = `
const data = JSON.parse('{"key": "value"}');
const str = JSON.stringify({ foo: 'bar' });
  `.trim();

  const result4 = SecurityValidator.validate(safeCode4);
  assert(result4.safe === true, 'JSON operations are safe');
}

/**
 * Test 2: eval() Detection
 */
async function testEvalDetection(): Promise<void> {
  logger.info('\n=== Test 2: eval() Detection ===');

  // Test 2.1: Direct eval
  const dangerousCode1 = `
function executeCode(code) {
  return eval(code);
}
  `.trim();

  const result1 = SecurityValidator.validate(dangerousCode1);
  assert(result1.safe === false, 'eval() is detected as unsafe');
  assert(result1.maxSeverity === 100, 'eval() has critical severity');
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.EVAL_USAGE),
    'eval() issue type is correct'
  );

  // Test 2.2: Function constructor
  const dangerousCode2 = `
const fn = new Function('a', 'b', 'return a + b');
  `.trim();

  const result2 = SecurityValidator.validate(dangerousCode2);
  assert(result2.safe === false, 'Function constructor is detected as unsafe');
  assert(
    result2.issues.some((issue) => issue.type === SecurityIssueType.ARBITRARY_CODE),
    'Function constructor issue type is correct'
  );

  // Test 2.3: validateOrThrow with eval
  try {
    SecurityValidator.validateOrThrow(dangerousCode1);
    assert(false, 'validateOrThrow should throw for eval()');
  } catch (error) {
    assert(true, 'validateOrThrow throws for eval()');
  }
}

/**
 * Test 3: Child Process Detection
 */
async function testChildProcessDetection(): Promise<void> {
  logger.info('\n=== Test 3: Child Process Detection ===');

  // Test 3.1: exec()
  const dangerousCode1 = `
const { exec } = require('child_process');
exec('ls -la', (error, stdout, stderr) => {
  console.log(stdout);
});
  `.trim();

  const result1 = SecurityValidator.validate(dangerousCode1);
  assert(result1.safe === false, 'exec() is detected as unsafe');
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.CHILD_PROCESS),
    'exec() issue type is correct'
  );

  // Test 3.2: spawn()
  const dangerousCode2 = `
const { spawn } = require('child_process');
const child = spawn('ls', ['-la']);
  `.trim();

  const result2 = SecurityValidator.validate(dangerousCode2);
  assert(result2.safe === false, 'spawn() is detected as unsafe');

  // Test 3.3: execSync()
  const dangerousCode3 = `
const { execSync } = require('child_process');
const output = execSync('whoami');
  `.trim();

  const result3 = SecurityValidator.validate(dangerousCode3);
  assert(result3.safe === false, 'execSync() is detected as unsafe');

  // Test 3.4: fork()
  const dangerousCode4 = `
const { fork } = require('child_process');
const child = fork('./worker.js');
  `.trim();

  const result4 = SecurityValidator.validate(dangerousCode4);
  assert(result4.safe === false, 'fork() is detected as unsafe');
}

/**
 * Test 4: File System Operations
 */
async function testFileSystemDetection(): Promise<void> {
  logger.info('\n=== Test 4: File System Operations ===');

  // Test 4.1: writeFile
  const code1 = `
const fs = require('fs');
fs.writeFile('/tmp/test.txt', 'data', (err) => {});
  `.trim();

  const result1 = SecurityValidator.validate(code1);
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.FILE_SYSTEM_WRITE),
    'writeFile is detected'
  );

  // Test 4.2: appendFile
  const code2 = `
fs.appendFile('/var/log/app.log', 'log entry', (err) => {});
  `.trim();

  const result2 = SecurityValidator.validate(code2);
  assert(
    result2.issues.some((issue) => issue.type === SecurityIssueType.FILE_SYSTEM_WRITE),
    'appendFile is detected'
  );

  // Test 4.3: unlink (delete)
  const code3 = `
fs.unlink('/tmp/file.txt', (err) => {});
  `.trim();

  const result3 = SecurityValidator.validate(code3);
  assert(
    result3.issues.some((issue) => issue.type === SecurityIssueType.FILE_SYSTEM_WRITE),
    'unlink is detected'
  );
}

/**
 * Test 5: Network Requests
 */
async function testNetworkDetection(): Promise<void> {
  logger.info('\n=== Test 5: Network Requests ===');

  // Test 5.1: fetch
  const code1 = `
const response = await fetch('https://api.example.com/data');
const data = await response.json();
  `.trim();

  const result1 = SecurityValidator.validate(code1);
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.NETWORK_REQUEST),
    'fetch is detected'
  );

  // Test 5.2: http.request
  const code2 = `
const http = require('http');
http.request('http://example.com', (res) => {});
  `.trim();

  const result2 = SecurityValidator.validate(code2);
  assert(
    result2.issues.some((issue) => issue.type === SecurityIssueType.NETWORK_REQUEST),
    'http.request is detected'
  );

  // Test 5.3: axios
  const code3 = `
const axios = require('axios');
const response = await axios.get('https://api.example.com');
  `.trim();

  const result3 = SecurityValidator.validate(code3);
  assert(
    result3.issues.some((issue) => issue.type === SecurityIssueType.NETWORK_REQUEST),
    'axios is detected'
  );
}

/**
 * Test 6: Environment Access
 */
async function testEnvironmentAccess(): Promise<void> {
  logger.info('\n=== Test 6: Environment Access ===');

  // Test 6.1: process.env
  const code1 = `
const apiKey = process.env.API_KEY;
  `.trim();

  const result1 = SecurityValidator.validate(code1);
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.ENVIRONMENT_ACCESS),
    'process.env is detected'
  );

  // Test 6.2: process.exit
  const code2 = `
if (error) {
  process.exit(1);
}
  `.trim();

  const result2 = SecurityValidator.validate(code2);
  assert(
    result2.issues.some((issue) => issue.type === SecurityIssueType.ENVIRONMENT_ACCESS),
    'process.exit is detected'
  );
}

/**
 * Test 7: Prototype Pollution
 */
async function testPrototypePollution(): Promise<void> {
  logger.info('\n=== Test 7: Prototype Pollution ===');

  // Test 7.1: __proto__ access
  const code1 = `
const obj = {};
obj.__proto__['polluted'] = 'value';
  `.trim();

  const result1 = SecurityValidator.validate(code1);
  assert(
    result1.issues.some((issue) => issue.type === SecurityIssueType.PROTOTYPE_POLLUTION),
    '__proto__ access is detected'
  );

  // Test 7.2: constructor.prototype access
  const code2 = `
obj.constructor.prototype['polluted'] = 'value';
  `.trim();

  const result2 = SecurityValidator.validate(code2);
  assert(
    result2.issues.some((issue) => issue.type === SecurityIssueType.PROTOTYPE_POLLUTION),
    'constructor.prototype is detected'
  );
}

/**
 * Test 8: Security Score Calculation
 */
async function testSecurityScore(): Promise<void> {
  logger.info('\n=== Test 8: Security Score Calculation ===');

  // Test 8.1: Perfect score for safe code
  const safeCode = `
function add(a, b) {
  return a + b;
}
  `.trim();

  const score1 = SecurityValidator.getSecurityScore(safeCode);
  assert(score1 === 100, 'Safe code has 100 security score');

  // Test 8.2: Low score for dangerous code
  const dangerousCode = `
function executeCode(code) {
  return eval(code);
}
  `.trim();

  const score2 = SecurityValidator.getSecurityScore(dangerousCode);
  assert(score2 < 50, 'Dangerous code has low security score');

  // Test 8.3: Medium score for network request
  const networkCode = `
const response = await fetch('https://api.example.com');
  `.trim();

  const score3 = SecurityValidator.getSecurityScore(networkCode);
  assert(score3 > 0 && score3 < 100, 'Network code has medium security score');
}

/**
 * Test 9: Code Sanitization
 */
async function testCodeSanitization(): Promise<void> {
  logger.info('\n=== Test 9: Code Sanitization ===');

  // Test 9.1: Sanitize eval
  const code1 = `
function test() {
  return eval('1 + 1');
}
  `.trim();

  const { sanitized, removed } = SecurityValidator.sanitize(code1);
  assert(
    sanitized.includes('/* REMOVED: eval() call */'),
    'eval is sanitized'
  );
  assert(removed.length > 0, 'Removal is tracked');

  // Test 9.2: Sanitize multiple dangerous patterns
  const code2 = `
eval('code');
new Function('return 1');
exec('ls');
  `.trim();

  const { removed: removed2 } = SecurityValidator.sanitize(code2);
  assert(removed2.length === 3, 'All dangerous patterns are sanitized');
}

/**
 * Test 10: Security Report Generation
 */
async function testSecurityReport(): Promise<void> {
  logger.info('\n=== Test 10: Security Report Generation ===');

  // Test 10.1: Report for safe code
  const safeCode = `
function add(a, b) {
  return a + b;
}
  `.trim();

  const report1 = SecurityValidator.generateReport(safeCode);
  assert(report1.includes('100/100'), 'Report shows perfect score');
  assert(report1.includes('SAFE'), 'Report shows safe status');

  // Test 10.2: Report for dangerous code
  const dangerousCode = `
eval('code');
exec('ls');
  `.trim();

  const report2 = SecurityValidator.generateReport(dangerousCode);
  assert(report2.includes('UNSAFE'), 'Report shows unsafe status');
  assert(report2.includes('CRITICAL'), 'Report shows critical issues');
}

/**
 * Test 11: hasIssueType Helper
 */
async function testHasIssueType(): Promise<void> {
  logger.info('\n=== Test 11: hasIssueType Helper ===');

  const code = `
eval('test');
fetch('https://example.com');
  `.trim();

  assert(
    SecurityValidator.hasIssueType(code, SecurityIssueType.EVAL_USAGE),
    'hasIssueType detects eval'
  );

  assert(
    SecurityValidator.hasIssueType(code, SecurityIssueType.NETWORK_REQUEST),
    'hasIssueType detects network request'
  );

  assert(
    !SecurityValidator.hasIssueType(code, SecurityIssueType.CHILD_PROCESS),
    'hasIssueType returns false for missing type'
  );
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  logger.info('🚀 Starting Security Validator Test Suite\n');

  const startTime = Date.now();

  try {
    // Test Suite 1: Safe Code Detection
    await testSafeCodeDetection();

    // Test Suite 2: eval() Detection
    await testEvalDetection();

    // Test Suite 3: Child Process Detection
    await testChildProcessDetection();

    // Test Suite 4: File System Operations
    await testFileSystemDetection();

    // Test Suite 5: Network Requests
    await testNetworkDetection();

    // Test Suite 6: Environment Access
    await testEnvironmentAccess();

    // Test Suite 7: Prototype Pollution
    await testPrototypePollution();

    // Test Suite 8: Security Score Calculation
    await testSecurityScore();

    // Test Suite 9: Code Sanitization
    await testCodeSanitization();

    // Test Suite 10: Security Report Generation
    await testSecurityReport();

    // Test Suite 11: hasIssueType Helper
    await testHasIssueType();

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
      logger.success('\n🎉 All security validator tests passed!');
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
