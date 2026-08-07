import { useCallback, useEffect, useState } from 'react';

import { scaleIngredient } from '@/lib/scale-ingredient';
import { supabase } from '@/lib/supabase';
import type { GroceryLineView, IngredientUnit } from '@/types/domain';

export interface GroceryListData {
  dishName: string;
  headcount: number;
  lines: GroceryLineView[];
}

// Grocery checklist for today's winning dish, scaled to current headcount,
// with grocery_checks ("we already have this") realtime-synced across
// flatmates (docs/03-mvp-spec.md S2).
export function useGroceryList(flatId: string | null | undefined) {
  const [data, setData] = useState<GroceryListData | null | undefined>(undefined); // undefined = loading
  const [pollId, setPollId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) {
      setData(null);
      return;
    }

    const todayIst = new Date(Date.now() + (5 * 60 + 30) * 60000).toISOString().slice(0, 10);

    const { data: pollRow } = await supabase
      .from('daily_polls')
      .select('id, winner_recipe_id, recipes:winner_recipe_id(name)')
      .eq('flat_id', flatId)
      .eq('poll_date', todayIst)
      .maybeSingle();

    if (!pollRow || !pollRow.winner_recipe_id) {
      setData(null);
      setPollId(null);
      return;
    }

    setPollId(pollRow.id);

    const [{ data: memberRows }, { data: attendanceRows }, { data: ingredientRows }, { data: checkRows }] =
      await Promise.all([
        supabase.from('flat_members').select('user_id').eq('flat_id', flatId),
        supabase
          .from('day_attendance')
          .select('user_id, is_out')
          .eq('flat_id', flatId)
          .eq('poll_date', todayIst),
        supabase
          .from('recipe_ingredients')
          .select('id, name_en, name_hi, name_kn, qty_per_person, unit, category, is_staple, sort_order')
          .eq('recipe_id', pollRow.winner_recipe_id)
          .order('sort_order'),
        supabase.from('grocery_checks').select('ingredient_id').eq('poll_id', pollRow.id),
      ]);

    const outCount = (attendanceRows ?? []).filter((a) => a.is_out).length;
    const headcount = Math.max((memberRows ?? []).length - outCount, 0);
    const checkedIds = new Set((checkRows ?? []).map((c) => c.ingredient_id));

    const lines: GroceryLineView[] = (ingredientRows ?? []).map((row) => ({
      ingredientId: row.id,
      nameEn: row.name_en,
      nameHi: row.name_hi,
      nameKn: row.name_kn,
      quantityLabel: row.is_staple
        ? 'check you have'
        : scaleIngredient(row.qty_per_person, row.unit as IngredientUnit, headcount),
      category: row.category as GroceryLineView['category'],
      unit: row.unit as IngredientUnit,
      isStaple: row.is_staple,
      checked: checkedIds.has(row.id),
    }));

    setData({ dishName: pollRow.recipes?.name ?? '', headcount, lines });
  }, [flatId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pollId) return;
    const channel = supabase
      .channel(`grocery:${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grocery_checks', filter: `poll_id=eq.${pollId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, load]);

  async function toggleChecked(ingredientId: string, checked: boolean) {
    if (!pollId) return;
    if (checked) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from('grocery_checks')
        .upsert({ poll_id: pollId, ingredient_id: ingredientId, checked_by: user?.id });
    } else {
      await supabase
        .from('grocery_checks')
        .delete()
        .eq('poll_id', pollId)
        .eq('ingredient_id', ingredientId);
    }
    await load();
  }

  return { data, toggleChecked };
}
