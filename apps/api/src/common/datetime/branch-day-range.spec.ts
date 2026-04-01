import {
  calendarDateInTimeZone,
  normalizeCalendarDateInput,
  zonedDayBoundsUtc,
} from './branch-day-range';

describe('branch-day-range', () => {
  describe('normalizeCalendarDateInput', () => {
    it('accepts YYYY-MM-DD', () => {
      expect(normalizeCalendarDateInput('2024-06-15')).toBe('2024-06-15');
    });

    it('takes date portion from ISO strings', () => {
      expect(normalizeCalendarDateInput('2024-06-15T22:30:00.000Z')).toBe(
        '2024-06-15',
      );
    });

    it('returns null for invalid input', () => {
      expect(normalizeCalendarDateInput('not-a-date')).toBeNull();
      expect(normalizeCalendarDateInput('')).toBeNull();
    });
  });

  describe('zonedDayBoundsUtc', () => {
    it('covers the full calendar day in America/New_York (non-DST)', () => {
      const { start, end } = zonedDayBoundsUtc(
        '2024-01-15',
        'America/New_York',
      );
      expect(start.toISOString()).toBe('2024-01-15T05:00:00.000Z');
      expect(end.toISOString()).toBe('2024-01-16T04:59:59.999Z');
    });

    it('uses UTC when timezone is UTC', () => {
      const { start, end } = zonedDayBoundsUtc('2024-03-10', 'UTC');
      expect(start.toISOString()).toBe('2024-03-10T00:00:00.000Z');
      expect(end.toISOString()).toBe('2024-03-10T23:59:59.999Z');
    });
  });

  describe('calendarDateInTimeZone', () => {
    it('formats instant in IANA timezone as YYYY-MM-DD', () => {
      const instant = new Date('2024-07-04T04:00:00.000Z');
      expect(calendarDateInTimeZone(instant, 'America/Los_Angeles')).toBe(
        '2024-07-03',
      );
      expect(calendarDateInTimeZone(instant, 'UTC')).toBe('2024-07-04');
    });
  });
});
