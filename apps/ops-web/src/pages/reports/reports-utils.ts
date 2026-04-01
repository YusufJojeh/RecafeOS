export function formatMoneyMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function pctDeltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? '0% vs prior' : 'new vs prior';
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}% vs prior period`;
}

/** YYYY-MM-DD in UTC for rollup presets. */
export function utcCalendarDateOffsetDays(delta: number): string {
  const currentDate = new Date();
  currentDate.setUTCDate(currentDate.getUTCDate() + delta);
  return currentDate.toISOString().slice(0, 10);
}
