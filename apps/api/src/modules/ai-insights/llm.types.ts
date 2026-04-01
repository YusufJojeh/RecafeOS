/** Task kinds for prompt routing and telemetry — no vendor-specific types here. */
export const LlmTaskKind = {
  DAILY_SUMMARY_EXPLAIN: 'daily_summary_explain',
  WEEKLY_DIGEST_EXPLAIN: 'weekly_digest_explain',
  UNDERPERFORMING_ITEMS: 'underperforming_items',
  PROMOTION_IDEA: 'promotion_idea',
  SOCIAL_CAPTION: 'social_caption',
  STOCK_RISK_HINT: 'stock_risk_hint',
  BRANCH_COMPARE_COMMENT: 'branch_compare_comment',
} as const;
export type LlmTaskKind = (typeof LlmTaskKind)[keyof typeof LlmTaskKind];

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmRequest = {
  taskKind: LlmTaskKind;
  promptVersion: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type LlmResult =
  | {
      ok: true;
      text: string;
      model?: string;
      usage?: { promptTokens?: number; completionTokens?: number };
    }
  | {
      ok: false;
      reason: 'unavailable' | 'timeout' | 'invalid_response' | 'http_error';
      detail?: string;
    };

export const LLM_CLIENT = Symbol('LLM_CLIENT');
