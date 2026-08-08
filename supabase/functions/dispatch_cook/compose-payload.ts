import { scaleIngredientLabel } from './scale-ingredient.ts';

export interface RecipeIngredientRow {
  name_en: string;
  name_hi: string | null;
  name_kn: string | null;
  qty_per_person: number;
  unit: string;
  is_staple: boolean;
  sort_order: number;
}

// English payload per docs/06-whatsapp-integration.md "Composition pipeline"
// step 1: dish, headcount, scaled ingredients, flat note. Staples are called
// out separately ("check you have") rather than listed as buy items, same
// convention as the grocery-list screen (CLAUDE.md). `ingredients` is
// expected to already include the accompaniment's ingredients merged in by
// the caller (dispatch_cook/index.ts) — this function itself doesn't know
// which rows belong to which dish.
export function composeEnglishPayload(params: {
  dishName: string;
  headcount: number;
  ingredients: RecipeIngredientRow[];
  instructions: string;
  flatNote: string | null;
  accompanimentName?: string | null;
  accompanimentInstructions?: string | null;
}): string {
  const { dishName, headcount, ingredients, instructions, flatNote, accompanimentName, accompanimentInstructions } =
    params;

  const sorted = [...ingredients].sort((a, b) => a.sort_order - b.sort_order);
  const buyList = sorted.filter((i) => !i.is_staple);
  const staples = sorted.filter((i) => i.is_staple);

  const ingredientLines = buyList
    .map((i) => `${i.name_en} — ${scaleIngredientLabel(i.qty_per_person, i.unit, headcount)}`)
    .join(', ');
  const stapleLine = staples.length > 0 ? ` Check you have: ${staples.map((i) => i.name_en).join(', ')}.` : '';

  const dishLine = accompanimentName ? `${dishName} with ${accompanimentName}` : dishName;
  const methodSection =
    accompanimentInstructions && accompanimentName
      ? `Method:\n${instructions}\n\nFor the ${accompanimentName}:\n${accompanimentInstructions}`
      : `Method:\n${instructions}`;

  return [
    `Today's meal: ${dishLine}`,
    `Please cook for ${headcount} people.`,
    '',
    `Ingredients: ${ingredientLines}.${stapleLine}`,
    '',
    methodSection,
    '',
    `Note: ${flatNote && flatNote.trim() ? flatNote.trim() : '—'}`,
  ].join('\n');
}

// Ingredient line only, for the {{4}} template variable — translated
// separately from the free-text instructions body.
export function composeIngredientLine(ingredients: RecipeIngredientRow[], headcount: number, lang: 'hi' | 'kn' | 'en'): string {
  const sorted = [...ingredients].filter((i) => !i.is_staple).sort((a, b) => a.sort_order - b.sort_order);
  return sorted
    .map((i) => {
      const name = lang === 'hi' ? (i.name_hi ?? i.name_en) : lang === 'kn' ? (i.name_kn ?? i.name_en) : i.name_en;
      return `${name} — ${scaleIngredientLabel(i.qty_per_person, i.unit, headcount)}`;
    })
    .join(', ');
}
