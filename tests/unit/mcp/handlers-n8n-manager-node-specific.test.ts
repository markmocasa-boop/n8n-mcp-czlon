import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { N8nApiClient } from '@/services/n8n-api-client';
import { NodeRepository } from '@/database/node-repository';
import { N8nApiError, N8nNotFoundError } from '@/utils/n8n-errors';

// Mock dependencies
vi.mock('@/services/n8n-api-client');
vi.mock('@/database/node-repository');
vi.mock('@/config/n8n-api', () => ({
  getN8nApiConfig: vi.fn()
}));
vi.mock('@/mcp/handlers-workflow-diff', () => ({
  handleUpdatePartialWorkflow: vi.fn()
}));
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
  LogLevel: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  }
}));

describe('handlers-n8n-manager - Node-Specific Tools', () => {
  let mockApiClient: any;
  let mockRepository: any;
  let handlers: any;
  let handleUpdatePartialWorkflow: any;
  let getN8nApiConfig: any;

  // Helper function to create test workflow with nodes
  const createTestWorkflow = (overrides = {}) => ({
    id: 'test-workflow-id',
    name: 'Test Workflow',
    active: true,
    nodes: [
      {
        id: 'node1',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.1,
        position: [100, 100],
        parameters: {
          url: 'https://api.example.com',
          method: 'GET'
        },
      },
      {
        id: 'node2',
        name: 'Set Variable',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.3,
        position: [300, 100],
        parameters: {
          mode: 'manual',
          values: {
            string: [{ name: 'foo', value: 'bar' }]
          }
        },
      },
    ],
    connections: {
      'HTTP Request': {
        main: [[{ node: 'Set Variable', type: 'main', index: 0 }]]
      }
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tags: [],
    settings: {},
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock API client
    mockApiClient = {
      getWorkflow: vi.fn(),
      updateWorkflow: vi.fn(),
    };

    // Setup mock repository
    mockRepository = {
      getNodeByType: vi.fn(),
    };

    // Import mocked modules
    getN8nApiConfig = (await import('@/config/n8n-api')).getN8nApiConfig;
    handleUpdatePartialWorkflow = (await import('@/mcp/handlers-workflow-diff')).handleUpdatePartialWorkflow;

    // Mock the API config
    vi.mocked(getN8nApiConfig).mockReturnValue({
      baseUrl: 'https://n8n.test.com',
      apiKey: 'test-key',
      timeout: 30000,
      maxRetries: 3,
    });

    // Mock the N8nApiClient constructor
    vi.mocked(N8nApiClient).mockImplementation(() => mockApiClient);

    // Mock NodeRepository constructor
    vi.mocked(NodeRepository).mockImplementation(() => mockRepository);

    // Import handlers module after setting up mocks
    handlers = await import('@/mcp/handlers-n8n-manager');
  });

  afterEach(() => {
    // Clean up singleton state
    if (handlers) {
      const clientGetter = handlers.getN8nApiClient;
      if (clientGetter) {
        vi.mocked(getN8nApiConfig).mockReturnValue(null);
        clientGetter();
      }
    }
  });

  describe('handleGetNodeDetails', () => {
    it('should return full node details when node exists', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      const result = await handlers.handleGetNodeDetails({
        id: 'test-workflow-id',
        nodeName: 'HTTP Request'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        workflowId: 'test-workflow-id',
        workflowName: 'Test Workflow',
        node: testWorkflow.nodes[0],
        connections: {
          inputs: {},
          outputs: {
            'HTTP Request': {
              main: [[{ node: 'Set Variable', type: 'main', index: 0 }]]
            }
          }
        }
      });

      expect(mockApiClient.getWorkflow).toHaveBeenCalledWith('test-workflow-id');
    });

    it('should return error when node not found', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      const result = await handlers.handleGetNodeDetails({
        id: 'test-workflow-id',
        nodeName: 'NonExistent Node'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Node "NonExistent Node" not found in workflow test-workflow-id');
      expect(result.details).toEqual({
        availableNodes: ['HTTP Request', 'Set Variable'],
        hint: 'Use n8n_get_workflow_structure() to see all node names'
      });
    });

    it('should validate nodeType parameter format', async () => {
      const result = await handlers.handleGetNodeDetails({
        id: 'test-workflow-id',
        // Missing nodeName
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
      expect(result.details).toHaveProperty('errors');
    });

    it('should handle database errors gracefully', async () => {
      mockApiClient.getWorkflow.mockRejectedValue(
        new N8nApiError('Database connection failed', 'DATABASE_ERROR', 500)
      );

      const result = await handlers.handleGetNodeDetails({
        id: 'test-workflow-id',
        nodeName: 'HTTP Request'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.code).toBe('DATABASE_ERROR');
    });
  });

  describe('handleUpdateSingleNode', () => {
    it('should update single node property successfully', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      vi.mocked(handleUpdatePartialWorkflow).mockResolvedValue({
        success: true,
        data: {
          ...testWorkflow,
          nodes: [
            {
              ...testWorkflow.nodes[0],
              parameters: {
                url: 'https://api.new.com',
                method: 'POST'
              }
            },
            testWorkflow.nodes[1]
          ]
        }
      });

      const result = await handlers.handleUpdateSingleNode(
        {
          id: 'test-workflow-id',
          nodeName: 'HTTP Request',
          updates: {
            parameters: {
              url: 'https://api.new.com',
              method: 'POST'
            }
          }
        },
        mockRepository
      );

      expect(result.success).toBe(true);
      expect(mockApiClient.getWorkflow).toHaveBeenCalledWith('test-workflow-id');
      expect(handleUpdatePartialWorkflow).toHaveBeenCalledWith(
        {
          id: 'test-workflow-id',
          operations: [
            {
              type: 'updateNode',
              nodeName: 'HTTP Request',
              updates: {
                parameters: {
                  url: 'https://api.new.com',
                  method: 'POST'
                }
              },
              description: 'Update node "HTTP Request"'
            }
          ],
          createBackup: true
        },
        mockRepository,
        undefined
      );
    });

    it('should update multiple properties in one call', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      vi.mocked(handleUpdatePartialWorkflow).mockResolvedValue({
        success: true,
        data: testWorkflow
      });

      const result = await handlers.handleUpdateSingleNode(
        {
          id: 'test-workflow-id',
          nodeName: 'HTTP Request',
          updates: {
            parameters: {
              url: 'https://api.new.com',
              method: 'POST',
              authentication: 'bearerAuth'
            },
            disabled: true,
            notes: 'Updated for testing'
          }
        },
        mockRepository
      );

      expect(result.success).toBe(true);
      expect(handleUpdatePartialWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            expect.objectContaining({
              type: 'updateNode',
              nodeName: 'HTTP Request',
              updates: {
                parameters: {
                  url: 'https://api.new.com',
                  method: 'POST',
                  authentication: 'bearerAuth'
                },
                disabled: true,
                notes: 'Updated for testing'
              }
            })
          ]
        }),
        mockRepository,
        undefined
      );
    });

    it('should return error when node not found in workflow', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      const result = await handlers.handleUpdateSingleNode(
        {
          id: 'test-workflow-id',
          nodeName: 'NonExistent Node',
          updates: { disabled: true }
        },
        mockRepository
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Node "NonExistent Node" not found in workflow test-workflow-id');
      expect(result.details).toEqual({
        availableNodes: ['HTTP Request', 'Set Variable'],
        hint: 'Use n8n_get_workflow_structure() to see all node names'
      });
    });

    it('should validate property paths before update', async () => {
      const result = await handlers.handleUpdateSingleNode(
        {
          id: 'test-workflow-id',
          nodeName: 'HTTP Request',
          // Missing updates
        },
        mockRepository
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
      expect(result.details).toHaveProperty('errors');
    });

    it('should handle invalid property values', async () => {
      const testWorkflow = createTestWorkflow();
      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);

      vi.mocked(handleUpdatePartialWorkflow).mockResolvedValue({
        success: false,
        error: 'Validation failed: Invalid parameter type'
      });

      const result = await handlers.handleUpdateSingleNode(
        {
          id: 'test-workflow-id',
          nodeName: 'HTTP Request',
          updates: {
            parameters: {
              method: 'INVALID_METHOD' // Invalid HTTP method
            }
          }
        },
        mockRepository
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });
});
