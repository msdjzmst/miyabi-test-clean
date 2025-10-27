# MCP Servers Health Check & Testing

**Issue**: #141 - MCP Server統合テスト・ヘルスチェックの実装
**Status**: Implemented ✅
**Version**: 1.0.0
**Last Updated**: 2025-10-20

---

## 📋 Overview

Automated health check and testing infrastructure for all 7 MCP servers in the Miyabi platform.

**MCP Servers**:
1. `ide-integration` - VS Code diagnostics & Jupyter execution
2. `github-enhanced` - GitHub Issue/PR management
3. `project-context` - Project-specific context
4. `filesystem` - Filesystem access
5. `context-engineering` - AI-powered context analysis
6. `miyabi` - Miyabi CLI integration
7. `gemini-image-generation` - Image generation (Gemini 2.5)

---

## 🚀 Quick Start

### Run Health Check

```bash
# Standard output
npm run mcp:health-check

# JSON output
npm run mcp:health-check:json

# Verbose output
npm run mcp:health-check:verbose
```

**Output**:
```
🔍 MCP Servers Health Check
============================

[ide-integration] ... ✅ OK (1234ms)
[github-enhanced] ... ✅ OK (987ms)
[project-context] ... ✅ OK (876ms)
[filesystem] ... ✅ OK (543ms)
[context-engineering] ... ⚠️  DISABLED
[miyabi] ... ✅ OK (1098ms)
[gemini-image-generation] ... ✅ OK (1567ms)

============================
📊 Summary:
   Total: 7
   ✅ Passed: 6
   ❌ Failed: 0
   ⚠️  Disabled: 1

✅ All enabled MCP servers are healthy
```

### Run Integration Tests

```bash
# All integration tests
npm run test:mcp:integration

# All performance tests
npm run test:mcp:performance

# All MCP tests
npm run test:mcp:all
```

---

## 📁 File Structure

```
.claude/mcp-servers/
├── HEALTH_CHECK.md               # This file
├── health-check.sh                # Health check script (150 lines)
├── check-server.js                # Individual server checker (150 lines)
├── __tests__/
│   ├── integration.test.ts        # Integration tests (300 lines)
│   └── performance.test.ts        # Performance tests (350 lines)
└── mcp.json                       # MCP server configuration

.github/workflows/
└── mcp-health-check.yml          # CI/CD workflow (200 lines)

package.json
└── scripts:
    ├── mcp:health-check           # Standard health check
    ├── mcp:health-check:json      # JSON output
    ├── mcp:health-check:verbose   # Verbose output
    ├── test:mcp:integration       # Integration tests
    ├── test:mcp:performance       # Performance tests
    └── test:mcp:all               # All MCP tests
```

---

## 🔧 Components

### 1. health-check.sh

Bash script that checks all MCP servers in parallel.

**Features**:
- ✅ Parallel execution for speed
- ✅ JSON output mode
- ✅ Verbose mode for debugging
- ✅ Exit code (0=success, 1=failure)

**Usage**:
```bash
bash .claude/mcp-servers/health-check.sh [--json] [--verbose]
```

### 2. check-server.js

Node.js script that checks individual MCP server health.

**Features**:
- ✅ Process spawning with timeout
- ✅ Initialization detection
- ✅ Response time measurement
- ✅ JSON output

**Usage**:
```bash
node .claude/mcp-servers/check-server.js <server-name>
```

### 3. integration.test.ts

Vitest integration tests for MCP servers.

**Test Suites**:
- Connection Tests (all 7 servers)
- Fallback Tests (error handling)
- Performance Tests (parallel execution)
- Timeout Handling
- Error Handling
- Health Check Status

**Usage**:
```bash
npm run test:mcp:integration
```

### 4. performance.test.ts

Vitest performance benchmarks for MCP servers.

**Test Suites**:
- Response Time Benchmarks
- Throughput Measurement
- Sequential vs Parallel Performance
- Load Testing (burst & sustained)
- Performance Regression Detection
- Resource Usage

**Usage**:
```bash
npm run test:mcp:performance
```

### 5. mcp-health-check.yml

GitHub Actions workflow for automated health checks.

**Triggers**:
- Daily schedule (00:00 UTC)
- Manual dispatch
- Pull requests to main

**Jobs**:
1. `health-check` - Run health check script
2. `integration-tests` - Run Vitest integration tests
3. `performance-tests` - Run Vitest performance tests
4. `notify` - Create GitHub Issue on failure

---

## 📊 Test Coverage

### Integration Tests

| Test Category | Test Count | Coverage |
|---------------|-----------|----------|
| Connection Tests | 7 | All servers |
| Fallback Tests | 2 | Error scenarios |
| Performance Tests | 2 | Parallel execution |
| Timeout Handling | 2 | Edge cases |
| Error Handling | 2 | Malformed input |
| Health Status | 1 | Overall status |

### Performance Tests

| Test Category | Test Count | Focus |
|---------------|-----------|-------|
| Response Time | 2 | Individual & ranking |
| Throughput | 2 | Sequential & parallel |
| Load Testing | 2 | Burst & sustained |
| Comparison | 1 | Sequential vs parallel |
| Regression | 1 | Baseline metrics |
| Resource Usage | 1 | Memory consumption |

