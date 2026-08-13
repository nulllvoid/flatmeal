import type { MealType } from '@/types/domain';

// Every user-visible meal word lives here — screens must not hardcode
// "dinner"/"tonight" (docs/superpowers/specs/2026-08-11-groups-refactor-design.md).
//
// A group can cover more than one meal (types/domain.ts's MealType comment)
// — the *List variants below join multiple meals into one phrase, in
// MEAL_ORDER regardless of selection order. Screens that show one group at a
// time should prefer these over the single-meal versions.

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

function sortedByMealOrder(meals: MealType[]): MealType[] {
  return [...meals].sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b));
}

// "Breakfast", "Breakfast & Dinner", "Breakfast, Lunch & Dinner".
function joinWithAmpersand(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} & ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} & ${words[words.length - 1]}`;
}

export function mealNoun(meal: MealType): string {
  return meal;
}

// Lowercase, sentence-embeddable: "skip breakfast & dinner altogether".
export function mealNounList(meals: MealType[]): string {
  return joinWithAmpersand(sortedByMealOrder(meals).map(mealNoun));
}

export function mealLabel(meal: MealType): string {
  return { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }[meal];
}

export function mealLabelList(meals: MealType[]): string {
  return joinWithAmpersand(sortedByMealOrder(meals).map(mealLabel));
}

export function mealTitle(meal: MealType): string {
  return { breakfast: 'Breakfast today', lunch: 'Lunch today', dinner: 'Dinner tonight' }[meal];
}

// A single meal keeps its natural phrasing ("Dinner tonight"); more than one
// can't honestly say "tonight" if breakfast is also in the mix, so it falls
// back to a neutral "today" header instead.
export function mealTitleList(meals: MealType[]): string {
  if (meals.length === 1) return mealTitle(meals[0]);
  return `${mealLabelList(meals)} today`;
}

export function mealMoment(meal: MealType): string {
  return meal === 'dinner' ? 'tonight' : 'today';
}

export function mealMomentList(meals: MealType[]): string {
  return meals.length === 1 ? mealMoment(meals[0]) : 'today';
}

export function mealShareHeading(meal: MealType): string {
  return { breakfast: '🛒 Breakfast:', lunch: '🛒 Lunch:', dinner: '🛒 Tonight:' }[meal];
}

export function mealShareHeadingList(meals: MealType[]): string {
  return meals.length === 1 ? mealShareHeading(meals[0]) : `🛒 ${mealLabelList(meals)}:`;
}
