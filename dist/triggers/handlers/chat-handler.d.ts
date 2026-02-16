import { Workflow } from '../../types/n8n-api';
import { TriggerType, TriggerResponse, TriggerHandlerCapabilities, DetectedTrigger, ChatTriggerInput } from '../types';
import { BaseTriggerHandler } from './base-handler';
export declare class ChatHandler extends BaseTriggerHandler<ChatTriggerInput> {
    readonly triggerType: TriggerType;
    readonly capabilities: TriggerHandlerCapabilities;
    readonly inputSchema: any;
    execute(input: ChatTriggerInput, workflow: Workflow, triggerInfo?: DetectedTrigger): Promise<TriggerResponse>;
}
//# sourceMappingURL=chat-handler.d.ts.map