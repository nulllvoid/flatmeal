import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Household setup entry point, after user onboarding is done: create a new
// group or join an existing one (design doc: "On user onboarding completion,
// the user gets the option to create/join").
export default function OnboardingChooseScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
          Your household
        </ThemedText>
        <ThemedText type="title" style={styles.heading}>
          set up your group
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          One group = one meal, one cook. A household can run several — breakfast and dinner can be
          different groups.
        </ThemedText>

        <Pressable
          onPress={() => router.push('/onboarding/create-group')}
          style={({ pressed }) => [
            styles.choiceCard,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="default" style={styles.choiceTitle}>
            Create a group
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You pick the meal and set up the cook.
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => router.push('/onboarding/join-group')}
          style={({ pressed }) => [
            styles.choiceCard,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="default" style={styles.choiceTitle}>
            Join with a code
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Someone in your household sent you an invite code.
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
  choiceCard: {
    padding: Spacing.four,
    borderRadius: Radius.md,
    gap: Spacing.half,
  },
  choiceTitle: {
    fontFamily: Fonts.bodyBold,
  },
  pressed: {
    opacity: 0.7,
  },
});
