// View-model types for screens — shaped from joined Supabase query results,
// not 1:1 with raw table rows (see src/types/database.ts for those).
//
// The literal unions below mirror the CHECK constraints in
// docs/05-schema.sql. Postgres CHECK constraints aren't introspectable by
// `supabase gen types`, so the generated Database type widens these columns
// to plain `string` — these are hand-kept in sync with the schema instead.

export type DietType = 'veg' | 'egg' | 'nonveg';
export type Allergen = 'peanut' | 'dairy' | 'gluten' | 'shellfish' | 'soy';
export type PollStatus = 'open' | 'closed' | 'cancelled' | 'dispatched';
export type WinnerReason = 'votes' | 'tiebreak_lru' | 'auto_no_votes';
export type IngredientUnit = 'piece' | 'g' | 'ml' | 'bunch' | 'packet' | 'cup' | 'tbsp' | 'tsp';
export type IngredientCategory = 'vegetable' | 'dairy' | 'staple' | 'protein' | 'other';

export interface PollOptionView {
  recipeId: string;
  name: string;
  cuisine: string;
  dietClass: DietType;
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
  winnerReason: WinnerReason | null;
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
  dietType: DietType;
  isJain: boolean;
  allergies: Allergen[];
}
