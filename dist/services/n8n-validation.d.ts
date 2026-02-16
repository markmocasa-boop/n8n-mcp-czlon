import { z } from 'zod';
import { WorkflowNode, WorkflowConnection, Workflow } from '../types/n8n-api';
export declare const workflowNodeSchema: any;
export declare const workflowConnectionSchema: any;
export declare const workflowSettingsSchema: any;
export declare const defaultWorkflowSettings: {
    executionOrder: "v1";
    saveDataErrorExecution: "all";
    saveDataSuccessExecution: "all";
    saveManualExecutions: boolean;
    saveExecutionProgress: boolean;
};
export declare function validateWorkflowNode(node: unknown): WorkflowNode;
export declare function validateWorkflowConnections(connections: unknown): WorkflowConnection;
export declare function validateWorkflowSettings(settings: unknown): z.infer<typeof workflowSettingsSchema>;
export declare function cleanWorkflowForCreate(workflow: Partial<Workflow>): Partial<Workflow>;
export declare function cleanWorkflowForUpdate(workflow: Workflow): Partial<Workflow>;
export declare function validateWorkflowStructure(workflow: Partial<Workflow>): string[];
export declare function hasWebhookTrigger(workflow: Workflow): boolean;
export declare function validateFilterBasedNodeMetadata(node: WorkflowNode): string[];
export declare function validateOperatorStructure(operator: any, path: string): string[];
export declare function getWebhookUrl(workflow: Workflow): string | null;
export declare function getWorkflowStructureExample(): string;
export declare function getWorkflowFixSuggestions(errors: string[]): string[];
//# sourceMappingURL=n8n-validation.d.ts.map