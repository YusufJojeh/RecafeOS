import { describe, expect, it } from 'vitest';
import {
  formatMoneyMinor,
  pctDeltaLabel,
  utcCalendarDateOffsetDays,
} from './reports-utils';

describe('formatMoneyMinor', () => {
  it('formats zero as 0.00', () => {
    expect(formatMoneyMinor(0)).toBe('0.00');
  });
  it('formats whole dollars', () => {
    expect(formatMoneyMinor(1000)).toBe('10.00');
  });
  it('formats cents', () => {
    expect(formatMoneyMinor(199)).toBe('1.99');
  });
  it('formats large amounts', () => {
    expect(formatMoneyMinor(123456)).toBe('1234.56');
  });
  it('rounds to 2 decimal places', () => {
    expect(formatMoneyMinor(1)).toBe('0.01');
  });
});

describe('pctDeltaLabel', () => {
  it('returns "0% vs prior" when both are zero', () => {
    expect(pctDeltaLabel(0, 0)).toBe('0% vs prior');
  });
  it('returns "new vs prior" when previous is zero and current is positive', () => {
    expect(pctDeltaLabel(100, 0)).toBe('new vs prior');
  });
  it('returns positive delta with + prefix', () => {
    expect(pctDeltaLabel(120, 100)).toBe('+20% vs prior period');
  });
  it('returns negative delta without + prefix', () => {
    expect(pctDeltaLabel(80, 100)).toBe('-20% vs prior period');
  });
  it('returns +0% when values are equal', () => {
    expect(pctDeltaLabel(100, 100)).toBe('+0% vs prior period');
  });
  it('rounds percentage', () => {
    expect(pctDeltaLabel(133, 100)).toBe('+33% vs prior period');
  });
});

describe('utcCalendarDateOffsetDays', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = utcCalendarDateOffsetDays(0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('yesterday is before today', () => {
    const today = utcCalendarDateOffsetDays(0);
    const yesterday = utcCalendarDateOffsetDays(-1);
    expect(yesterday < today).toBe(true);
  });
  it('tomorrow is after today', () => {
    const today = utcCalendarDateOffsetDays(0);
    const tomorrow = utcCalendarDateOffsetDays(1);
    expect(tomorrow > today).toBe(true);
  });
});
