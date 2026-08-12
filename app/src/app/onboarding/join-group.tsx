import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { joinGroupByCode } from '@/lib/groups-stub';

// Join an existing group by invite code. The lookup is a stub — see
// groups-stub.ts: real joining needs a security-definer RPC or Edge
// Function, so this screen fails honestly instead of faking a membership.
export default function JoinGroupScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notWired, setNotWired] = useState(false);

  async function join() {
    setNotWired(false);
    setLoading(true);
    const result = await joinGroupByCode(code.trim());
    setLoading(false);
    if (!result.ok) {
      setNotWired(true);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Your household
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          join a group
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Paste the invite code a group member sent you.
        </ThemedText>

        <TextInput
          placeholder="Invite code"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }, (loading || !code.trim()) && styles.disabled]}
          onPress={() => void join()}
          disabled={loading || !code.trim()}>
          <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
            {loading ? 'Joining…' : 'Join'}
          </ThemedText>
        </Pressable>

        {notWired && (
          <>
            <ThemedView style={[styles.hint, { borderColor: theme.divider }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Joining isn&apos;t wired up in this build yet — ask whoever invited you to add you from
                their side, or create your own group for now.
              </ThemedText>
            </ThemedView>
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.divider }]}
              onPress={() => router.replace('/onboarding/create-group')}>
              <ThemedText type="smallBold">Create a group instead</ThemedText>
            </Pressable>
          </>
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
  hint: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
  },
});
