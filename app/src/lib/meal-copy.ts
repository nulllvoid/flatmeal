import type { MealType } from '@/types/domain';

// Every user-visible meal word lives here — screens must not hardcode
// "dinner"/"tonight" (docs/superpowers/specs/2026-08-11-groups-refactor-design.md).

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

export function mealNoun(meal: MealType): string {
  return meal;
}

export function mealLabel(meal: MealType): string {
  return { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }[meal];
}

export function mealTitle(meal: MealType): string {
  return { breakfast: 'Breakfast today', lunch: 'Lunch today', dinner: 'Dinner tonight' }[meal];
}

export function mealMoment(meal: MealType): string {
  return meal === 'dinner' ? 'tonight' : 'today';
}

export function mealShareHeading(meal: MealType): string {
  return { breakfast: '🛒 Breakfast:', lunch: '🛒 Lunch:', dinner: '🛒 Tonight:' }[meal];
}
