import { fromZonedTime } from 'date-fns-tz';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD for `instant` interpreted in `timeZone` (IANA). */
export function calendarDateInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Normalize API input to YYYY-MM-DD (from full ISO or date-only). */
export function normalizeCalendarDateInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }
  const head = s.length >= 10 ? s.slice(0, 10) : s;
  return ISO_DATE.test(head) ? head : null;
}

/**
 * UTC instants covering the calendar day `dateStr` (YYYY-MM-DD) in `timeZone`.
 * Uses inclusive end at 23:59:59.999 local time in that zone.
 */
export function zonedDayBoundsUtc(
  dateStr: string,
  timeZone: string,
): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateStr}T00:00:00.000`, timeZone);
  const end = fromZonedTime(`${dateStr}T23:59:59.999`, timeZone);
  return { start, end };
}
