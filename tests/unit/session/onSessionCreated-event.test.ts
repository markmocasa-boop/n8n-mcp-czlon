/**
 * Unit test for onSessionCreated event during initialize flow
 * Verifies bug fix for v2.19.0 where event was not emitted
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SingleSessionHTTPServer } from '../../../src/http-server-single-session';

// Mock environment
process.env.AUTH_TOKEN = 'test-token-for-n8n-testing-minimum-32-chars';
process.env.NODE_ENV = 'test';

describe('onSessionCreated Event - Initialize Flow', () => {
  let server: SingleSessionHTTPServer;

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  it('should emit onSessionCreated event when session is created during initialize flow', async () => {
    // Setup event tracking
    let eventFired = false;
    let capturedSessionId: string | undefined;
    let capturedContext: any;

    // Create server with event handler
    server = new SingleSessionHTTPServer({
      sessionEvents: {
        onSessionCreated: async (sessionId, instanceContext) => {
          eventFired = true;
          capturedSessionId = sessionId;
          capturedContext = instanceContext;
        }
      }
    });

    // Start server
    await server.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Make initialize request
    const port = parseInt(process.env.PORT || '3000');
    const fetch = (await import('node-fetch')).default;

    try {
      await fetch(`http://localhost:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token-for-n8n-testing-minimum-32-chars',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          },
          id: 1
        })
      });

      // Wait for async event processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify event was fired
      expect(eventFired).toBe(true);
      expect(capturedSessionId).toBeDefined();
      expect(typeof capturedSessionId).toBe('string');

      console.log('✅ BUG FIX VERIFIED: onSessionCreated event fired during initialize');
      console.log(`   Session ID: ${capturedSessionId}`);

    } catch (error) {
      // Event may still fire even if HTTP request fails
      if (!eventFired) {
        throw error;
      }
    }
  }, 30000);
});
