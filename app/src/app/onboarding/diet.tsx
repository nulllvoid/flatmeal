import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import type { Allergen, DietType } from '@/types/domain';

const DIET_TYPES: { value: DietType; label: string }[] = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'nonveg', label: 'Non-veg' },
];
const ALLERGY_OPTIONS: Allergen[] = ['peanut', 'dairy', 'gluten', 'shellfish', 'soy'];

// Onboarding step 1 of 3 (mockup: "what will you not eat?"). Writes the same
// profiles columns Settings' dietary section already edits — this just
// front-loads the prompt so a fresh member's diet filters suggestions from
// day one instead of defaulting to 'veg' silently.
export default function OnboardingDietScreen() {
  const router = useRouter();
  const session = useSession();
  const { profile, updateProfile } = useProfile(session?.user.id);
  const theme = useTheme();

  function toggleAllergy(allergy: Allergen) {
    if (!profile) return;
    const has = profile.allergies.includes(allergy);
    const next = has ? profile.allergies.filter((a) => a !== allergy) : [...profile.allergies, allergy];
    updateProfile({ allergies: next });
  }

  function next() {
    router.push('/onboarding/limits');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Step 1 of 3
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          what will you not eat?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          This filters whatever lands in the cart, so be honest, not dramatic.
        </ThemedText>

        <ThemedView style={styles.segRow}>
          {DIET_TYPES.map(({ value, label }) => {
            const selected = profile?.diet_type === value;
            return (
              <Pressable
                key={value}
                onPress={() => updateProfile({ diet_type: value })}
                style={[
                  styles.segOption,
                  { borderColor: theme.divider },
                  selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                <ThemedText type="smallBold" style={selected ? { color: theme.background } : undefined}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.jainRow}>
          <ThemedText type="default">Jain — no onion, no garlic</ThemedText>
          <Switch
            value={profile?.is_jain ?? false}
            onValueChange={(value) => void updateProfile({ is_jain: value })}
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Allergies — these are absolute
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {ALLERGY_OPTIONS.map((allergy) => {
            const selected = profile?.allergies.includes(allergy) ?? false;
            return (
              <Pressable
                key={allergy}
                onPress={() => toggleAllergy(allergy)}
                style={[
                  styles.chip,
                  { borderColor: theme.divider },
                  selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                <ThemedText type="small" style={selected ? { color: theme.background } : undefined}>
                  {allergy}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <Pressable style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={next}>
          <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
            Next
          </ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
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
  jainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  primaryButton: {
    marginTop: 'auto',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
  },
});
