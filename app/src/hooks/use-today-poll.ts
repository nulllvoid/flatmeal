import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { AccompanimentOptionView, PollOptionView, TodayPollView } from '@/types/domain';

// Today's poll for the current user's flat, realtime-subscribed to votes so
// counts update live across flatmates (docs/02-prd.md §F2 "live vote counts
// visible"). One flat per user in v1 (see use-my-flat.ts).
export function useTodayPoll(flatId: string | null | undefined, userId: string | undefined) {
  const [poll, setPoll] = useState<TodayPollView | null | undefined>(undefined); // undefined = loading
  const [headcount, setHeadcount] = useState(0);

  const load = useCallback(async () => {
    if (!flatId || !userId) {
      setPoll(null);
      return;
    }

    const todayIst = new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10);

    const { data: pollRow } = await supabase
      .from('daily_polls')
      .select(
        'id, poll_date, status, winner_recipe_id, winner_reason, winner_accompaniment_recipe_id, winner_accompaniment_reason'
      )
      .eq('flat_id', flatId)
      .eq('poll_date', todayIst)
      .maybeSingle();

    if (!pollRow) {
      setPoll(null);
      return;
    }

    const [
      { data: optionRows },
      { data: voteRows },
      { data: memberRows },
      { data: attendanceRows },
      { data: accompanimentOptionRows },
      { data: accompanimentVoteRows },
    ] = await Promise.all([
      supabase
        .from('poll_options')
        .select('recipe_id, position, recipes(name, cuisine, diet_class)')
        .eq('poll_id', pollRow.id)
        .order('position'),
      supabase.from('votes').select('user_id, recipe_id, profiles(display_name)').eq('poll_id', pollRow.id),
      supabase.from('flat_members').select('user_id').eq('flat_id', flatId),
      supabase
        .from('day_attendance')
        .select('user_id, is_out')
        .eq('flat_id', flatId)
        .eq('poll_date', todayIst),
      supabase
        .from('poll_accompaniment_options')
        .select('recipe_id, position, recipes(name)')
        .eq('poll_id', pollRow.id)
        .order('position'),
      supabase
        .from('accompaniment_votes')
        .select('user_id, recipe_id, profiles(display_name)')
        .eq('poll_id', pollRow.id),
    ]);

    const outUserIds = new Set((attendanceRows ?? []).filter((a) => a.is_out).map((a) => a.user_id));
    const memberCount = (memberRows ?? []).length;
    setHeadcount(Math.max(memberCount - outUserIds.size, 0));

    const votesByRecipe = new Map<string, { userId: string; displayName: string }[]>();
    for (const vote of voteRows ?? []) {
      const list = votesByRecipe.get(vote.recipe_id) ?? [];
      list.push({ userId: vote.user_id, displayName: vote.profiles?.display_name ?? 'Someone' });
      votesByRecipe.set(vote.recipe_id, list);
    }

    const options: PollOptionView[] = (optionRows ?? [])
      .filter((row) => row.recipes !== null)
      .map((row) => {
        const voters = votesByRecipe.get(row.recipe_id) ?? [];
        return {
          recipeId: row.recipe_id,
          name: row.recipes!.name,
          cuisine: row.recipes!.cuisine,
          dietClass: row.recipes!.diet_class as PollOptionView['dietClass'],
          voteCount: voters.length,
          votedByMe: voters.some((v) => v.userId === userId),
          voterDisplayNames: voters.map((v) => v.displayName),
        };
      });

    const accompanimentVotesByRecipe = new Map<string, { userId: string; displayName: string }[]>();
    for (const vote of accompanimentVoteRows ?? []) {
      const list = accompanimentVotesByRecipe.get(vote.recipe_id) ?? [];
      list.push({ userId: vote.user_id, displayName: vote.profiles?.display_name ?? 'Someone' });
      accompanimentVotesByRecipe.set(vote.recipe_id, list);
    }

    const accompanimentOptions: AccompanimentOptionView[] = (accompanimentOptionRows ?? [])
      .filter((row) => row.recipes !== null)
      .map((row) => {
        const voters = accompanimentVotesByRecipe.get(row.recipe_id) ?? [];
        return {
          recipeId: row.recipe_id,
          name: row.recipes!.name,
          voteCount: voters.length,
          votedByMe: voters.some((v) => v.userId === userId),
          voterDisplayNames: voters.map((v) => v.displayName),
        };
      });

    setPoll({
      pollId: pollRow.id,
      pollDate: pollRow.poll_date,
      status: pollRow.status as TodayPollView['status'],
      options,
      headcount: Math.max(memberCount - outUserIds.size, 0),
      isOutToday: outUserIds.has(userId),
      winnerRecipeId: pollRow.winner_recipe_id,
      winnerReason: pollRow.winner_reason as TodayPollView['winnerReason'],
      accompanimentOptions,
      winnerAccompanimentRecipeId: pollRow.winner_accompaniment_recipe_id,
      winnerAccompanimentReason: pollRow.winner_accompaniment_reason as TodayPollView['winnerAccompanimentReason'],
      accompanimentVotingOpen:
        pollRow.status === 'closed' && accompanimentOptions.length > 0 && pollRow.winner_accompaniment_recipe_id === null,
    });
  }, [flatId, userId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!poll) return;
    const channel = supabase
      .channel(`poll:${poll.pollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `poll_id=eq.${poll.pollId}` }, () => {
        load();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accompaniment_votes', filter: `poll_id=eq.${poll.pollId}` },
        () => {
          load();
        }
      )
      // Poll status/winner changes (poll close, dispatch) — without this,
      // a client that loaded the poll while it was still 'open' never
      // learns it closed until something else triggers a refetch.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'daily_polls', filter: `id=eq.${poll.pollId}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribing on every `load` identity change would tear down/recreate the channel needlessly; poll.pollId is the only thing that should retrigger this.
  }, [poll?.pollId]);

  async function castVote(recipeId: string) {
    if (!poll || !userId) return;
    await supabase.from('votes').upsert({ poll_id: poll.pollId, user_id: userId, recipe_id: recipeId });
    await load();
  }

  async function castAccompanimentVote(recipeId: string) {
    if (!poll || !userId) return;
    await supabase.from('accompaniment_votes').upsert({ poll_id: poll.pollId, user_id: userId, recipe_id: recipeId });
    await load();
  }

  async function setOutToday(isOut: boolean) {
    if (!flatId || !userId) return;
    const todayIst = new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10);
    await supabase
      .from('day_attendance')
      .upsert({ flat_id: flatId, user_id: userId, poll_date: todayIst, is_out: isOut });
    await load();
  }

  return { poll, headcount, castVote, castAccompanimentVote, setOutToday, reload: load };
}
