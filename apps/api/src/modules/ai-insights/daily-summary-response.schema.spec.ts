import { parseDailySummaryJson } from './daily-summary-response.schema';

describe('parseDailySummaryJson', () => {
  it('parses valid JSON', () => {
    const r = parseDailySummaryJson(
      JSON.stringify({ summary: 'x', highlights: ['a'] }),
    );
    expect(r).toEqual({ summary: 'x', highlights: ['a'] });
  });

  it('returns null on invalid shape', () => {
    expect(parseDailySummaryJson(JSON.stringify({ foo: 1 }))).toBeNull();
  });
});
