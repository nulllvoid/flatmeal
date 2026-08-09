import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useFlatSettings } from '@/hooks/use-flat-settings';
import { useMyFlat } from '@/hooks/use-my-flat';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

const DIET_TYPES = ['veg', 'egg', 'nonveg'] as const;
const ALLERGY_OPTIONS = ['peanut', 'dairy', 'gluten', 'shellfish', 'soy'] as const;
const COOK_LANGUAGES = [
  { value: 'hi', label: 'Hindi' },
  { value: 'kn', label: 'Kannada' },
  { value: 'en', label: 'English' },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const flatId = useMyFlat(session);
  const { profile, updateProfile } = useProfile(session?.user.id);
  const { data: flatData, upsertCook, leaveFlat } = useFlatSettings(flatId);
  const theme = useTheme();

  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  async function submitFeedback() {
    if (!session?.user.id || !feedback.trim()) return;
    const { error } = await supabase
      .from('feedback')
      .insert({ user_id: session.user.id, flat_id: flatId ?? null, body: feedback.trim() });
    if (!error) {
      setFeedback('');
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    }
  }

  async function handleLeaveFlat() {
    if (!session?.user.id) return;
    await leaveFlat(session.user.id);
    router.replace('/onboarding/create-flat');
  }

  function toggleAllergy(allergy: string) {
    if (!profile) return;
    const has = profile.allergies.includes(allergy);
    const next = has ? profile.allergies.filter((a) => a !== allergy) : [...profile.allergies, allergy];
    updateProfile({ allergies: next });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="subtitle">Settings</ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">My dietary profile</ThemedText>

          <ThemedView style={styles.chipRow}>
            {DIET_TYPES.map((type) => {
              const selected = profile?.diet_type === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => updateProfile({ diet_type: type })}
                  style={[
                    styles.chip,
                    { borderColor: theme.divider },
                    selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}>
                  <ThemedText type="small" style={selected ? { color: theme.background } : undefined}>
                    {type}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.rowBetween}>
            <ThemedText type="default">Jain</ThemedText>
            <Switch
              value={profile?.is_jain ?? false}
              onValueChange={(value) => void updateProfile({ is_jain: value })}
            />
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary">
            Allergies
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

          <ThemedView style={styles.rowBetween}>
            <ThemedText type="default">Mute notifications</ThemedText>
            <Switch
              value={profile?.notifications_muted ?? false}
              onValueChange={(value) => void updateProfile({ notifications_muted: value })}
            />
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Flat</ThemedText>
          {flatData && (
            <>
              <ThemedText type="default">{flatData.flat.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Invite code: {flatData.flat.invite_code}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Poll: {flatData.flat.poll_open_time.slice(0, 5)} open ·{' '}
                {flatData.flat.poll_close_time.slice(0, 5)} close ·{' '}
                {flatData.flat.dispatch_time.slice(0, 5)} dispatch (IST)
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Members: {flatData.members.map((m) => m.displayName).join(', ')}
              </ThemedText>
            </>
          )}
        </ThemedView>

        <CookSection
          key={flatData?.cook?.id ?? 'new'}
          cook={flatData?.cook ?? null}
          onSave={(patch) => upsertCook(patch)}
        />

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Send feedback</ThemedText>
          <TextInput
            placeholder="Tell us what's not working…"
            placeholderTextColor={theme.textSecondary}
            multiline
            value={feedback}
            onChangeText={setFeedback}
            style={[styles.feedbackInput, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.background }]}
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.accent }, !feedback.trim() && styles.disabled]}
            onPress={submitFeedback}
            disabled={!feedback.trim()}>
            <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
              {feedbackSent ? 'Sent — thank you' : 'Submit'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView type="backgroundElement" style={[styles.section, styles.dangerSection, { borderColor: theme.danger }]}>
          <Pressable onPress={handleLeaveFlat}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              Leave flat
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Mounted with `key={cook?.id ?? 'new'}` by the parent so its local state
// initializes from `cook` once (via useState initializers) instead of
// syncing via a useEffect + setState, which the React Compiler lint flags
// as an unnecessary render-triggering side effect.
function CookSection({
  cook,
  onSave,
}: {
  cook: Tables<'cooks'> | null;
  onSave: (patch: { name: string; phone: string; language: string }) => void;
}) {
  const [cookName, setCookName] = useState(cook?.name ?? '');
  const [cookPhone, setCookPhone] = useState(cook?.phone ?? '');
  const [cookLanguage, setCookLanguage] = useState(cook?.language ?? 'hi');
  const theme = useTheme();

  function saveCook() {
    if (!cookName.trim() || !cookPhone.trim()) return;
    onSave({ name: cookName.trim(), phone: cookPhone.trim(), language: cookLanguage });
  }

  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold">Cook</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Changes take effect at the next dispatch.
      </ThemedText>
      <TextInput
        placeholder="Cook name"
        placeholderTextColor={theme.textSecondary}
        value={cookName}
        onChangeText={setCookName}
        style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.background }]}
      />
      <TextInput
        placeholder="Phone (+91XXXXXXXXXX)"
        placeholderTextColor={theme.textSecondary}
        value={cookPhone}
        onChangeText={setCookPhone}
        keyboardType="phone-pad"
        style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.background }]}
      />
      <ThemedView style={styles.chipRow}>
        {COOK_LANGUAGES.map((lang) => {
          const selected = cookLanguage === lang.value;
          return (
            <Pressable
              key={lang.value}
              onPress={() => setCookLanguage(lang.value)}
              style={[
                styles.chip,
                { borderColor: theme.divider },
                selected && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}>
              <ThemedText type="small" style={selected ? { color: theme.background } : undefined}>
                {lang.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.accent }, (!cookName.trim() || !cookPhone.trim()) && styles.disabled]}
        onPress={saveCook}
        disabled={!cookName.trim() || !cookPhone.trim()}>
        <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
          {cook ? 'Update cook' : 'Add cook'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    gap: Spacing.two,
  },
  dangerSection: {
    borderWidth: 1,
  },
  feedbackInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: Fonts.body,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.two,
    fontSize: 16,
    fontFamily: Fonts.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
