import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// S0 step 2 (create branch only). Dietary profile, cook details, and poll
// timing prompts (per docs/03-mvp-spec.md S0) are deferred — this screen's
// job for now is just "one authenticated user ends up in a flat with a
// membership row," which is the minimum needed for the rest of the app.
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

    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Create your flat</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You can invite flatmates and set up your cook afterwards, from Settings.
        </ThemedText>

        <TextInput
          placeholder="Flat name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Pressable style={styles.primaryButton} onPress={createFlat} disabled={loading || !name}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            {loading ? 'Creating…' : 'Create flat'}
          </ThemedText>
        </Pressable>

        {error && (
          <ThemedText type="small" style={styles.errorText}>
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
    borderWidth: 1,
    borderColor: '#00000030',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  errorText: {
    color: '#e5484d',
  },
});
