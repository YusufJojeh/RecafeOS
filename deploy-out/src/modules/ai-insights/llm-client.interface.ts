import type { LlmRequest, LlmResult } from './llm.types';

export interface LlmClient {
  completeStructured(input: LlmRequest): Promise<LlmResult>;
}
