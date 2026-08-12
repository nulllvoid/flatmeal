import { useCallback, useEffect, useState } from 'react';

import { getMealType } from '@/lib/groups-stub';
import { MEAL_ORDER } from '@/lib/meal-copy';
import { supabase } from '@/lib/supabase';
import type { MealType } from '@/types/domain';
import type { Session } from '@supabase/supabase-js';

export interface GroupSummary {
  id: string;
  name: string;
  meal: MealType;
}

// All groups the user belongs to (a group is a flats row — see
// docs/superpowers/specs/2026-08-11-groups-refactor-design.md). Replaces
// use-my-flat's single-membership assumption: the DB always allowed multiple
// flat_members rows per user; the app now uses them.
export function useMyGroups(session: Session | null | undefined) {
  const [groups, setGroups] = useState<GroupSummary[] | undefined>(undefined); // undefined = loading

  const reload = useCallback(async () => {
    if (session === undefined) return; // still loading session
    if (session === null) {
      setGroups([]);
      return;
    }
    const { data } = await supabase
      .from('flat_members')
      .select('flat_id, flats(id, name)')
      .eq('user_id', session.user.id);
    const flats = (data ?? []).flatMap((row) => (row.flats ? [row.flats] : []));
    const summaries = await Promise.all(
      flats.map(async (flat) => ({
        id: flat.id,
        name: flat.name,
        meal: await getMealType(flat.id),
      }))
    );
    summaries.sort(
      (a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) || a.name.localeCompare(b.name)
    );
    setGroups(summaries);
  }, [session]);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  return { groups, reload };
}
