# Verification Scripts - Auto-Loop Pattern

**Version**: 1.0.0
**Purpose**: Automated verification workflows for Claude Code agents
**Pattern**: OpenAI Dev Day - Auto-Loop until perfect quality

---

## 📋 Overview

OpenAI Dev Day demonstrated that **verification scripts + auto-loop** is the key to perfect quality:

1. Make change
2. Run verification script
3. If fail, analyze diff and iterate
4. Repeat until all checks pass
5. Only then mark task as complete

**Use unique terminology**: "**exec verify**" for automatic verification loops.

This ensures Claude Code recognizes verification as a special operation distinct from normal implementation.

---

## 🎯 Unique Terminology

Use these terms consistently to help Claude Code recognize special operations:

| Term | Meaning | Usage Example |
|------|---------|---------------|
| **exec verify** | Execute verification loop | `await this.execVerify()` |
| **exec plan** | Execute with execution plan | `const plan = await this.execPlan(issue)` |
| **exec review** | Execute review loop | `/review` command (Phase 3) |
| **auto-loop** | Automatic iteration until success | While loop with max iterations |

These unique terms help Claude Code's pattern recognition system identify and properly handle special workflows.

---

## 🔧 Verification Scripts

### For UI Changes

When implementing UI changes (React, Vue, Svelte, etc.):

```bash
# Step 1: Generate snapshots
npm run snapshot:generate

# Step 2: Compare with expected
npm run snapshot:compare

# Step 3: If diff > 2%, iterate
if [ $? -ne 0 ]; then
  echo "Snapshot diff detected - iterating"
  # Analyze diff
  git diff tests/**/__snapshots__
  # Make adjustments
  # Repeat from Step 1
fi
```

**Auto-Loop Pattern**:
- Loop until snapshot diff ≤ 2%
- Maximum 10 iterations
- Log each iteration for debugging
- Escalate to human if max iterations reached

**Example TypeScript Implementation**:

```typescript
async execVerifyUI(task: Task): Promise<VerificationResult> {
  let iteration = 0;
  const MAX_ITERATIONS = 10;
  let passed = false;

  while (!passed && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n🔍 UI Verification Iteration ${iteration}/${MAX_ITERATIONS}\n`);

    // Generate new snapshots
    await execCommand('npm run snapshot:generate');

    // Compare with expected
    const compareResult = await execCommand('npm run snapshot:compare');

    if (compareResult.exitCode === 0) {
      passed = true;
      console.log(`✅ Snapshots match! UI verification passed.\n`);
    } else {
      console.log(`❌ Snapshot diff detected (${compareResult.diff}%)\n`);
      // Analyze diff and adjust implementation
      await this.analyzeSnapshotDiff();
    }
  }

  if (!passed) {
    throw new Error('Max iterations reached - escalating to human reviewer');
  }

  return { passed, iterations: iteration };
}
```

---

### For API Changes

When implementing API changes (REST, GraphQL, etc.):

```bash
# Step 1: Run integration tests
npm run api:test:integration

# Step 2: Run load tests
npm run api:load-test

# Step 3: Verify performance
npm run benchmark:compare -- --compare-with=main

# Step 4: If any fail, iterate
if [ $? -ne 0 ]; then
  echo "API tests failed - iterating"
  # Analyze failures
  cat test-results/integration.log
  # Fix issues
  # Repeat from Step 1
