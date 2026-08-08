// Poll option selection (docs/02-prd.md §F2, docs/03-mvp-spec.md "Daily
// pipeline" step 1):
//   1. Hard filter: union of flat members' diet_type/is_jain/allergies acts
//      as an unoverrideable veto against recipes.diet_class/jain_ok/allergens.
//   2. Exclude any recipe served to this flat in the last 10 days, derived
//      from daily_polls.winner_recipe_id where status='dispatched'
//      (docs/04-architecture.md "meal history ... no separate table needed").
//   3. Variety heuristic: not all 3 options share the same cuisine, and not
//      all 3 share the same base.
//   4. Deterministic: shuffled with a (flat_id, poll_date)-seeded RNG so
//      re-running create_poll for the same flat/day is idempotent even
//      before the daily_polls unique-constraint check runs.

export interface MemberDiet {
  diet_type: string; // 'veg' | 'egg' | 'nonveg'
  is_jain: boolean;
  allergies: string[];
}

export interface RecipeCandidate {
  id: string;
  cuisine: string;
  base: string;
  diet_class: string;
  jain_ok: boolean;
  allergens: string[];
}

const DIET_RANK: Record<string, number> = { veg: 0, egg: 1, nonveg: 2 };

// A recipe is eligible only if every member's constraints are satisfied:
// nonveg members can still eat veg/egg, but a veg member can't be served
// nonveg — so the flat's ceiling is the *most restrictive* member's diet.
export function isRecipeEligible(recipe: RecipeCandidate, members: MemberDiet[]): boolean {
  const flatDietCeiling = Math.min(...members.map((m) => DIET_RANK[m.diet_type] ?? DIET_RANK.nonveg));
  if ((DIET_RANK[recipe.diet_class] ?? DIET_RANK.nonveg) > flatDietCeiling) return false;

  const anyJainMember = members.some((m) => m.is_jain);
  if (anyJainMember && !recipe.jain_ok) return false;

  const unionAllergies = new Set(members.flatMap((m) => m.allergies));
  if (recipe.allergens.some((a) => unionAllergies.has(a))) return false;

  return true;
}

// Mulberry32 — small deterministic PRNG seeded from a string, so selection
// is reproducible for a given (flat_id, poll_date) without a DB-side seed.
// Exported so close_poll's accompaniment selection can reuse it with its own
// seed string, rather than duplicating a PRNG.
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hasVariety(options: RecipeCandidate[]): boolean {
  const allSameCuisine = options.every((o) => o.cuisine === options[0].cuisine);
  const allSameBase = options.every((o) => o.base === options[0].base);
  return !allSameCuisine && !allSameBase;
}

// Returns up to 3 recipe ids, or fewer if the eligible pool after exclusion
// is too small to satisfy the variety heuristic — callers should fall back
// to relaxing the 10-day exclusion first (recently-eaten is better than an
// empty poll) rather than the dietary veto (never relaxed).
export function selectPollOptions(params: {
  flatId: string;
  pollDate: string;
  members: MemberDiet[];
  eligibleRecipes: RecipeCandidate[];
  recentlyServedRecipeIds: Set<string>;
}): string[] {
  const { flatId, pollDate, members, eligibleRecipes, recentlyServedRecipeIds } = params;
  const rng = seededRng(`${flatId}:${pollDate}`);

  const dietFiltered = eligibleRecipes.filter((r) => isRecipeEligible(r, members));
  const notRecentlyServed = dietFiltered.filter((r) => !recentlyServedRecipeIds.has(r.id));

  // Fall back to the full diet-eligible pool if 10-day exclusion leaves too
  // few options — a repeat is better than no poll at all.
  const pool = notRecentlyServed.length >= 3 ? notRecentlyServed : dietFiltered;
  if (pool.length === 0) return [];
  if (pool.length <= 3) return shuffle(pool, rng).map((r) => r.id);

  const shuffled = shuffle(pool, rng);

  // Try consecutive windows of the shuffled pool until one satisfies the
  // variety heuristic; the seeded shuffle keeps this deterministic.
  for (let start = 0; start + 3 <= shuffled.length; start++) {
    const candidate = shuffled.slice(start, start + 3);
    if (hasVariety(candidate)) return candidate.map((r) => r.id);
  }

  // No window satisfies variety (e.g. pool has only one cuisine/base) —
  // variety is a soft heuristic, so just return the first 3.
  return shuffled.slice(0, 3).map((r) => r.id);
}

// Accompaniment (roti/rice/etc) option selection — called by close_poll once
// the main dish winner is known (see docs/05-schema.sql's
// daily_polls.winner_accompaniment_* comment for why this can't happen at
// create_poll time). No 10-day exclusion or cuisine/base variety heuristic
// here — those are main-dish-only concerns; this just seeded-shuffles the
// curated, dietary-filtered candidate set for reproducibility.
export function selectAccompanimentOptions(params: {
  flatId: string;
  pollDate: string;
  validAccompaniments: { recipeId: string; sortOrder: number }[]; // pre-filtered to is_active + dietary-eligible
}): string[] {
  const { flatId, pollDate, validAccompaniments } = params;
  if (validAccompaniments.length === 0) return [];

  // Distinct seed suffix so this shuffle doesn't correlate with the
  // main-dish shuffle for the same (flatId, pollDate).
  const rng = seededRng(`${flatId}:${pollDate}:accompaniment`);
  const sorted = [...validAccompaniments].sort((a, b) => a.sortOrder - b.sortOrder);
  const shuffled = shuffle(sorted, rng);
  return shuffled.slice(0, 3).map((a) => a.recipeId);
}
