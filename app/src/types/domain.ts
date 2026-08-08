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
export type AccompanimentWinnerReason = WinnerReason | 'none_available'; // 'none_available' = winning dish has no curated accompaniment (e.g. Vegetable Pulao IS the starch)
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

export interface AccompanimentOptionView {
  recipeId: string;
  name: string;
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
  // Accompaniment (roti/rice/etc) — a second, independent vote whose
  // options aren't known until the main dish wins (see close_poll). Empty
  // options with winnerAccompanimentReason='none_available' is a valid,
  // non-error state (the winning dish IS the starch, e.g. Vegetable Pulao).
  accompanimentOptions: AccompanimentOptionView[];
  winnerAccompanimentRecipeId: string | null;
  winnerAccompanimentReason: AccompanimentWinnerReason | null;
  // Derived: true only while there's an undecided accompaniment vote to show.
  accompanimentVotingOpen: boolean;
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
