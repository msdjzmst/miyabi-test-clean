#!/bin/bash
# Fix script for Issue #156: Miyabi automation not working
# This script applies all fixes to a target repository

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIYABI_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_PATH="$MIYABI_ROOT/packages/cli"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Miyabi Automation Fix Script (Issue #156)${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ Error: GITHUB_TOKEN environment variable not set${NC}"
    echo -e "${YELLOW}Please set your GitHub token:${NC}"
    echo -e "  export GITHUB_TOKEN=ghp_xxxxx\n"
    echo -e "Generate token at: https://github.com/settings/tokens"
    echo -e "Required scopes: repo, workflow, admin:org\n"
    exit 1
fi

echo -e "${GREEN}✅ GITHUB_TOKEN is set${NC}\n"

# Step 2: Ask for target repository path
read -p "Enter target repository path (or press Enter for current directory): " REPO_PATH
REPO_PATH="${REPO_PATH:-.}"
REPO_PATH="$(cd "$REPO_PATH" && pwd)"

echo -e "${BLUE}Target repository: ${REPO_PATH}${NC}\n"

# Step 3: Verify it's a git repository
if [ ! -d "$REPO_PATH/.git" ]; then
    echo -e "${RED}❌ Error: $REPO_PATH is not a git repository${NC}"
    exit 1
fi

cd "$REPO_PATH"

# Step 4: Get repository info
REPO_REMOTE=$(git config --get remote.origin.url 2>/dev/null || echo "")
if [ -z "$REPO_REMOTE" ]; then
    echo -e "${RED}❌ Error: No remote origin configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Git repository found${NC}"
echo -e "${BLUE}Remote: ${REPO_REMOTE}${NC}\n"

# Step 5: Build Miyabi CLI
echo -e "${BLUE}Building Miyabi CLI...${NC}"
cd "$CLI_PATH"
pnpm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Miyabi CLI built successfully${NC}\n"
else
    echo -e "${RED}❌ Error: Failed to build Miyabi CLI${NC}"
    exit 1
fi

# Step 6: Run miyabi install
echo -e "${BLUE}Running miyabi install...${NC}"
cd "$REPO_PATH"

# Use the local build
MIYABI_BIN="$CLI_PATH/dist/index.js"

if [ ! -f "$MIYABI_BIN" ]; then
    echo -e "${RED}❌ Error: Miyabi CLI binary not found at $MIYABI_BIN${NC}"
    exit 1
fi

# Run install with all flags
node "$MIYABI_BIN" install --yes --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Miyabi installed successfully${NC}\n"
else
    echo -e "${YELLOW}⚠️  Warning: miyabi install had issues (check output above)${NC}\n"
fi

# Step 7: Verify workflows were deployed
echo -e "${BLUE}Verifying workflow deployment...${NC}"

if command -v gh &> /dev/null; then
    WORKFLOWS=$(gh workflow list 2>/dev/null || echo "")

    if echo "$WORKFLOWS" | grep -q "autonomous-agent.yml"; then
        echo -e "${GREEN}✅ Autonomous Agent workflow found${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Autonomous Agent workflow not found in gh workflow list${NC}"
        echo -e "${YELLOW}   This may take a few minutes to appear on GitHub${NC}"
    fi

    echo ""
else
    echo -e "${YELLOW}⚠️  gh CLI not installed, skipping verification${NC}"
    echo -e "${YELLOW}   Install gh CLI: brew install gh${NC}\n"
fi

# Step 8: Check for workflow files locally (if .github/workflows exists)
if [ -d ".github/workflows" ]; then
    echo -e "${BLUE}Checking local workflow files...${NC}"

    if [ -f ".github/workflows/autonomous-agent.yml" ]; then
        echo -e "${GREEN}✅ autonomous-agent.yml exists locally${NC}"

        # Check if @miyabi detection is present
        if grep -q "@miyabi" ".github/workflows/autonomous-agent.yml"; then
            echo -e "${GREEN}✅ @miyabi mention detection is present${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: @miyabi detection not found in workflow${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Warning: autonomous-agent.yml not found locally${NC}"
    fi
    echo ""
fi

# Step 9: Print next steps
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Fix Applied Successfully!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${BLUE}Next Steps:${NC}\n"

echo -e "${GREEN}1️⃣  Verify workflows on GitHub:${NC}"
echo -e "   gh workflow list\n"

echo -e "${GREEN}2️⃣  Test @miyabi mention:${NC}"
echo -e "   # Create a test issue"
echo -e "   gh issue create --title \"Test automation\" --body \"Test issue\"\n"
echo -e "   # Comment with @miyabi mention"
echo -e "   gh issue comment <issue-number> --body \"@miyabi please implement this\"\n"

echo -e "${GREEN}3️⃣  Check workflow execution:${NC}"
echo -e "   gh run list --workflow autonomous-agent.yml --limit 5\n"

echo -e "${GREEN}4️⃣  View workflow logs (if triggered):${NC}"
echo -e "   gh run view <run-id> --log\n"

echo -e "${YELLOW}Important:${NC}"
echo -e "  • Workflows may take 1-2 minutes to appear on GitHub"
echo -e "  • Make sure ANTHROPIC_API_KEY secret is set:"
echo -e "    gh secret set ANTHROPIC_API_KEY --body \"sk-ant-xxxxx\"\n"

echo -e "${BLUE}Documentation:${NC}"
echo -e "  • Fix guide: $MIYABI_ROOT/MIYABI_AUTOMATION_FIX_GUIDE.md"
echo -e "  • Issue: https://github.com/ShunsukeHayashi/Miyabi/issues/156\n"

echo -e "${GREEN}🌸 Miyabi - Beauty in Autonomous Development${NC}\n"
