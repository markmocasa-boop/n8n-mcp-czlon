import { z } from 'zod';
export declare const TemplateMetadataSchema: any;
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;
export interface MetadataRequest {
    templateId: number;
    name: string;
    description?: string;
    nodes: string[];
    workflow?: any;
}
export interface MetadataResult {
    templateId: number;
    metadata: TemplateMetadata;
    error?: string;
}
export declare class MetadataGenerator {
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    private getJsonSchema;
    createBatchRequest(template: MetadataRequest): any;
    private sanitizeInput;
    private summarizeNodes;
    parseResult(result: any): MetadataResult;
    private getDefaultMetadata;
    generateSingle(template: MetadataRequest): Promise<TemplateMetadata>;
}
//# sourceMappingURL=metadata-generator.d.ts.map