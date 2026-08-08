import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

type Flat = Tables<'flats'>;
type Cook = Tables<'cooks'>;
type Member = { userId: string; displayName: string; role: string };

export interface FlatSettingsData {
  flat: Flat;
  members: Member[];
  cook: Cook | null;
}

// Flat-level settings: the flat row itself (name, invite code, poll timings),
// its member list, and the active cook (docs/03-mvp-spec.md §S3 "Flat"
// section + "Cook" card). One active cook per flat, enforced by a partial
// unique index (docs/05-schema.sql).
export function useFlatSettings(flatId: string | null | undefined) {
  const [data, setData] = useState<FlatSettingsData | null | undefined>(undefined); // undefined = loading

  const load = useCallback(async () => {
    if (!flatId) {
      setData(null);
      return;
    }

    const [{ data: flatRow }, { data: memberRows }, { data: cookRow }] = await Promise.all([
      supabase.from('flats').select('*').eq('id', flatId).single(),
      supabase.from('flat_members').select('user_id, role, profiles(display_name)').eq('flat_id', flatId),
      supabase.from('cooks').select('*').eq('flat_id', flatId).eq('is_active', true).maybeSingle(),
    ]);

    if (!flatRow) {
      setData(null);
      return;
    }

    setData({
      flat: flatRow,
      members: (memberRows ?? []).map((m) => ({
        userId: m.user_id,
        displayName: m.profiles?.display_name ?? 'Flatmate',
        role: m.role,
      })),
      cook: cookRow ?? null,
    });
  }, [flatId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function updateFlat(patch: TablesUpdate<'flats'>) {
    if (!flatId) return;
    const { error } = await supabase.from('flats').update(patch).eq('id', flatId);
    if (!error) await load();
    return { error };
  }

  async function upsertCook(patch: { name: string; phone: string; language: string }) {
    if (!flatId) return;
    const existing = data?.cook;
    const { error } = existing
      ? await supabase.from('cooks').update(patch).eq('id', existing.id)
      : await supabase.from('cooks').insert({ flat_id: flatId, ...patch });
    if (!error) await load();
    return { error };
  }

  async function leaveFlat(userId: string) {
    if (!flatId) return;
    const { error } = await supabase.from('flat_members').delete().eq('flat_id', flatId).eq('user_id', userId);
    return { error };
  }

  return { data, updateFlat, upsertCook, leaveFlat, reload: load };
}
