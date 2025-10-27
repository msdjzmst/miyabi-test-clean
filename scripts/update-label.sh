#!/bin/bash
# Miyabi Label Update Hook
# Automatically updates GitHub Issue/PR labels based on agent events

set -e

ACTION=${1:-code-modified}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🏷️  Miyabi Label Update Hook"
echo "   Action: ${ACTION}"
echo "   Timestamp: ${TIMESTAMP}"

# Get current branch
BRANCH=$(git branch --show-current)

# Extract issue number from branch name (e.g., feature/issue-270)
ISSUE_NUM=$(echo "$BRANCH" | grep -oP 'issue-\K\d+' || echo "")

if [ -z "$ISSUE_NUM" ]; then
  echo "   ℹ️  No issue number found in branch name"
  exit 0
fi

echo "   Issue: #${ISSUE_NUM}"

# Update label based on action
case "$ACTION" in
  "code-modified")
    gh issue edit "$ISSUE_NUM" --add-label "🏗️ state:implementing" --remove-label "📥 state:pending" 2>/dev/null || true
    echo "   ✅ Updated to state:implementing"
    ;;
  "code-generated")
    gh issue edit "$ISSUE_NUM" --add-label "🤖 agent:codegen" 2>/dev/null || true
    echo "   ✅ Added agent:codegen label"
    ;;
  "review-complete")
    gh issue edit "$ISSUE_NUM" --add-label "👀 state:reviewing" --remove-label "🏗️ state:implementing" 2>/dev/null || true
    echo "   ✅ Updated to state:reviewing"
    ;;
  *)
    echo "   ⚠️  Unknown action: ${ACTION}"
    ;;
esac

echo "   ✅ Label update complete"
