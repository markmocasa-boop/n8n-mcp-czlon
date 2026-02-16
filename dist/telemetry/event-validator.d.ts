import { TelemetryEvent, WorkflowTelemetry } from './telemetry-types';
export declare const telemetryEventSchema: any;
export declare const workflowTelemetrySchema: any;
export declare class TelemetryEventValidator {
    private validationErrors;
    private validationSuccesses;
    validateEvent(event: TelemetryEvent): TelemetryEvent | null;
    validateWorkflow(workflow: WorkflowTelemetry): WorkflowTelemetry | null;
    getStats(): {
        errors: number;
        successes: number;
        total: number;
        errorRate: number;
    };
    resetStats(): void;
}
//# sourceMappingURL=event-validator.d.ts.map