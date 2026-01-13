/**
 * Create Workflow Tool
 * 
 * This tool creates a new workflow in n8n.
 */

import { BaseWorkflowToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import { N8nApiError } from '../../errors/index.js';

/**
 * Handler for the create_workflow tool
 */
export class CreateWorkflowHandler extends BaseWorkflowToolHandler {
  /**
   * Validate webhook nodes to ensure proper POST body access
   * 
   * @param nodes Array of workflow nodes
   * @param connections Connection mappings between nodes
   * @returns Array of validation warnings
   */
  private validateWebhookNodes(
    nodes: any[],
    connections: Record<string, any>
  ): string[] {
    const warnings: string[] = [];
    
    if (!nodes || !Array.isArray(nodes)) {
      return warnings;
    }
    
    // Find all webhook nodes
    const webhookNodes = nodes.filter(
      node => node.type === 'n8n-nodes-base.webhook'
    );
    
    for (const webhookNode of webhookNodes) {
      const nodeId = webhookNode.name;
      
      // Check if this webhook has connections
      if (!connections || !connections[nodeId]?.main?.[0]?.[0]) {
        continue;
      }
      
      // Get the next connected node
      const nextConnection = connections[nodeId].main[0][0];
      const nextNodeName = nextConnection.node;
      const nextNode = nodes.find(n => n.name === nextNodeName);
      
      if (!nextNode) {
        continue;
      }
      
      // If next node is a Code node, validate body access
      if (nextNode.type === 'n8n-nodes-base.code') {
        const jsCode = nextNode.parameters?.jsCode || '';
        
        // Check for common POST body access patterns
        const hasProperBodyAccess = 
          jsCode.includes('$json.body') ||
          jsCode.includes('$input.first().json.body') ||
          jsCode.includes('$input.item.json.body') ||
          jsCode.includes('{{ $json.body');
        
        if (!hasProperBodyAccess) {
          warnings.push(
            `Webhook node "${nodeId}" connects to Code node "${nextNodeName}" ` +
            `that may not correctly access POST body. ` +
            `Use $json.body.* or $input.first().json.body.* to access POST data.`
          );
        }
      }
      
      // Check for other node types that commonly need body access
      if (nextNode.type === 'n8n-nodes-base.set') {
        const values = nextNode.parameters?.values?.values || [];
        const hasBodyReference = values.some((v: any) => 
          v.value?.includes('$json.body') ||
          v.value?.includes('{{ $json.body')
        );
        
        if (!hasBodyReference && webhookNode.parameters?.httpMethod === 'POST') {
          warnings.push(
            `Webhook node "${nodeId}" (POST) connects to Set node "${nextNodeName}" ` +
            `that may not reference POST body data. Consider using $json.body.* expressions.`
          );
        }
      }
    }
    
    return warnings;
  }
  
  /**
   * Execute the tool
   * 
   * @param args Tool arguments containing workflow details
   * @returns Created workflow information
   */
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async (args) => {
      const { name, nodes, connections, active, tags } = args;
      
      if (!name) {
        throw new N8nApiError('Missing required parameter: name');
      }
      
      // Validate nodes if provided
      if (nodes && !Array.isArray(nodes)) {
        throw new N8nApiError('Parameter "nodes" must be an array');
      }
      
      // Validate connections if provided
      if (connections && typeof connections !== 'object') {
        throw new N8nApiError('Parameter "connections" must be an object');
      }
      
      // Validate webhook nodes BEFORE creating workflow
      const webhookWarnings = this.validateWebhookNodes(nodes || [], connections || {});
      
      // Log warnings if any
      if (webhookWarnings.length > 0) {
        console.warn('⚠️  Webhook Validation Warnings:');
        webhookWarnings.forEach(warning => {
          console.warn(`   - ${warning}`);
        });
      }
      
      // Prepare workflow object
      const workflowData: Record<string, any> = {
        name,
        active: active === true,  // Default to false if not specified
      };
      
      // Add optional fields if provided
      if (nodes) workflowData.nodes = nodes;
      if (connections) workflowData.connections = connections;
      if (tags) workflowData.tags = tags;
      
      // Create the workflow
      const workflow = await this.apiService.createWorkflow(workflowData);
      
      // Prepare result with warnings if any
      const result: any = {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active
      };
      
      if (webhookWarnings.length > 0) {
        result.warnings = webhookWarnings;
      }
      
      return this.formatSuccess(
        result,
        `Workflow created successfully${webhookWarnings.length > 0 ? ' (with warnings)' : ''}`
      );
    }, args);
  }
}

/**
 * Get tool definition for the create_workflow tool
 * 
 * @returns Tool definition
 */
export function getCreateWorkflowToolDefinition(): ToolDefinition {
  return {
    name: 'create_workflow',
    description: 'Create a new workflow in n8n',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the workflow',
        },
        nodes: {
          type: 'array',
          description: 'Array of node objects that define the workflow',
          items: {
            type: 'object',
          },
        },
        connections: {
          type: 'object',
          description: 'Connection mappings between nodes',
        },
        active: {
          type: 'boolean',
          description: 'Whether the workflow should be active upon creation',
        },
        tags: {
          type: 'array',
          description: 'Tags to associate with the workflow',
          items: {
            type: 'string',
          },
        },
      },
      required: ['name'],
    },
  };
}
