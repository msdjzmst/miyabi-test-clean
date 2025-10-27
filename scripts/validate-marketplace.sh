#!/bin/bash
# Miyabi Marketplace Validator
# Validates marketplace.json and plugin requirements

set -e

MARKETPLACE_FILE="marketplace.json"
PLUGIN_MANIFEST=".claude-plugin/plugin.json"

echo "🔍 Miyabi Marketplace Validator"
echo "================================"
echo ""

# Check if marketplace.json exists
if [ ! -f "$MARKETPLACE_FILE" ]; then
  echo "❌ Error: marketplace.json not found"
  exit 1
fi

echo "✅ Found marketplace.json"

# Validate JSON syntax
if ! jq empty "$MARKETPLACE_FILE" 2>/dev/null; then
  echo "❌ Error: Invalid JSON syntax in marketplace.json"
  exit 1
fi

echo "✅ Valid JSON syntax"

# Check required fields
REQUIRED_FIELDS=("name" "description" "plugins")
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e ".${field}" "$MARKETPLACE_FILE" >/dev/null 2>&1; then
    echo "❌ Error: Missing required field: ${field}"
    exit 1
  fi
done

echo "✅ All required fields present"

# Check plugin entries
PLUGIN_COUNT=$(jq '.plugins | length' "$MARKETPLACE_FILE")
echo "📦 Found ${PLUGIN_COUNT} plugin(s)"

# Validate each plugin
for i in $(seq 0 $((PLUGIN_COUNT - 1))); do
  PLUGIN_NAME=$(jq -r ".plugins[${i}].name" "$MARKETPLACE_FILE")
  echo ""
  echo "Validating plugin: ${PLUGIN_NAME}"
  
  # Check required plugin fields
  PLUGIN_REQUIRED=("name" "source" "version" "description" "author")
  for field in "${PLUGIN_REQUIRED[@]}"; do
    if ! jq -e ".plugins[${i}].${field}" "$MARKETPLACE_FILE" >/dev/null 2>&1; then
      echo "  ❌ Missing field: ${field}"
      exit 1
    fi
  done
  
  echo "  ✅ All required fields present"
done

# Validate plugin manifest if exists
if [ -f "$PLUGIN_MANIFEST" ]; then
  echo ""
  echo "Validating plugin manifest..."
  
  if ! jq empty "$PLUGIN_MANIFEST" 2>/dev/null; then
    echo "❌ Error: Invalid JSON in plugin.json"
    exit 1
  fi
  
  echo "✅ Valid plugin.json"
  
  # Check version consistency
  MARKETPLACE_VERSION=$(jq -r '.plugins[0].version' "$MARKETPLACE_FILE")
  MANIFEST_VERSION=$(jq -r '.version' "$PLUGIN_MANIFEST")
  
  if [ "$MARKETPLACE_VERSION" != "$MANIFEST_VERSION" ]; then
    echo "⚠️  Warning: Version mismatch"
    echo "   Marketplace: ${MARKETPLACE_VERSION}"
    echo "   Manifest: ${MANIFEST_VERSION}"
  else
    echo "✅ Version consistent: ${MANIFEST_VERSION}"
  fi
fi

# Check for required directories
REQUIRED_DIRS=(".claude-plugin" "commands" "agents" "hooks" "scripts")
echo ""
echo "Checking directory structure..."
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "  ✅ ${dir}/"
  else
    echo "  ⚠️  Missing: ${dir}/"
  fi
done

# Count components
if [ -d "commands" ]; then
  CMD_COUNT=$(find commands -name "*.md" -type f | wc -l)
  echo ""
  echo "📋 Commands: ${CMD_COUNT}"
fi

if [ -d "agents" ]; then
  AGENT_COUNT=$(find agents -name "*.md" -type f | wc -l)
  echo "🤖 Agents: ${AGENT_COUNT}"
fi

if [ -f "hooks/hooks.json" ]; then
  HOOK_COUNT=$(jq '.hooks | to_entries | length' hooks/hooks.json 2>/dev/null || echo "0")
  echo "🔗 Hook events: ${HOOK_COUNT}"
fi

echo ""
echo "================================"
echo "✅ Marketplace validation complete!"
echo ""
echo "Installation command:"
echo "  claude plugins add-marketplace ShunsukeHayashi/Miyabi"
echo ""
echo "Or via URL:"
echo "  claude plugins add-marketplace https://raw.githubusercontent.com/ShunsukeHayashi/Miyabi/main/marketplace.json"
