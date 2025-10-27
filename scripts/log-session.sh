#!/bin/bash
# Miyabi Session Logger
# Logs Claude Code session activity to .ai/logs/

set -e

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date -u +"%Y-%m-%d")
LOG_DIR=".ai/logs"
LOG_FILE="${LOG_DIR}/${DATE}.md"

echo "📝 Miyabi Session Logger"
echo "   Timestamp: ${TIMESTAMP}"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Append session entry
cat >> "$LOG_FILE" << LOGEOF

---

## Session: ${TIMESTAMP}

**Device**: ${DEVICE_IDENTIFIER:-Unknown}
**Branch**: $(git branch --show-current 2>/dev/null || echo "N/A")
**Last Commit**: $(git log -1 --oneline 2>/dev/null || echo "N/A")

### Actions Performed
- User prompt submitted
- Session logged

### Tool Invocations
_See tool invocation logs for details_

LOGEOF

echo "   ✅ Session logged to ${LOG_FILE}"
