import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

type Profile = Tables<'profiles'>;

// The current user's own profile row (dietary type, Jain toggle, allergies,
// notification mute) — editable via Settings (docs/03-mvp-spec.md §S3).
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = loading

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, [userId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function updateProfile(patch: TablesUpdate<'profiles'>) {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();
    if (!error && data) setProfile(data);
    return { error };
  }

  return { profile, updateProfile, reload: load };
}
