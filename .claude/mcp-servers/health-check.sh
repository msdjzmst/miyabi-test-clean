#!/bin/bash

/**
 * MCP Servers Health Check Script
 *
 * Issue: #141 - MCP Server統合テスト・ヘルスチェックの実装
 *
 * Usage: bash .claude/mcp-servers/health-check.sh [--json] [--verbose]
 */

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/check-server.js"
MCP_CONFIG="$SCRIPT_DIR/../mcp.json"

# Parse arguments
JSON_OUTPUT=false
VERBOSE=false

for arg in "$@"; do
  case $arg in
    --json)
      JSON_OUTPUT=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
    --help)
      echo "Usage: $0 [--json] [--verbose]"
      echo ""
      echo "Options:"
      echo "  --json     Output results in JSON format"
      echo "  --verbose  Show detailed output"
      echo "  --help     Show this help message"
      exit 0
      ;;
  esac
done

# Extract server names from mcp.json
SERVERS=$(node -e "
  const config = require('$MCP_CONFIG');
  const servers = Object.keys(config.mcpServers || {});
  console.log(servers.join(' '));
")

if [ -z "$SERVERS" ]; then
  echo "❌ No MCP servers found in mcp.json"
  exit 1
fi

# Print header
if [ "$JSON_OUTPUT" = false ]; then
  echo "🔍 MCP Servers Health Check"
  echo "============================"
  echo ""
fi

# Results tracking
TOTAL=0
PASSED=0
FAILED=0
DISABLED=0
declare -a RESULTS

# Check each server
for SERVER in $SERVERS; do
  ((TOTAL++))

  if [ "$JSON_OUTPUT" = false ]; then
    echo -n "[$SERVER] ... "
  fi

  # Run health check
  START=$(date +%s%N)
  if OUTPUT=$(node "$CHECK_SCRIPT" "$SERVER" 2>&1); then
    END=$(date +%s%N)
    ELAPSED=$(( (END - START) / 1000000 ))

    # Parse JSON output
    STATUS=$(echo "$OUTPUT" | jq -r '.status // "unknown"')
    RESPONSE_TIME=$(echo "$OUTPUT" | jq -r '.responseTime // 0')

    if [ "$STATUS" = "healthy" ]; then
      ((PASSED++))
      if [ "$JSON_OUTPUT" = false ]; then
        echo "✅ OK (${RESPONSE_TIME}ms)"
      fi
      RESULTS+=("{\"server\":\"$SERVER\",\"status\":\"healthy\",\"responseTime\":$RESPONSE_TIME}")
    else
      ((FAILED++))
      ERROR=$(echo "$OUTPUT" | jq -r '.error // "Unknown error"')
      if [ "$JSON_OUTPUT" = false ]; then
        echo "❌ FAILED"
        if [ "$VERBOSE" = true ]; then
          echo "   Error: $ERROR"
        fi
      fi
      RESULTS+=("{\"server\":\"$SERVER\",\"status\":\"failed\",\"error\":\"$ERROR\"}")
    fi
  else
    # Check if server is disabled
    if echo "$OUTPUT" | grep -q "is disabled"; then
      ((DISABLED++))
      if [ "$JSON_OUTPUT" = false ]; then
        echo "⚠️  DISABLED"
      fi
      RESULTS+=("{\"server\":\"$SERVER\",\"status\":\"disabled\"}")
    else
      ((FAILED++))
      ERROR=$(echo "$OUTPUT" | jq -r '.error // "Connection failed"')
      if [ "$JSON_OUTPUT" = false ]; then
        echo "❌ FAILED"
        if [ "$VERBOSE" = true ]; then
          echo "   Error: $ERROR"
        fi
      fi
      RESULTS+=("{\"server\":\"$SERVER\",\"status\":\"failed\",\"error\":\"$ERROR\"}")
    fi
  fi
done

# Print summary
if [ "$JSON_OUTPUT" = true ]; then
  # JSON output
  RESULTS_JSON=$(printf '%s\n' "${RESULTS[@]}" | jq -s '.')
  echo "{\"total\":$TOTAL,\"passed\":$PASSED,\"failed\":$FAILED,\"disabled\":$DISABLED,\"servers\":$RESULTS_JSON}"
else
  # Human-readable output
  echo ""
  echo "============================"
  echo "📊 Summary:"
  echo "   Total: $TOTAL"
  echo "   ✅ Passed: $PASSED"
  echo "   ❌ Failed: $FAILED"

  if [ $DISABLED -gt 0 ]; then
    echo "   ⚠️  Disabled: $DISABLED"
  fi

  echo ""

  if [ $FAILED -eq 0 ]; then
    echo "✅ All enabled MCP servers are healthy"
    exit 0
  else
    echo "❌ $FAILED server(s) failed health check"
    exit 1
  fi
fi
