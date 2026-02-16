import { Workflow } from '../../types/n8n-api';
import { TriggerType, TriggerResponse, TriggerHandlerCapabilities, DetectedTrigger, FormTriggerInput } from '../types';
import { BaseTriggerHandler } from './base-handler';
export declare class FormHandler extends BaseTriggerHandler<FormTriggerInput> {
    readonly triggerType: TriggerType;
    readonly capabilities: TriggerHandlerCapabilities;
    readonly inputSchema: any;
    execute(input: FormTriggerInput, workflow: Workflow, triggerInfo?: DetectedTrigger): Promise<TriggerResponse>;
}
//# sourceMappingURL=form-handler.d.ts.map