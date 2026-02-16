import { Workflow } from '../../types/n8n-api';
import { TriggerType, TriggerResponse, TriggerHandlerCapabilities, DetectedTrigger, WebhookTriggerInput } from '../types';
import { BaseTriggerHandler } from './base-handler';
export declare class WebhookHandler extends BaseTriggerHandler<WebhookTriggerInput> {
    readonly triggerType: TriggerType;
    readonly capabilities: TriggerHandlerCapabilities;
    readonly inputSchema: any;
    execute(input: WebhookTriggerInput, workflow: Workflow, triggerInfo?: DetectedTrigger): Promise<TriggerResponse>;
}
//# sourceMappingURL=webhook-handler.d.ts.map