import { ToolDocumentation } from '../types';

export const n8nDeployTemplateDoc: ToolDocumentation = {
  name: 'n8n_deploy_template',
  category: 'workflow_management',
  essentials: {
    description: 'Deploy a workflow template from n8n.io directly to your n8n instance. Fetches template, optionally upgrades node versions and validates, then creates workflow.',
    keyParameters: ['templateId', 'name', 'autoUpgradeVersions', 'validate', 'stripCredentials'],
    example: 'n8n_deploy_template({templateId: 2776, name: "My Deployed Template"})',
    performance: 'Network-dependent',
    tips: [
      'Workflow created inactive - configure credentials in n8n UI first',
      'Returns list of required credentials',
      'Use search_templates to find template IDs',
      'Templates are upgraded to latest node versions by default'
    ]
  },
  full: {
    description: 'Deploys a workflow template from n8n.io directly to your n8n instance. This tool combines fetching a template and creating a workflow in a single operation. Templates are stored locally and fetched from the database. The workflow is always created in an inactive state, allowing you to configure credentials before activation.',
    parameters: {
      templateId: { type: 'number', required: true, description: 'Template ID from n8n.io (find via search_templates)' },
      name: { type: 'string', description: 'Custom workflow name (default: template name)' },
      autoUpgradeVersions: { type: 'boolean', description: 'Upgrade node typeVersions to latest supported (default: true)' },
      validate: { type: 'boolean', description: 'Validate workflow before deployment (default: true)' },
      stripCredentials: { type: 'boolean', description: 'Remove credential references - user configures in n8n UI (default: true)' }
    },
    returns: 'Object with workflowId, name, nodeCount, triggerType, requiredCredentials array, url, templateId, templateUrl',
    examples: [
      `// Deploy template with default settings
n8n_deploy_template({templateId: 2776})`,
      `// Deploy with custom name
n8n_deploy_template({
  templateId: 2776,
  name: "My Google Drive to Airtable Sync"
})`,
      `// Deploy without validation (faster, use for trusted templates)
n8n_deploy_template({
  templateId: 2776,
  validate: false
})`,
      `// Keep original node versions (useful for compatibility)
n8n_deploy_template({
  templateId: 2776,
  autoUpgradeVersions: false
})`
    ],
    useCases: [
      'Quickly deploy pre-built workflow templates',
      'Set up common automation patterns',
      'Bootstrap new projects with proven workflows',
      'Deploy templates found via search_templates'
    ],
    performance: 'Network-dependent - Typically 200-500ms (template fetch + workflow creation)',
    bestPractices: [
      'Use search_templates to find templates by use case',
      'Review required credentials in the response',
      'Configure credentials in n8n UI before activating',
      'Test workflow before connecting to production systems'
    ],
    pitfalls: [
      '**REQUIRES N8N_API_URL and N8N_API_KEY environment variables** - tool unavailable without n8n API access',
      'Workflows created in INACTIVE state - must configure credentials and activate in n8n',
      'Templates may reference services you do not have (Slack, Google, etc.)',
      'Template database must be populated - run npm run fetch:templates if templates not found',
      'Validation may fail for templates with outdated node configurations'
    ],
    relatedTools: ['search_templates', 'get_template', 'n8n_create_workflow', 'n8n_validate_workflow']
  }
};
