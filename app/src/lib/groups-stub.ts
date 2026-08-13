import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MealType } from '@/types/domain';

// Client-side stand-ins for backend that doesn't exist yet. Everything in
// this file is a stub by design — see the "Stub layer" section of
// docs/superpowers/specs/2026-08-11-groups-refactor-design.md.

const mealKey = (groupId: string) => `flatmeal.group-meal.${groupId}`;

function isMealType(value: unknown): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

// TODO(backend): replace with a real flats.meal_type column + migration.
// Stored as a JSON array of MealType (a group can cover more than one meal —
// this is display copy only, see types/domain.ts's MealType comment). Reads
// also accept the pre-multi-select plain-string format written by earlier
// builds, so existing installs don't lose their selection on upgrade.
export async function getMealTypes(groupId: string): Promise<MealType[]> {
  const stored = await AsyncStorage.getItem(mealKey(groupId));
  if (!stored) return ['dinner'];

  if (isMealType(stored)) return [stored]; // pre-multi-select format

  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const meals = parsed.filter(isMealType);
      if (meals.length > 0) return meals;
    }
  } catch {
    // fall through to default below
  }
  return ['dinner'];
}

export async function setMealTypes(groupId: string, meals: MealType[]): Promise<void> {
  await AsyncStorage.setItem(mealKey(groupId), JSON.stringify(meals));
}

// TODO(backend): real join needs a security-definer RPC or Edge Function —
// RLS blocks non-members from reading flats by invite_code. Until then this
// always fails honestly rather than faking a membership.
export async function joinGroupByCode(_code: string): Promise<{ ok: false; reason: 'not-wired' }> {
  return { ok: false, reason: 'not-wired' };
}