fi
```

**Auto-Loop Pattern**:
- Loop until all tests pass
- Performance degradation < 10%
- Response time < 200ms (P95)
- Maximum 10 iterations

**Example TypeScript Implementation**:

```typescript
async execVerifyAPI(task: Task): Promise<VerificationResult> {
  let iteration = 0;
  const MAX_ITERATIONS = 10;
  let passed = false;

  while (!passed && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n🔍 API Verification Iteration ${iteration}/${MAX_ITERATIONS}\n`);

    // Run integration tests
    const integrationResult = await execCommand('npm run api:test:integration');

    // Run performance benchmark
    const perfResult = await execCommand('npm run benchmark:compare -- --compare-with=main');

    if (integrationResult.exitCode === 0 && perfResult.degradation < 10) {
      passed = true;
      console.log(`✅ API tests passed! Performance degradation: ${perfResult.degradation}%\n`);
    } else {
      console.log(`❌ API verification failed\n`);
      console.log(`   - Integration: ${integrationResult.failed} failed\n`);
      console.log(`   - Performance: ${perfResult.degradation}% degradation\n`);
      // Fix issues and iterate
    }
  }

  if (!passed) {
    throw new Error('Max iterations reached - escalating to human reviewer');
  }

  return { passed, iterations: iteration };
}
```

---

### For Performance Changes

When optimizing performance:

```bash
# Step 1: Baseline measurement
npm run benchmark -- --baseline

# Step 2: Make optimization
# (Edit code)

# Step 3: Compare with baseline
npm run benchmark:compare -- --compare-with=baseline

# Step 4: If improvement < 20%, iterate
IMPROVEMENT=$(cat benchmark-results/improvement.txt)
if [ "$IMPROVEMENT" -lt 20 ]; then
  echo "Insufficient improvement ($IMPROVEMENT%) - iterating"
  # Try different approach
  # Repeat from Step 2
fi
```

**Auto-Loop Pattern**:
- Loop until ≥20% improvement
- No quality degradation
- Maximum 5 iterations (performance optimization is expensive)

**Example TypeScript Implementation**:

```typescript
async execVerifyPerformance(task: Task): Promise<VerificationResult> {
  let iteration = 0;
  const MAX_ITERATIONS = 5;
  let passed = false;

  // Step 1: Baseline
  await execCommand('npm run benchmark -- --baseline');

  while (!passed && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n🔍 Performance Verification Iteration ${iteration}/${MAX_ITERATIONS}\n`);

    // Make optimization
    await this.optimizeCode(task);

    // Compare with baseline
    const benchmarkResult = await execCommand('npm run benchmark:compare -- --compare-with=baseline');

    if (benchmarkResult.improvement >= 20 && benchmarkResult.qualityLoss === 0) {
      passed = true;
      console.log(`✅ Performance improved by ${benchmarkResult.improvement}%!\n`);
    } else {
      console.log(`❌ Insufficient improvement: ${benchmarkResult.improvement}%\n`);
      // Try different approach
    }
  }

  if (!passed) {
    throw new Error('Max iterations reached - unable to achieve 20% improvement');
  }

  return { passed, iterations: iteration, improvement: benchmarkResult.improvement };
}
```

---

### For Security Changes

When fixing security issues:

```bash
# Step 1: Run security scan
npm run security:scan

# Step 2: Run dependency audit
npm run security:audit

# Step 3: Verify no secrets
grep -r "api.*key\|token\|password" src/ || echo "No secrets found"

# Step 4: If any critical issues, iterate
CRITICAL=$(jq '.vulnerabilities.critical' security-report.json)
if [ "$CRITICAL" -gt 0 ]; then
  echo "$CRITICAL critical vulnerabilities - iterating"
  # Fix vulnerabilities
  # Repeat from Step 1
