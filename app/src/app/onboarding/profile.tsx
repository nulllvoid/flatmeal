import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { DIET_ORDER, dietHelperText, dietLabel } from '@/lib/diet-copy';
import type { Tables, TablesUpdate } from '@/types/database';
import type { Allergen } from '@/types/domain';

const ALLERGY_OPTIONS: Allergen[] = ['peanut', 'dairy', 'gluten', 'shellfish', 'soy'];

// Onboarding "about you": display name + dietary profile, before any
// household setup exists (design doc: user onboarding is separate from
// create/join). Writes the same profiles columns Settings edits.
export default function OnboardingProfileScreen() {
  const session = useSession();
  const { profile, updateProfile } = useProfile(session?.user.id);

  return (
    <ProfileForm
      key={profile?.id ?? 'loading'}
      profile={profile ?? null}
      updateProfile={updateProfile}
    />
  );
}

// Mounted with key={profile.id} so the name field initializes from the
// loaded profile once (useState initializer), same pattern as Settings'
// CookSection.
function ProfileForm({
  profile,
  updateProfile,
}: {
  profile: Tables<'profiles'> | null;
  updateProfile: (patch: TablesUpdate<'profiles'>) => Promise<{ error: unknown } | undefined>;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [name, setName] = useState(profile?.display_name ?? '');

  function toggleAllergy(allergy: Allergen) {
    if (!profile) return;
    const has = profile.allergies.includes(allergy);
    const next = has ? profile.allergies.filter((a) => a !== allergy) : [...profile.allergies, allergy];
    void updateProfile({ allergies: next });
  }

  async function next() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== profile?.display_name) {
      await updateProfile({ display_name: trimmed });
    }
    router.push('/onboarding/choose');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          About you
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          what do you eat?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          This filters whatever lands in the cart, so be honest, not dramatic.
        </ThemedText>

        <TextInput
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedView style={styles.segRow}>
          {DIET_ORDER.map((value) => {
            const selected = profile?.diet_type === value;
            return (
              <Pressable
                key={value}
                onPress={() => void updateProfile({ diet_type: value })}
                style={[
                  styles.segOption,
                  { borderColor: theme.divider },
                  selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                <ThemedText type="smallBold" style={selected ? { color: theme.background } : undefined}>
                  {dietLabel(value)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          {dietHelperText()}
        </ThemedText>

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

        <Pressable style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={() => void next()}>
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
