/** Minor units (e.g. cents) — integer math only */

export function formatMinor(minor: number, currency: string = 'USD'): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function parseMajorToMinor(major: string): number {
  const n = parseFloat(major.replace(/,/g, ''));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Start of calendar day in a given IANA timezone */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const d = new Date(date);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) return d;
  // Interpret as midnight in that TZ via offset hack: use UTC date constructor + offset
  const iso = `${y}-${m}-${day}T00:00:00`;
  const test = new Date(`${iso}Z`);
  const offsetMin = getTimeZoneOffsetMinutes(test, timeZone);
  return new Date(test.getTime() - offsetMin * 60 * 1000);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const inTz = new Date(date.toLocaleString('en-US', { timeZone }));
  const inUtc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (inUtc.getTime() - inTz.getTime()) / 60000;
}
