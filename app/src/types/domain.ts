import type { Allergen, IngredientCategory, IngredientUnit, PollStatus } from '@/types/database';

// View-model types for screens — shaped from joined Supabase query results,
// not 1:1 with raw table rows (see src/types/database.ts for those).

export interface PollOptionView {
  recipeId: string;
  name: string;
  cuisine: string;
  dietClass: 'veg' | 'egg' | 'nonveg';
  voteCount: number;
  votedByMe: boolean;
  voterDisplayNames: string[];
}

export interface TodayPollView {
  pollId: string;
  pollDate: string;
  status: PollStatus;
  options: PollOptionView[];
  headcount: number;
  isOutToday: boolean;
  winnerRecipeId: string | null;
  winnerReason: 'votes' | 'tiebreak_lru' | 'auto_no_votes' | null;
}

export interface GroceryLineView {
  ingredientId: string;
  nameEn: string;
  nameHi: string | null;
  nameKn: string | null;
  quantityLabel: string; // pre-scaled + rounded, e.g. "2 medium onions"
  category: IngredientCategory;
  unit: IngredientUnit;
  isStaple: boolean;
  checked: boolean;
}

export interface DietaryProfileInput {
  dietType: 'veg' | 'egg' | 'nonveg';
  isJain: boolean;
  allergies: Allergen[];
}
