// All flat schedule columns (poll_open_time / poll_close_time / dispatch_time)
// are `time` values assumed Asia/Kolkata for v1 (docs/04-architecture.md).
// pg_cron fires this function every 15 minutes; each run selects flats whose
// local IST time-of-day matches (within the run's 15-minute window).

const IST_OFFSET_MINUTES = 5 * 60 + 30;

export function nowInIst(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
}

export function istTimeOfDay(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function istDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// True if `target` (a `time` column value, e.g. "09:00:00") falls within
// [windowStart, windowStart + windowMinutes) of `nowIst`'s time-of-day.
export function isWithinCronWindow(target: string, nowIst: Date, windowMinutes = 15): boolean {
  const [targetH, targetM] = target.split(':').map(Number);
  const targetMinutes = targetH * 60 + targetM;
  const nowMinutes = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes;
}
