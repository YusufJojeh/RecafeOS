import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmClient } from './llm-client.interface';
import type { LlmRequest, LlmResult } from './llm.types';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * OpenAI-compatible chat completions over HTTP (`LLM_BASE_URL` + `/chat/completions`).
 * No SDK dependency — swap providers via base URL.
 */
@Injectable()
export class HttpLlmClient implements LlmClient {
  private readonly logger = new Logger(HttpLlmClient.name);

  constructor(private readonly config: ConfigService) {}

  async completeStructured(input: LlmRequest): Promise<LlmResult> {
    const apiKey = this.config.get<string>('LLM_API_KEY')?.trim();
    const baseUrl = (
      this.config.get<string>('LLM_BASE_URL') ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model = this.config.get<string>('LLM_MODEL') ?? 'gpt-4o-mini';
    const timeoutMs =
      Number(this.config.get<string>('LLM_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS;

    if (!apiKey) {
      return { ok: false, reason: 'unavailable', detail: 'no_api_key' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 1024,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.logger.warn(
          { status: res.status, taskKind: input.taskKind },
          'LLM HTTP error',
        );
        return {
          ok: false,
          reason: 'http_error',
          detail: `${res.status}: ${errText.slice(0, 200)}`,
        };
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { ok: false, reason: 'invalid_response' };
      }
      return {
        ok: true,
        text,
        model: body.model ?? model,
        usage: {
          promptTokens: body.usage?.prompt_tokens,
          completionTokens: body.usage?.completion_tokens,
        },
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      this.logger.warn(
        { taskKind: input.taskKind, aborted },
        'LLM request failed',
      );
      return {
        ok: false,
        reason: aborted ? 'timeout' : 'http_error',
        detail: e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
