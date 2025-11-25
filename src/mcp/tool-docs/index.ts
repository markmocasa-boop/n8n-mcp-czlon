import { ToolDocumentation } from './types';

// Import all tool documentations
import { searchNodesDoc } from './discovery';
import { getNodeDoc } from './configuration';
import { validateNodeDoc, validateWorkflowDoc } from './validation';
import { getTemplateDoc, searchTemplatesDoc } from './templates';
import {
  toolsDocumentationDoc,
  n8nHealthCheckDoc
} from './system';
import { aiAgentsGuide } from './guides';
import {
  n8nCreateWorkflowDoc,
  n8nGetWorkflowDoc,
  n8nUpdateFullWorkflowDoc,
  n8nUpdatePartialWorkflowDoc,
  n8nDeleteWorkflowDoc,
  n8nListWorkflowsDoc,
  n8nValidateWorkflowDoc,
  n8nAutofixWorkflowDoc,
  n8nTriggerWebhookWorkflowDoc,
  n8nExecutionsDoc,
  n8nWorkflowVersionsDoc
} from './workflow_management';

// Combine all tool documentations into a single object
// Total: 19 tools after v2.26.0 consolidation
export const toolsDocumentation: Record<string, ToolDocumentation> = {
  // System tools
  tools_documentation: toolsDocumentationDoc,
  n8n_health_check: n8nHealthCheckDoc,

  // Guides
  ai_agents_guide: aiAgentsGuide,

  // Discovery tools
  search_nodes: searchNodesDoc,

  // Configuration tools (consolidated)
  get_node: getNodeDoc,  // Replaces: get_node_info, get_node_essentials, get_node_documentation, search_node_properties

  // Validation tools (consolidated)
  validate_node: validateNodeDoc,  // Replaces: validate_node_operation, validate_node_minimal
  validate_workflow: validateWorkflowDoc,  // Options replace: validate_workflow_connections, validate_workflow_expressions

  // Template tools (consolidated)
  get_template: getTemplateDoc,
  search_templates: searchTemplatesDoc,  // Modes replace: list_node_templates, search_templates_by_metadata, get_templates_for_task

  // Workflow Management tools (n8n API)
  n8n_create_workflow: n8nCreateWorkflowDoc,
  n8n_get_workflow: n8nGetWorkflowDoc,  // Modes replace: n8n_get_workflow_details, n8n_get_workflow_structure, n8n_get_workflow_minimal
  n8n_update_full_workflow: n8nUpdateFullWorkflowDoc,
  n8n_update_partial_workflow: n8nUpdatePartialWorkflowDoc,
  n8n_delete_workflow: n8nDeleteWorkflowDoc,
  n8n_list_workflows: n8nListWorkflowsDoc,
  n8n_validate_workflow: n8nValidateWorkflowDoc,
  n8n_autofix_workflow: n8nAutofixWorkflowDoc,
  n8n_trigger_webhook_workflow: n8nTriggerWebhookWorkflowDoc,
  n8n_executions: n8nExecutionsDoc,  // Actions replace: n8n_get_execution, n8n_list_executions, n8n_delete_execution
  n8n_workflow_versions: n8nWorkflowVersionsDoc  // Modes: list, get, rollback, delete, prune, truncate
};

// Re-export types
export type { ToolDocumentation } from './types';