---

## 🎯 Usage Examples

### Example 1: Check Single Server

```bash
node .claude/mcp-servers/check-server.js ide-integration

# Output (JSON):
{
  "server": "ide-integration",
  "status": "healthy",
  "responseTime": 1234,
  "timeout": false
}
```

### Example 2: Check All Servers (JSON)

```bash
npm run mcp:health-check:json

# Output:
{
  "total": 7,
  "passed": 6,
  "failed": 0,
  "disabled": 1,
  "servers": [
    {"server": "ide-integration", "status": "healthy", "responseTime": 1234},
    {"server": "github-enhanced", "status": "healthy", "responseTime": 987},
    ...
  ]
}
```

### Example 3: Run Integration Tests

```bash
npm run test:mcp:integration

# Output:
 ✓ MCP Servers Integration (7 tests) 15234ms
   ✓ Connection Tests (7)
     ✓ should connect to ide-integration server
     ✓ should connect to github-enhanced server
     ...
   ✓ Fallback Tests (2)
   ✓ Performance Tests (2)

Test Files  1 passed (1)
     Tests  7 passed (7)
```

### Example 4: Run Performance Tests

```bash
npm run test:mcp:performance

# Output:
⚡ Response Time Benchmarks:
   ide-integration: 1234ms
   github-enhanced: 987ms
   ...

📊 Statistics:
   Average: 1089ms
   Min: 543ms
   Max: 1567ms

🏆 Performance Ranking:
   🥇 1. filesystem: 543ms
   🥈 2. project-context: 876ms
   🥉 3. github-enhanced: 987ms
   ...
```

### Example 5: CI/CD Integration

```yaml
# In your workflow
- name: Health Check MCP Servers
  run: npm run mcp:health-check

- name: Integration Tests
  run: npm run test:mcp:integration
```

---

## 🐛 Troubleshooting

### Server Failed Health Check

**Symptom**: Health check shows "❌ FAILED"

**Solutions**:
1. Run verbose mode:
   ```bash
   npm run mcp:health-check:verbose
   ```

2. Check specific server:
   ```bash
   node .claude/mcp-servers/check-server.js <server-name>
   ```

3. Review MCP configuration:
   ```bash
   cat .claude/mcp.json | jq '.mcpServers.<server-name>'
   ```

4. Check server logs (if available)

5. Verify environment variables:
   - `GITHUB_TOKEN` (for github-enhanced)
   - `GOOGLE_API_KEY` (for gemini-image-generation)
   - `AI_GUIDES_API_URL` (for context-engineering)

### All Servers Timeout

**Symptom**: All servers show timeout errors

**Solutions**:
1. Increase timeout in check-server.js:
   ```javascript
   const timeout = serverConfig.timeout || 120000; // 120 seconds
   ```

2. Check system resources:
   ```bash
   top
   df -h
   ```

3. Verify Node.js installation:
   ```bash
   node --version  # Should be v20+
   ```

### Tests Failing

**Symptom**: Vitest tests fail

**Solutions**:
1. Run tests with verbose output:
   ```bash
   npm run test:mcp:integration -- --reporter=verbose
   ```

2. Check test timeout settings in vitest.config.ts

3. Verify all dependencies installed:
   ```bash
   npm ci
   ```

---

## 📈 Performance Thresholds

Current performance thresholds:

```typescript
const THRESHOLDS = {
  averageResponseTime: 5000,    // 5 seconds average
  maxResponseTime: 10000,        // 10 seconds max
  minThroughput: 10,             // 10 checks per second
};
```

**Recommendations**:
- Average response time < 5s
- Max response time < 10s
- Throughput > 10 checks/second
- Success rate > 90%

---

## 🔗 CI/CD Integration

The health check runs automatically:

**Schedule**:
- Daily at 00:00 UTC

**On Pull Request**:
- When `.claude/mcp-servers/**` changes
- When `.claude/mcp.json` changes
- When workflow file changes

**On Failure**:
- Creates GitHub Issue with P1-High priority
- Includes workflow run link
- Provides diagnostic steps

**Artifacts**:
- `mcp-health-check-results` (JSON)
- `mcp-integration-test-results`
- `mcp-performance-test-results`

---

## 📝 Maintenance

### Adding New MCP Server

1. Add server to `.claude/mcp.json`
2. Health check automatically detects new servers
3. Integration tests run for all servers
4. No code changes needed!

### Updating Thresholds

Edit performance.test.ts:
```typescript
const THRESHOLDS = {
  averageResponseTime: 7000,  // Increase if needed
  maxResponseTime: 15000,
  minThroughput: 5,
};
```

### Debugging Failed Tests

```bash
# Run single test
npm run test:mcp:integration -- --grep="should connect to ide-integration"

# Watch mode
npm run test:mcp:integration -- --watch

# UI mode
npm run test:mcp:integration -- --ui
```

---

## 🔗 Related Documentation

- [MCP Configuration](.claude/mcp.json) - Server configuration
- [Integration Tests](__tests__/integration.test.ts) - Test source
- [Performance Tests](__tests__/performance.test.ts) - Benchmark source
- [CI/CD Workflow](../../.github/workflows/mcp-health-check.yml) - Automation

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
