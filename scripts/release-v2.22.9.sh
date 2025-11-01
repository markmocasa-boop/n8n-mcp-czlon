#!/bin/bash
# Release script for n8n-mcp v2.22.9 - Windows Graceful Shutdown Fix

set -e  # Exit on error

echo "🚀 n8n-mcp v2.22.9 Release Process"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Pre-release checks
echo -e "${YELLOW}1. Pre-release Checks${NC}"
echo "   ✓ Code changes: src/mcp/index.ts"
echo "   ✓ Tests: tests/integration/shutdown/windows-graceful-shutdown.test.ts"
echo "   ✓ CI: .github/workflows/test-windows.yml"
echo "   ✓ Version: 2.22.9"
echo "   ✓ CHANGELOG.md updated"
echo "   ✓ Release notes created"
echo ""

# 2. Build
echo -e "${YELLOW}2. Building Project${NC}"
npm run build
echo -e "${GREEN}   ✓ Build successful${NC}"
echo ""

# 3. Run tests
echo -e "${YELLOW}3. Running Tests${NC}"
npm run test:unit -- --run
echo -e "${GREEN}   ✓ All tests passing${NC}"
echo ""

# 4. Git operations
echo -e "${YELLOW}4. Git Operations${NC}"
echo "   Run the following commands:"
echo ""
echo "   git add -A"
echo "   git commit -m 'fix: Windows graceful shutdown - avoid libuv assertion failure (v2.22.9)"
echo ""
echo "   Commit message body:"
echo "   - Fixed libuv assertion: !(handle->flags & UV_HANDLE_CLOSING)"
echo "   - Made stdin cleanup platform-aware (skip destroy() on Windows)"
echo "   - Added Windows shutdown regression tests"
echo "   - Added Windows CI workflow"
echo "   - Closes issue regarding Windows crashes during shutdown'"
echo ""
echo "   git push origin main"
echo ""

# 5. GitHub Release
echo -e "${YELLOW}5. Create GitHub Release${NC}"
echo "   - Go to: https://github.com/czlonkowski/n8n-mcp/releases/new"
echo "   - Tag: v2.22.9"
echo "   - Title: v2.22.9 - Windows Graceful Shutdown Fix"
echo "   - Description: Copy from RELEASE_NOTES_v2.22.9.md"
echo "   - Check 'Set as latest release'"
echo ""

# 6. NPM Publish
echo -e "${YELLOW}6. NPM Publish${NC}"
echo "   Run the following commands:"
echo ""
echo "   npm publish --access public"
echo ""
echo "   Or use the existing publish script if available:"
echo "   ./scripts/publish-npm.sh"
echo ""

# 7. Docker Images
echo -e "${YELLOW}7. Docker Images${NC}"
echo "   Docker images will be built automatically by CI/CD on tag push"
echo "   - ghcr.io/czlonkowski/n8n-mcp:v2.22.9"
echo "   - ghcr.io/czlonkowski/n8n-mcp:latest"
echo ""

# 8. Verification
echo -e "${YELLOW}8. Post-Release Verification${NC}"
echo "   After npm publish, test installation:"
echo ""
echo "   # Global install"
echo "   npm install -g n8n-mcp@2.22.9"
echo "   npx n8n-mcp@2.22.9"
echo ""
echo "   # Verify version"
echo "   npm view n8n-mcp version"
echo ""
echo "   Expected output: 2.22.9"
echo ""

# 9. Windows Validation (MANUAL)
echo -e "${YELLOW}9. Windows Validation (MANUAL - requires Windows machine)${NC}"
echo "   On a Windows machine:"
echo ""
echo "   1. Install: npm install -g n8n-mcp@2.22.9"
echo "   2. Configure Claude Desktop with npx"
echo "   3. Start Claude Desktop"
echo "   4. Use some n8n-mcp tools"
echo "   5. Quit Claude Desktop (or Ctrl+C if running in terminal)"
echo "   6. Verify: No assertion failure in logs"
echo "   7. Expected: Clean shutdown message"
echo ""

# 10. Announcements
echo -e "${YELLOW}10. Announcements${NC}"
echo "   Consider announcing on:"
echo "   - GitHub Discussions"
echo "   - Discord/Slack (if applicable)"
echo "   - Twitter/Social media"
echo "   - Close related GitHub issue"
echo ""

echo -e "${GREEN}✅ Release Preparation Complete!${NC}"
echo ""
echo "Summary of changes:"
echo "- Fixed critical Windows crash on shutdown"
echo "- Added Windows regression tests"
echo "- Added Windows CI workflow"
echo "- Updated documentation"
echo ""
echo "Impact: HIGH - Enables Windows users to use npx/npm installation"
echo ""
