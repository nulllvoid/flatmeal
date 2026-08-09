import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

function todayIst(): string {
  return new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Consecutive-day dispatched-cart streak (mockup: "13-day streak —
// unbroken"), walking backward from today. Derived from daily_polls, not a
// stored counter — same "no bespoke history table" principle as the 10-day
// no-repeat rule (docs/05-schema.sql). A gap of any length (missed day,
// cancelled poll, still-open today) breaks the streak at that point.
export function useStreak(flatId: string | null | undefined) {
  const [streak, setStreak] = useState<number | undefined>(undefined); // undefined = loading

  const load = useCallback(async () => {
    if (!flatId) {
      setStreak(0);
      return;
    }

    // 60 days back is comfortably more than any pilot-phase streak; a
    // single range query is simpler and cheaper than walking day-by-day.
    const earliestDate = addDays(todayIst(), -60);
    const { data: rows } = await supabase
      .from('daily_polls')
      .select('poll_date, status')
      .eq('flat_id', flatId)
      .gte('poll_date', earliestDate)
      .lte('poll_date', todayIst())
      .order('poll_date', { ascending: false });

    const dispatchedDates = new Set((rows ?? []).filter((r) => r.status === 'dispatched').map((r) => r.poll_date));

    // Today counts once dispatched; otherwise the streak is whatever run of
    // *prior* days is unbroken, starting the walk from yesterday.
    let cursor = dispatchedDates.has(todayIst()) ? todayIst() : addDays(todayIst(), -1);
    let count = 0;
    while (dispatchedDates.has(cursor)) {
      count += 1;
      cursor = addDays(cursor, -1);
    }

    setStreak(count);
  }, [flatId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return { streak, reload: load };
}
