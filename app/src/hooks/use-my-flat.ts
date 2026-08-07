import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// A member belongs to at most one flat in v1 (docs/02-prd.md §5 "multi-flat
// membership per user" is out of scope), so "my flat" is a single row.
export function useMyFlat(session: Session | null | undefined) {
  const [flatId, setFlatId] = useState<string | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (session === undefined) return; // still loading session
    if (session === null) {
      setFlatId(null);
      return;
    }

    let cancelled = false;
    supabase
      .from('flat_members')
      .select('flat_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFlatId(data?.flat_id ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return flatId;
}
