import { useCallback, useEffect, useState } from 'react';

import { scaleIngredient } from '@/lib/scale-ingredient';
import { supabase } from '@/lib/supabase';
import type { GroceryListData, GroceryLineView, IngredientUnit } from '@/types/domain';

// Grocery checklist for today's cart (all dishes, each scaled by its own
// cart quantity — not a shared flat headcount), with grocery_checks ("we
// already have this") realtime-synced across flatmates (docs/03-mvp-spec.md
// S2). Ingredients are listed separately per dish (not summed across dishes
// sharing an ingredient name) — grocery_checks stays keyed by
// recipe_ingredients.id, so two dishes both needing "onion" are two
// distinct, independently tickable rows.
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
      .select('id')
      .eq('flat_id', flatId)
      .eq('poll_date', todayIst)
      .maybeSingle();

    if (!pollRow) {
      setData(null);
      setPollId(null);
      return;
    }

    const { data: cartRows } = await supabase
      .from('cart_items')
      .select('recipe_id, quantity, recipes(name)')
      .eq('poll_id', pollRow.id);

    if (!cartRows || cartRows.length === 0) {
      setData(null);
      setPollId(pollRow.id);
      return;
    }

    setPollId(pollRow.id);

    const cartRecipeIds = cartRows.map((row) => row.recipe_id);

    const [{ data: ingredientRows }, { data: checkRows }] = await Promise.all([
      supabase
        .from('recipe_ingredients')
        .select('id, recipe_id, name_en, name_hi, name_kn, qty_per_person, unit, category, is_staple, sort_order')
        .in('recipe_id', cartRecipeIds)
        .order('sort_order'),
      supabase.from('grocery_checks').select('ingredient_id').eq('poll_id', pollRow.id),
    ]);

    const checkedIds = new Set((checkRows ?? []).map((c) => c.ingredient_id));
    const quantityByRecipe = new Map(cartRows.map((row) => [row.recipe_id, row.quantity]));
    const dishNameByRecipe = new Map(cartRows.map((row) => [row.recipe_id, row.recipes?.name ?? '']));

    const lines: GroceryLineView[] = (ingredientRows ?? []).map((row) => {
      const quantity = quantityByRecipe.get(row.recipe_id) ?? 1;
      return {
        ingredientId: row.id,
        dishName: dishNameByRecipe.get(row.recipe_id) ?? '',
        nameEn: row.name_en,
        nameHi: row.name_hi,
        nameKn: row.name_kn,
        quantityLabel: row.is_staple
          ? 'check you have'
          : scaleIngredient(row.qty_per_person, row.unit as IngredientUnit, quantity),
        category: row.category as GroceryLineView['category'],
        unit: row.unit as IngredientUnit,
        isStaple: row.is_staple,
        checked: checkedIds.has(row.id),
      };
    });

    const dishSummary = cartRows.map((row) => `${row.recipes?.name ?? ''} (${row.quantity})`).join(', ');

    setData({ dishSummary, lines });
  }, [flatId]);

  useEffect(() => {
    void Promise.resolve().then(load);
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
