import { describe, it, expect, vi, beforeEach } from 'vitest';
import { n8nManagementTools } from '@/mcp/tools-n8n-manager';

// Mock dependencies before importing server
vi.mock('@/services/n8n-api-client');
vi.mock('@/database/node-repository');
vi.mock('@/config/n8n-api', () => ({
  getN8nApiConfig: vi.fn(),
  isN8nApiConfigured: vi.fn()
}));
vi.mock('@/mcp/handlers-n8n-manager', () => ({
  handleGetNodeDetails: vi.fn(),
  handleUpdateSingleNode: vi.fn(),
  handleCreateWorkflow: vi.fn(),
  handleGetWorkflow: vi.fn(),
  handleUpdateWorkflow: vi.fn(),
  handleDeleteWorkflow: vi.fn(),
  handleListWorkflows: vi.fn(),
  handleGetWorkflowDetails: vi.fn(),
  handleGetWorkflowStructure: vi.fn(),
  handleGetWorkflowMinimal: vi.fn(),
  handleValidateWorkflow: vi.fn(),
  handleAutofixWorkflow: vi.fn(),
  handleTriggerWebhookWorkflow: vi.fn(),
  handleGetExecution: vi.fn(),
  handleListExecutions: vi.fn(),
  handleDeleteExecution: vi.fn(),
  handleHealthCheck: vi.fn(),
  handleListAvailableTools: vi.fn(),
  handleDiagnostic: vi.fn(),
  handleWorkflowVersions: vi.fn(),
  getN8nApiClient: vi.fn()
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
  }
}));

describe('N8NDocumentationMCPServer - Node-Specific Tools', () => {
  let isN8nApiConfigured: any;
  let mockHandlers: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock n8n API as configured
    isN8nApiConfigured = (await import('@/config/n8n-api')).isN8nApiConfigured;
    vi.mocked(isN8nApiConfigured).mockReturnValue(true);

    // Import mock handlers
    mockHandlers = await import('@/mcp/handlers-n8n-manager');
  });

  describe('Tool Registration', () => {
    it('should register n8n_get_node_details tool', () => {
      const tool = n8nManagementTools.find(t => t.name === 'n8n_get_node_details');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('n8n_get_node_details');
      expect(tool?.description).toContain('node');
      expect(tool?.inputSchema.type).toBe('object');
    });

    it('should register n8n_update_single_node tool', () => {
      const tool = n8nManagementTools.find(t => t.name === 'n8n_update_single_node');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('n8n_update_single_node');
      expect(tool?.description).toContain('node');
      expect(tool?.inputSchema.type).toBe('object');
    });

    it('should have correct schema for n8n_get_node_details', () => {
      const tool = n8nManagementTools.find(t => t.name === 'n8n_get_node_details');

      expect(tool?.inputSchema.properties).toHaveProperty('id');
      expect(tool?.inputSchema.properties).toHaveProperty('nodeName');
      expect(tool?.inputSchema.required).toContain('id');
      expect(tool?.inputSchema.required).toContain('nodeName');
    });

    it('should have correct schema for n8n_update_single_node', () => {
      const tool = n8nManagementTools.find(t => t.name === 'n8n_update_single_node');

      expect(tool?.inputSchema.properties).toHaveProperty('id');
      expect(tool?.inputSchema.properties).toHaveProperty('nodeName');
      expect(tool?.inputSchema.properties).toHaveProperty('updates');
      expect(tool?.inputSchema.required).toContain('id');
      expect(tool?.inputSchema.required).toContain('nodeName');
      expect(tool?.inputSchema.required).toContain('updates');
    });
  });

  describe('Request Routing', () => {
    it('should route n8n_get_node_details to handleGetNodeDetails', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      // Mock database file to prevent initialization errors
      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();

      // Mock the handler to return a success response
      vi.mocked(mockHandlers.handleGetNodeDetails).mockResolvedValue({
        success: true,
        data: {
          workflowId: 'wf-123',
          workflowName: 'Test Workflow',
          node: {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4.1,
            position: [100, 100],
            parameters: {}
          },
          connections: { inputs: {}, outputs: {} }
        }
      });

      // Wait for server initialization
      await server['initialized'];

      // Call the tool handler
      const result = await server['handleToolCall']({
        name: 'n8n_get_node_details',
        arguments: {
          id: 'wf-123',
          nodeName: 'HTTP Request'
        }
      });

      expect(mockHandlers.handleGetNodeDetails).toHaveBeenCalledWith(
        {
          id: 'wf-123',
          nodeName: 'HTTP Request'
        },
        undefined
      );
      expect(result.success).toBe(true);
    });

    it('should route n8n_update_single_node to handleUpdateSingleNode', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();

      vi.mocked(mockHandlers.handleUpdateSingleNode).mockResolvedValue({
        success: true,
        data: { updated: true }
      });

      await server['initialized'];

      const result = await server['handleToolCall']({
        name: 'n8n_update_single_node',
        arguments: {
          id: 'wf-123',
          nodeName: 'HTTP Request',
          updates: { disabled: true }
        }
      });

      expect(mockHandlers.handleUpdateSingleNode).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors from n8n_get_node_details gracefully', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();

      vi.mocked(mockHandlers.handleGetNodeDetails).mockResolvedValue({
        success: false,
        error: 'Node not found'
      });

      await server['initialized'];

      const result = await server['handleToolCall']({
        name: 'n8n_get_node_details',
        arguments: {
          id: 'wf-123',
          nodeName: 'NonExistent'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Node not found');
    });

    it('should handle errors from n8n_update_single_node gracefully', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();

      vi.mocked(mockHandlers.handleUpdateSingleNode).mockResolvedValue({
        success: false,
        error: 'Validation failed'
      });

      await server['initialized'];

      const result = await server['handleToolCall']({
        name: 'n8n_update_single_node',
        arguments: {
          id: 'wf-123',
          nodeName: 'HTTP Request',
          updates: { invalid: 'data' }
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters for n8n_get_node_details', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();
      await server['initialized'];

      // Test missing id
      const result1 = await server['handleToolCall']({
        name: 'n8n_get_node_details',
        arguments: {
          nodeName: 'HTTP Request'
        }
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('id');

      // Test missing nodeName
      const result2 = await server['handleToolCall']({
        name: 'n8n_get_node_details',
        arguments: {
          id: 'wf-123'
        }
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('nodeName');
    });

    it('should validate required parameters for n8n_update_single_node', async () => {
      const { N8NDocumentationMCPServer } = await import('@/mcp/server');

      vi.stubEnv('NODE_DB_PATH', ':memory:');

      const server = new N8NDocumentationMCPServer();
      await server['initialized'];

      // Test missing updates
      const result = await server['handleToolCall']({
        name: 'n8n_update_single_node',
        arguments: {
          id: 'wf-123',
          nodeName: 'HTTP Request'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('updates');
    });
  });
});
