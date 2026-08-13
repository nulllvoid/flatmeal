import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/contexts/active-group';
import { useTheme } from '@/hooks/use-theme';
import { setMealTypes } from '@/lib/groups-stub';
import { MEAL_ORDER, mealLabel } from '@/lib/meal-copy';
import { supabase } from '@/lib/supabase';
import type { MealType } from '@/types/domain';

// Creates a group: one cook, its own cart, covering one or more meals
// (design doc). A group is a flats row under the hood — the meal(s) live in
// the groups stub until a flats.meal_type column exists. Also reached from
// Settings' "Create group" button.
export default function CreateGroupScreen() {
  const router = useRouter();
  const { reloadGroups, setActiveGroupId } = useActiveGroup();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [meals, setMeals] = useState<MealType[]>(['dinner']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMeal(meal: MealType) {
    setMeals((current) =>
      current.includes(meal) ? current.filter((m) => m !== meal) : [...current, meal]
    );
  }

  async function createGroup() {
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setLoading(false);
      setError('Not signed in');
      return;
    }

    const { data: flat, error: flatError } = await supabase
      .from('flats')
      .insert({ name, created_by: userId })
      .select('id')
      .single();

    if (flatError || !flat) {
      setLoading(false);
      setError(flatError?.message ?? 'Could not create group');
      return;
    }

    const { error: memberError } = await supabase
      .from('flat_members')
      .insert({ flat_id: flat.id, user_id: userId, role: 'admin' });

    if (memberError) {
      setLoading(false);
      setError(memberError.message);
      return;
    }

    await setMealTypes(flat.id, meals);
    await reloadGroups();
    setActiveGroupId(flat.id);
    setLoading(false);
    router.push({ pathname: '/onboarding/cook', params: { groupId: flat.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Your household
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          create your group
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          One group, one cook, one cart per day — covering whichever meals you pick below. Add more
          groups later from Settings.
        </ThemedText>

        <TextInput
          placeholder={'Group name (e.g. "2BHK dinner")'}
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Which meals is this group for?
        </ThemedText>
        <ThemedView style={styles.segRow}>
          {MEAL_ORDER.map((option) => {
            const selected = meals.includes(option);
            return (
              <Pressable
                key={option}
                onPress={() => toggleMeal(option)}
                style={[
                  styles.segOption,
                  { borderColor: theme.divider },
                  selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                <ThemedText type="smallBold" style={selected ? { color: theme.background } : undefined}>
                  {mealLabel(option)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent },
            (loading || !name || meals.length === 0) && styles.disabled,
          ]}
          onPress={() => void createGroup()}
          disabled={loading || !name || meals.length === 0}>
          <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
            {loading ? 'Creating…' : 'Create group'}
          </ThemedText>
        </Pressable>

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heading: {
    fontSize: 34,
    lineHeight: 38,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
    fontFamily: Fonts.body,
  },
  segRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
  },
});
