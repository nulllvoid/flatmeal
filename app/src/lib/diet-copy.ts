import type { DietType } from '@/types/domain';

// Every user-visible diet word lives here, same pattern as meal-copy.ts.
//
// diet_type stays a single ranked value per person (veg < egg < nonveg) —
// "Eggetarian" already means "eats veg + egg, never nonveg" under the
// existing ranking in supabase/functions/create_poll/select-options.ts's
// isRecipeEligible (a flat's dietary ceiling is its most restrictive
// member's rank), it just wasn't labeled that way in the UI.

export const DIET_ORDER: DietType[] = ['veg', 'nonveg', 'egg'];

export function dietLabel(diet: DietType): string {
  return { veg: 'Vegetarian', nonveg: 'Non-vegetarian', egg: 'Eggetarian' }[diet];
}

// One-line clarification for screens with room for helper text under the
// chips (Eggetarian isn't self-explanatory the way Veg/Non-veg are).
export function dietHelperText(): string {
  return 'Eggetarian = vegetarian + egg, no meat or fish.';
}
