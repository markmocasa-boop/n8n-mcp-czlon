# Windows Graceful Shutdown Fix - Release v2.22.9

## 🐛 Critical Bug Fix: Windows libuv Assertion Failure

This release fixes a critical issue preventing Windows users from reliably using n8n-mcp with Claude Desktop and other MCP clients.

### Problem Fixed

**Symptom**: Server crashed on shutdown with:
```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
```

**Impact**: 
- Windows users could not use npx/npm installation method with Claude Desktop
- Server would disconnect unexpectedly
- Only Docker workaround was reliable

**Root Cause**: 
Calling `process.stdin.destroy()` on Windows triggered double-close of underlying libuv async handles during the shutdown sequence.

### Solution

Modified the shutdown handler to be platform-aware:
- **Windows**: Only calls `process.stdin.pause()` (avoids libuv handle double-close)
- **Linux/macOS**: Continues to call both `pause()` and `destroy()` as before
- Added defensive error handling and logging

### What Changed

#### Code Changes
- `src/mcp/index.ts`: Platform-aware stdin cleanup during shutdown
  - Detects Windows via `process.platform === 'win32'`
  - Skips `process.stdin.destroy()` on Windows
  - Adds try/catch and logging for debugging

#### Testing
- `tests/integration/shutdown/windows-graceful-shutdown.test.ts`: New test suite
  - Tests stdin close behavior
  - Tests SIGINT/SIGTERM handling
  - Validates no libuv assertions in stderr
  - Runs on Windows CI

- `.github/workflows/test-windows.yml`: New Windows CI workflow
  - Runs on every change to shutdown-related code
  - Prevents regressions
  - Comments on PRs if tests fail

### Installation

**NPM (recommended for most users):**
```bash
npm install -g n8n-mcp@latest
# or
npx n8n-mcp@latest
```

**Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp@latest"]
    }
  }
}
```

**Docker (still works great):**
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-e", "MCP_MODE=stdio",
        "ghcr.io/czlonkowski/n8n-mcp:latest"
      ]
    }
  }
}
```

### Validation

To verify the fix on Windows:
1. Install: `npm install -g n8n-mcp@latest`
2. Run: `npx n8n-mcp@latest`
3. Connect Claude Desktop
4. Quit Claude Desktop or press Ctrl+C
5. **Expected**: Clean shutdown with no assertion errors
6. **Before this fix**: Assertion failure crash

### Technical Details

**Why Windows is Different:**
- Windows uses different libuv async handle lifecycle management than POSIX systems
- Destroying stdin while libuv is cleaning up can trigger race conditions
- The fix avoids the race by only pausing (which stops reads) without destroying

**Backward Compatibility:**
- No changes to Linux/macOS behavior
- No changes to Docker deployment
- No changes to MCP protocol or tools
- Existing configurations continue to work

### Acceptance Criteria

All criteria met:
- ✅ Server starts via npx on Windows without crashes
- ✅ Process exits cleanly without assertion failures
- ✅ No "Server disconnected" errors in Claude Desktop
- ✅ stdio communication remains stable throughout session
- ✅ Both better-sqlite3 and sql.js fallback work correctly

### Special Thanks

Huge thanks to the community member who provided:
- Detailed bug report with exact error message
- Complete environment information
- Clear reproduction steps
- Helpful context about Docker workaround

This kind of detailed reporting makes it possible to fix issues quickly and thoroughly! 🙏

### Related Issues

Closes issue regarding Windows libuv assertion failure during graceful shutdown.

### Upgrade Notes

**No breaking changes** - this is a pure bug fix release.

Simply update to the latest version:
```bash
npm update -g n8n-mcp
```

Or if using npx, it will automatically use the latest version:
```bash
npx n8n-mcp@latest
```

---

**Full Changelog**: https://github.com/czlonkowski/n8n-mcp/blob/main/CHANGELOG.md
