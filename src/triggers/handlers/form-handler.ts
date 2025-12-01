/**
 * Form trigger handler
 *
 * Handles form-based workflow triggers:
 * - POST to /form/<workflowId> or /form-test/<workflowId>
 * - Passes form fields as request body
 * - Workflow must be active (for production endpoint)
 */

import { z } from 'zod';
import axios, { AxiosRequestConfig } from 'axios';
import { Workflow, WebhookRequest } from '../../types/n8n-api';
import {
  TriggerType,
  TriggerResponse,
  TriggerHandlerCapabilities,
  DetectedTrigger,
  FormTriggerInput,
} from '../types';
import { BaseTriggerHandler } from './base-handler';

/**
 * Zod schema for form input validation
 */
const formInputSchema = z.object({
  workflowId: z.string(),
  triggerType: z.literal('form'),
  formData: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().optional(),
  waitForResponse: z.boolean().optional(),
});

/**
 * Form trigger handler
 */
export class FormHandler extends BaseTriggerHandler<FormTriggerInput> {
  readonly triggerType: TriggerType = 'form';

  readonly capabilities: TriggerHandlerCapabilities = {
    requiresActiveWorkflow: true,
    canPassInputData: true,
  };

  readonly inputSchema = formInputSchema;

  async execute(
    input: FormTriggerInput,
    workflow: Workflow,
    triggerInfo?: DetectedTrigger
  ): Promise<TriggerResponse> {
    const startTime = Date.now();

    try {
      // Build form URL
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        return this.errorResponse(input, 'Cannot determine n8n base URL', startTime);
      }

      // Form triggers use /form/<path> endpoint
      // The path can be from trigger info or workflow ID
      const formPath = triggerInfo?.node?.parameters?.path || input.workflowId;
      const formUrl = `${baseUrl.replace(/\/+$/, '')}/form/${formPath}`;

      // Merge formData and data (formData takes precedence)
      const formFields = {
        ...input.data,
        ...input.formData,
      };

      // SSRF protection
      const { SSRFProtection } = await import('../../utils/ssrf-protection');
      const validation = await SSRFProtection.validateWebhookUrl(formUrl);
      if (!validation.valid) {
        return this.errorResponse(input, `SSRF protection: ${validation.reason}`, startTime);
      }

      // Build request config
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: formUrl,
        headers: {
          'Content-Type': 'application/json',
          ...input.headers,
        },
        data: formFields,
        timeout: input.timeout || (input.waitForResponse !== false ? 120000 : 30000),
        validateStatus: (status) => status < 500,
      };

      // Make the request
      const response = await axios.request(config);

      return this.normalizeResponse(response.data, input, startTime, {
        status: response.status,
        statusText: response.statusText,
        metadata: {
          duration: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Try to extract execution ID from error if available
      const errorDetails = (error as any)?.response?.data;
      const executionId = errorDetails?.executionId || errorDetails?.id;

      return this.errorResponse(input, errorMessage, startTime, {
        executionId,
        code: (error as any)?.code,
        details: errorDetails,
      });
    }
  }
}