fi
```

**Auto-Loop Pattern**:
- Loop until 0 critical vulnerabilities
- 0 hardcoded secrets
- Maximum 3 iterations (security fixes are critical)

**Example TypeScript Implementation**:

```typescript
async execVerifySecurity(task: Task): Promise<VerificationResult> {
  let iteration = 0;
  const MAX_ITERATIONS = 3;
  let passed = false;

  while (!passed && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n🔍 Security Verification Iteration ${iteration}/${MAX_ITERATIONS}\n`);

    // Run security scan
    const scanResult = await execCommand('npm run security:scan');

    // Run dependency audit
    const auditResult = await execCommand('npm run security:audit');

    const criticalCount = scanResult.vulnerabilities.critical;
    const secretsFound = scanResult.secrets.length;

    if (criticalCount === 0 && secretsFound === 0) {
      passed = true;
      console.log(`✅ Security verification passed!\n`);
    } else {
      console.log(`❌ Security issues detected:\n`);
      console.log(`   - Critical vulnerabilities: ${criticalCount}\n`);
      console.log(`   - Hardcoded secrets: ${secretsFound}\n`);
      // Fix issues
      await this.fixSecurityIssues(scanResult);
    }
  }

  if (!passed) {
    // Security issues are critical - escalate immediately
    throw new Error('CRITICAL: Security vulnerabilities remain - escalating to CISO');
  }

  return { passed, iterations: iteration };
}
```

---

## 🤖 Agent-Specific Workflows

### CodeGenAgent

When CodeGenAgent generates code:

1. Generate code
2. Run `npm run verify:all`
3. If fail:
   - Analyze errors
   - Regenerate code
   - Repeat Step 2
4. Loop until all checks pass

**Implementation Pattern**:

```typescript
// agents/codegen/codegen-agent.ts

export class CodeGenAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    let iteration = 0;
    const MAX_ITERATIONS = 10;
    let passed = false;
    let generatedCode: string | null = null;

    while (!passed && iteration < MAX_ITERATIONS) {
      iteration++;
      this.log(`\n🔍 CodeGen Iteration ${iteration}/${MAX_ITERATIONS}\n`);

      // Generate code
      generatedCode = await this.generateCode(task);
      await this.writeCodeToFile(generatedCode, task.metadata?.targetFile);

      // Exec verify (unique terminology!)
      const verifyResult = await this.execVerify();

      if (verifyResult.passed) {
        passed = true;
        this.log(`✅ Code generation passed verification!\n`);
      } else {
        this.log(`❌ Verification failed - iterating\n`);
        // Analyze failures and iterate
        await this.analyzeFailures(verifyResult);
      }
    }

    if (!passed) {
      return {
        status: 'failed',
        error: 'Max iterations reached - code quality insufficient',
        metrics: { iterations: iteration },
      };
    }

    return {
      status: 'success',
      data: { generatedCode },
      metrics: { iterations: iteration },
    };
  }

  private async execVerify(): Promise<VerificationResult> {
    // Run comprehensive verification
    const lintResult = await execCommand('npm run lint');
    const typecheckResult = await execCommand('npm run typecheck');
    const testResult = await execCommand('npm run test');
    const securityResult = await execCommand('npm run security:scan');

    const passed =
      lintResult.exitCode === 0 &&
      typecheckResult.exitCode === 0 &&
      testResult.exitCode === 0 &&
      securityResult.exitCode === 0;

    return {
      passed,
      lintErrors: lintResult.errors,
      typeErrors: typecheckResult.errors,
      testFailures: testResult.failures,
      securityIssues: securityResult.issues,
    };
  }
}
```

---

### ReviewAgent

When ReviewAgent reviews code:

1. Run static analysis
2. Run security scan
3. Run tests with coverage
4. Calculate quality score
5. If score < 80:
   - Generate fix suggestions
   - Wait for fixes
   - Repeat Step 1
6. Loop until score ≥ 80

**Uses `/review` command** (see Phase 3: Issue #101)

**Implementation Pattern**:

```typescript
// agents/review/review-agent.ts

export class ReviewAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    // ReviewAgent uses ReviewLoop (Phase 3)
    const loop = new ReviewLoop(this, {
      threshold: 80,
      maxIterations: 10,
      autoFix: task.metadata?.autoFix ?? false,
      verbose: task.metadata?.verbose ?? false,
    });

    const result = await loop.execute();

    return {
      status: result.passed ? 'success' : 'failed',
      data: { qualityReport: result.finalReport },
      metrics: { iterations: result.iterations, finalScore: result.finalScore },
    };
  }
}
```

**See Also**: `.claude/commands/review.md` for full /review command specification

---

### DeploymentAgent

When DeploymentAgent deploys:

1. Run `npm run verify:all`
2. Build production bundle
3. Run smoke tests
4. Deploy to staging
5. Health check
6. If fail:
   - Rollback
   - Fix issues
   - Repeat from Step 1
7. Loop until health check passes

**Implementation Pattern**:

```typescript
// agents/deployment/deployment-agent.ts

export class DeploymentAgent extends BaseAgent {
  async execute(task: Task): Promise<AgentResult> {
    let iteration = 0;
    const MAX_ITERATIONS = 3; // Deployments are expensive
    let deployed = false;

    while (!deployed && iteration < MAX_ITERATIONS) {
      iteration++;
      this.log(`\n🚀 Deployment Attempt ${iteration}/${MAX_ITERATIONS}\n`);

      try {
        // Step 1: Verify all
        await this.execVerify();

        // Step 2: Build
        await execCommand('npm run build');

        // Step 3: Smoke tests
        await execCommand('npm run test:smoke');

        // Step 4: Deploy staging
        await this.deployToStaging();

        // Step 5: Health check
        const healthy = await this.healthCheck();

        if (healthy) {
          deployed = true;
          this.log(`✅ Deployment successful!\n`);
        } else {
          this.log(`❌ Health check failed - rolling back\n`);
          await this.rollback();
        }
      } catch (error) {
        this.log(`❌ Deployment failed: ${error.message}\n`);
        await this.rollback();
      }
    }

    if (!deployed) {
      return {
        status: 'failed',
        error: 'Max deployment attempts reached',
        data: { rollbackExecuted: true },
      };
    }

    return {
      status: 'success',
      data: { deployed: true, healthCheckPassed: true },
      metrics: { iterations: iteration },
    };
  }

  private async execVerify(): Promise<void> {
    const result = await execCommand('npm run verify:all');
    if (result.exitCode !== 0) {
      throw new Error('Pre-deployment verification failed');
    }
  }

  private async healthCheck(): Promise<boolean> {
    // Implement health check logic
    const response = await fetch('https://staging.example.com/health');
    return response.ok;
  }

  private async rollback(): Promise<void> {
    this.log(`🔄 Rolling back deployment...\n`);
    await execCommand('npm run cicd:rollback');
  }
}
```

---

## 📊 Verification Script Reference

### Available Scripts (package.json)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `npm run lint` | ESLint code quality check | After code changes |
| `npm run typecheck` | TypeScript type checking | After type changes |
| `npm run test` | Run all unit/integration tests | After feature implementation |
| `npm run snapshot:generate` | Generate UI snapshots | After UI changes |
| `npm run snapshot:compare` | Compare UI snapshots | During UI verification |
| `npm run snapshot:ui` | Interactive snapshot testing | During UI development |
| `npm run api:test:integration` | API integration tests | After API changes |
| `npm run api:load-test` | API load testing | Before production deploy |
| `npm run benchmark` | Performance benchmarking | After optimization |
| `npm run benchmark:compare` | Compare with baseline | During performance verification |
| `npm run security:scan` | Security vulnerability scan | Before PR/deploy |
| `npm run security:audit` | NPM dependency audit | Weekly/before deploy |
| `npm run verify:all` | Run all verification checks | Before commit/PR/deploy |

---

## 🎯 Best Practices

### 1. Always Set Max Iterations

```typescript
// ✅ Good
let iteration = 0;
const MAX_ITERATIONS = 10;

while (!passed && iteration < MAX_ITERATIONS) {
  iteration++;
  // ...
}

// ❌ Bad
while (!passed) {
  // Infinite loop risk!
}
```

### 2. Log Each Iteration

```typescript
// ✅ Good
console.log(`\n🔍 Verification Iteration ${iteration}/${MAX_ITERATIONS}\n`);

// This helps debug failures and understand iteration patterns
```

### 3. Use Unique Terminology

```typescript
// ✅ Good - Clear and recognizable
await this.execVerify();
const plan = await this.execPlan(issue);

// ❌ Bad - Generic and unclear
await this.verify();
const plan = await this.plan(issue);
```

### 4. Fail Fast

```typescript
// ✅ Good
if (criticalError) {
  throw new Error('Critical failure - cannot proceed');
}

// Don't waste iterations on unrecoverable errors
```

### 5. Measure Improvement

```typescript
// ✅ Good
const improvement = ((baseline - current) / baseline) * 100;
console.log(`Improvement: ${improvement}%`);

// Track metrics across iterations to see progress
```

### 6. Escalate Appropriately

```typescript
// ✅ Good
if (iteration >= MAX_ITERATIONS) {
  if (task.type === 'security') {
    throw new Error('CRITICAL: Security issues remain - escalating to CISO');
  } else {
    throw new Error('Max iterations reached - escalating to human reviewer');
  }
}
```

---

## ⚠️ Troubleshooting

### Issue: Infinite loop detected

**Symptoms**: Process hangs indefinitely, no exit

**Cause**: No exit condition or max iterations not set

**Solution**:
```typescript
let iteration = 0;
const MAX_ITERATIONS = 10;

while (!passed && iteration < MAX_ITERATIONS) {
  iteration++;
  // ...
}

if (iteration >= MAX_ITERATIONS) {
  throw new Error('Max iterations reached - escalating to human');
}
```

---

### Issue: Verification script fails silently

**Symptoms**: Script reports success but issues remain

**Cause**: Script exits with code 0 even on failure

**Solution**:
```bash
# ✅ Always use explicit exit codes
npm run test || exit 1
npm run lint || exit 1

# ❌ Don't ignore failures
npm run test
npm run lint
```

---

### Issue: Auto-loop takes too long

**Symptoms**: Each iteration takes >5 minutes, timeouts occur

**Cause**: Complex verification or slow tests

**Solutions**:

1. **Run expensive checks less frequently**:
```typescript
if (iteration % 3 === 0) {
  // Only run load tests every 3rd iteration
  await execCommand('npm run api:load-test');
}
```

2. **Use parallel execution**:
```typescript
const [lintResult, typecheckResult, testResult] = await Promise.all([
  execCommand('npm run lint'),
  execCommand('npm run typecheck'),
  execCommand('npm run test'),
]);
```

3. **Set shorter timeout for individual checks**:
```typescript
const result = await execCommand('npm run test', { timeout: 60000 }); // 1 minute
```

---

### Issue: Iteration count always hits maximum

**Symptoms**: Never achieves passing state, always fails at max iterations

**Cause**: Unrealistic success criteria or incorrect implementation

**Solutions**:

1. **Lower success threshold temporarily**:
```typescript
// For debugging
const threshold = 70; // Instead of 80
```

2. **Add detailed logging**:
```typescript
console.log('Verification failures:', {
  lintErrors: verifyResult.lintErrors.length,
  typeErrors: verifyResult.typeErrors.length,
  testFailures: verifyResult.testFailures.length,
});
```

3. **Review success criteria**:
```typescript
// Maybe you need to adjust what "passed" means
const passed = verifyResult.criticalErrors === 0; // Instead of all errors === 0
```

---

## 🔗 Related Documentation

- **Phase 3 - /review Command**: `.claude/commands/review.md` - Interactive review loop with auto-fix
- **Agent Specifications**: `.claude/agents/specs/coding/*.md` - Individual agent specs
- **Agent Prompts**: `.claude/agents/prompts/coding/*-agent-prompt.md` - Execution prompts
- **Task Management Protocol**: `.claude/prompts/task-management-protocol.md` - Todo management

---

## 📚 References

- **OpenAI Dev Day**: Nacho/Feler/Daniel's integrated approach to AI-driven development
- **Claude Code Documentation**: https://docs.claude.com/en/docs/claude-code
- **Miyabi Project**: Full autonomous development framework with 21 agents

---

**Generated by**: Phase 4 - Task 4.3 (Issue #102)
**Pattern**: OpenAI Dev Day - Auto-Loop until perfect quality
**Version**: 1.0.0

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
