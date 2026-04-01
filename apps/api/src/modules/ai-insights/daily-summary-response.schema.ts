import { z } from 'zod';

/** Structured model output — validated before returning to clients. */
export const DailySummaryInsightBodySchema = z.object({
  summary: z.string().max(4000),
  highlights: z.array(z.string().max(500)).max(8).optional(),
  cautions: z.array(z.string().max(500)).max(5).optional(),
});

export type DailySummaryInsightBody = z.infer<
  typeof DailySummaryInsightBodySchema
>;

export function parseDailySummaryJson(
  text: string,
): DailySummaryInsightBody | null {
  try {
    const raw = JSON.parse(text) as unknown;
    const parsed = DailySummaryInsightBodySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
