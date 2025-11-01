import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

/**
 * Windows Graceful Shutdown Regression Test
 * 
 * Tests that the MCP server exits cleanly on Windows without libuv assertion failures.
 * This test specifically addresses the issue described in:
 * - Issue: Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
 * 
 * The test validates:
 * 1. Server starts successfully in stdio mode
 * 2. Server responds to MCP initialize request
 * 3. Server shuts down gracefully without errors when stdin is closed
 * 4. No libuv assertion failures appear in stderr
 */

describe('Windows Graceful Shutdown', () => {
  let serverProcess: ChildProcess | null = null;
  
  beforeEach(() => {
    serverProcess = null;
  });

  afterEach(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  it('should exit cleanly without libuv assertions when stdin is closed', async () => {
    // Skip on non-Windows in CI (but allow local runs for cross-platform validation)
    const isWindows = process.platform === 'win32';
    if (process.env.CI && !isWindows) {
      console.log('Skipping Windows-specific test on non-Windows CI environment');
      return;
    }

    // Start the MCP server in stdio mode
    const serverPath = path.join(__dirname, '../../../dist/mcp/index.js');
    
    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        MCP_MODE: 'stdio',
        NODE_DB_PATH: ':memory:', // Use in-memory DB for tests
        LOG_LEVEL: 'debug',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Collect stderr to check for assertion failures
    let stderr = '';
    serverProcess.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    // Collect stdout for MCP responses
    let stdout = '';
    serverProcess.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send a basic MCP initialize request to verify server is responsive
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    serverProcess.stdin?.write(JSON.stringify(initRequest) + '\n');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now trigger shutdown by closing stdin (simulates Claude Desktop disconnect)
    serverProcess.stdin?.end();

    // Wait for graceful shutdown
    const exitCode = await new Promise<number | null>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        resolve(null); // Timeout - server didn't exit
      }, 5000);

      serverProcess?.on('exit', (code) => {
        clearTimeout(timeoutHandle);
        resolve(code);
      });
    });

    // Validate results
    expect(exitCode).not.toBeNull();
    expect(exitCode).toBe(0);

    // Check stderr for libuv assertion failures
    const hasLibuvAssertion = stderr.includes('Assertion failed') && 
                               (stderr.includes('UV_HANDLE_CLOSING') || 
                                stderr.includes('async.c'));

    if (hasLibuvAssertion) {
      console.error('STDERR output:', stderr);
    }

    expect(hasLibuvAssertion).toBe(false);

    // Verify we got some stdout (server was running)
    expect(stdout.length).toBeGreaterThan(0);

    // Log success for debugging
    console.log(`✓ Server exited cleanly with code ${exitCode} (platform: ${process.platform})`);
  }, 10000); // 10s timeout for the test

  it('should handle SIGINT gracefully on Windows', async () => {
    const isWindows = process.platform === 'win32';
    if (process.env.CI && !isWindows) {
      console.log('Skipping Windows-specific test on non-Windows CI environment');
      return;
    }

    const serverPath = path.join(__dirname, '../../../dist/mcp/index.js');
    
    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        MCP_MODE: 'stdio',
        NODE_DB_PATH: ':memory:',
        LOG_LEVEL: 'debug',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    serverProcess.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send SIGINT (Ctrl+C simulation)
    serverProcess.kill('SIGINT');

    // Wait for graceful shutdown
    const exitCode = await new Promise<number | null>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        resolve(null);
      }, 5000);

      serverProcess?.on('exit', (code) => {
        clearTimeout(timeoutHandle);
        resolve(code);
      });
    });

    expect(exitCode).not.toBeNull();
    
    // Check for libuv assertions
    const hasLibuvAssertion = stderr.includes('Assertion failed') && 
                               (stderr.includes('UV_HANDLE_CLOSING') || 
                                stderr.includes('async.c'));

    if (hasLibuvAssertion) {
      console.error('STDERR output:', stderr);
    }

    expect(hasLibuvAssertion).toBe(false);

    console.log(`✓ Server handled SIGINT cleanly with code ${exitCode} (platform: ${process.platform})`);
  }, 10000);
});
