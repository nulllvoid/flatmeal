import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MealType } from '@/types/domain';

// Client-side stand-ins for backend that doesn't exist yet. Everything in
// this file is a stub by design — see the "Stub layer" section of
// docs/superpowers/specs/2026-08-11-groups-refactor-design.md.

const mealKey = (groupId: string) => `flatmeal.group-meal.${groupId}`;

// TODO(backend): replace with a real flats.meal_type column + migration.
export async function getMealType(groupId: string): Promise<MealType> {
  const stored = await AsyncStorage.getItem(mealKey(groupId));
  return stored === 'breakfast' || stored === 'lunch' || stored === 'dinner' ? stored : 'dinner';
}

export async function setMealType(groupId: string, meal: MealType): Promise<void> {
  await AsyncStorage.setItem(mealKey(groupId), meal);
}

// TODO(backend): real join needs a security-definer RPC or Edge Function —
// RLS blocks non-members from reading flats by invite_code. Until then this
// always fails honestly rather than faking a membership.
export async function joinGroupByCode(_code: string): Promise<{ ok: false; reason: 'not-wired' }> {
  return { ok: false, reason: 'not-wired' };
}
