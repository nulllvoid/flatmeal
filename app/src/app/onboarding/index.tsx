import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/contexts/active-group';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Onboarding step 1, email magic-link variant (docs/02-prd.md §F1 "or magic
// link fallback"). Phone OTP is blocked on India DLT/SMS-provider setup.
// Continues into onboarding/profile.tsx (about you), then
// onboarding/choose.tsx (create or join a group).
export default function OnboardingEmailScreen() {
  const router = useRouter();
  const session = useSession();
  const { groups } = useActiveGroup();
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureProfileThenContinue = useCallback(
    async (userId: string, emailAddr: string) => {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from('profiles').insert({ id: userId, display_name: emailAddr || 'New member' });
      }

      router.replace('/onboarding/profile');
    },
    [router]
  );

  // On web, clicking the magic link redirects back to this same page with
  // the session already established (detectSessionInUrl) — pick that up
  // and continue into profile creation once it lands. But a returning user
  // who lands here directly (stale bookmark, back-navigation, deep link)
  // with a session AND at least one group already shouldn't be routed
  // through onboarding at all — send them straight to the app, same as the
  // root `/` redirect already does.
  useEffect(() => {
    if (!session || groups === undefined) return;
    if (groups.length > 0) {
      router.replace('/(tabs)');
      return;
    }
    void Promise.resolve().then(() => ensureProfileThenContinue(session.user.id, session.user.email ?? ''));
  }, [session, groups, ensureProfileThenContinue, router]);

  async function sendMagicLink() {
    setError(null);
    setLoading(true);
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    setLoading(false);
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setLinkSent(true);
  }

  const theme = useTheme();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">FlatMeal</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Build the next meal in 5 seconds. Your cook gets clear instructions, automatically.
        </ThemedText>

        {!linkSent ? (
          <>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.accent }, (loading || !email) && styles.disabled]}
              onPress={sendMagicLink}
              disabled={loading || !email}>
              <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
                {loading ? 'Sending…' : 'Send magic link'}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="default" themeColor="textSecondary">
            Check {email} for a sign-in link, then open it in this browser.
          </ThemedText>
        )}

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
