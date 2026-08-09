import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// S0 step 2 (create branch only): "one authenticated user ends up in a flat
// with a membership row." Continues into onboarding/diet.tsx and
// onboarding/cook.tsx for the dietary profile and cook prompts.
// TODO: onboarding/join-flat.tsx (deep-link + invite_code lookup) is not
// built yet — creating is the only path in right now.
export default function CreateFlatScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createFlat() {
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
      setError(flatError?.message ?? 'Could not create flat');
      return;
    }

    const { error: memberError } = await supabase
      .from('flat_members')
      .insert({ flat_id: flat.id, user_id: userId, role: 'admin' });

    setLoading(false);
    if (memberError) {
      setError(memberError.message);
      return;
    }

    router.replace('/onboarding/diet');
  }

  const theme = useTheme();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Create your flat</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You can invite flatmates and set up your cook afterwards, from Settings.
        </ThemedText>

        <TextInput
          placeholder="Flat name"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }, (loading || !name) && styles.disabled]}
          onPress={createFlat}
          disabled={loading || !name}>
          <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
            {loading ? 'Creating…' : 'Create flat'}
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
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
    fontFamily: Fonts.body,
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
