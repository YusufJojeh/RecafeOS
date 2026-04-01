import { Injectable } from '@nestjs/common';
import type { LlmClient } from './llm-client.interface';
import type { LlmRequest, LlmResult } from './llm.types';

@Injectable()
export class NoopLlmClient implements LlmClient {
  completeStructured(input: LlmRequest): Promise<LlmResult> {
    void input;
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
}
