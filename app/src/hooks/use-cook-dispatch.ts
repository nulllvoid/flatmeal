import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface CookDispatchView {
  cookName: string;
  cookPhone: string;
  status: 'queued' | 'mocked' | 'sent' | 'delivered' | 'failed';
  payloadEn: string;
  payloadTranslated: string;
}

// Today's dispatch state for the flat's active cook — either the composed
// message pre-dispatch ('queued', dispatch_log row doesn't exist yet) or the
// actual dispatch_log row once dispatch_cook has run (docs/03-mvp-spec.md
// cook-message-preview). Realtime-subscribed so a status flip from
// wa_webhook (mocked/sent → delivered/failed) shows up live.
export function useCookDispatch(flatId: string | null | undefined) {
  const [dispatch, setDispatch] = useState<CookDispatchView | null | undefined>(undefined); // undefined = loading
  const [pollId, setPollId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) {
      setDispatch(null);
      return;
    }

    const todayIst = new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10);

    const [{ data: pollRow }, { data: cookRow }] = await Promise.all([
      supabase
        .from('daily_polls')
        .select('id, status, recipes:winner_recipe_id(name)')
        .eq('flat_id', flatId)
        .eq('poll_date', todayIst)
        .maybeSingle(),
      supabase.from('cooks').select('name, phone').eq('flat_id', flatId).eq('is_active', true).maybeSingle(),
    ]);

    if (!pollRow || !cookRow) {
      setDispatch(null);
      setPollId(null);
      return;
    }

    setPollId(pollRow.id);

    const { data: logRow } = await supabase
      .from('dispatch_log')
      .select('status, payload_en, payload_translated')
      .eq('poll_id', pollRow.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!logRow) {
      setDispatch({
        cookName: cookRow.name,
        cookPhone: cookRow.phone,
        status: 'queued',
        payloadEn: '',
        payloadTranslated: '',
      });
      return;
    }

    setDispatch({
      cookName: cookRow.name,
      cookPhone: cookRow.phone,
      status: logRow.status as CookDispatchView['status'],
      payloadEn: logRow.payload_en,
      payloadTranslated: logRow.payload_translated,
    });
  }, [flatId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!pollId) return;
    const channel = supabase
      .channel(`dispatch:${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatch_log', filter: `poll_id=eq.${pollId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, load]);

  return { dispatch, reload: load };
}
