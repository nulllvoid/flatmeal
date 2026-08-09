import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useFlatSettings } from '@/hooks/use-flat-settings';
import { useMyFlat } from '@/hooks/use-my-flat';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_MAX_MAINS = 4;
const DEFAULT_MAX_ACCOMPANIMENTS = 2;

// Onboarding step 2 of 3 (mockup: "how much is too much?"), skippable —
// writes flats.max_mains/max_accompaniments, the soft warn-not-block cart
// caps (docs/05-schema.sql). Null (skipped) means no limit is enforced
// anywhere in the cart-add flow.
export default function OnboardingLimitsScreen() {
  const router = useRouter();
  const session = useSession();
  const flatId = useMyFlat(session);
  const { updateFlat } = useFlatSettings(flatId);
  const theme = useTheme();

  const [maxMains, setMaxMains] = useState(DEFAULT_MAX_MAINS);
  const [maxAccompaniments, setMaxAccompaniments] = useState(DEFAULT_MAX_ACCOMPANIMENTS);

  function skip() {
    router.push('/onboarding/cook');
  }

  async function setLimits() {
    await updateFlat({ max_mains: maxMains, max_accompaniments: maxAccompaniments });
    router.push('/onboarding/cook');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
            Step 2 of 3 · optional
          </ThemedText>
          <Pressable onPress={skip}>
            <ThemedText type="smallBold">Skip</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="title" style={styles.heading}>
          how much is too much?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Soft limits. We&apos;ll warn when the cart goes past them, never stop you.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <Stepper
            label="Main courses per meal"
            value={maxMains}
            onChange={(v) => setMaxMains(Math.max(1, v))}
            accentColor={theme.accent}
          />
          <ThemedView style={[styles.hint, { borderColor: theme.divider }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Defaults to <ThemedText type="smallBold">{DEFAULT_MAX_MAINS}</ThemedText> — one per flatmate. Change
              it if your kitchen is more realistic than that.
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <Stepper
            label="Accompaniments & sides"
            value={maxAccompaniments}
            onChange={(v) => setMaxAccompaniments(Math.max(1, v))}
            accentColor={theme.accent}
          />
        </ThemedView>

        <ThemedView style={[styles.hint, { borderColor: theme.divider }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Quantities always start at the headcount — and follow it when someone drops out.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.footerRow}>
          <Pressable style={[styles.secondaryButton, { borderColor: theme.divider }]} onPress={skip}>
            <ThemedText type="smallBold">Skip this</ThemedText>
          </Pressable>
          <Pressable style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={setLimits}>
            <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
              Set the limits
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

function Stepper({
  label,
  value,
  onChange,
  accentColor,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
}) {
  return (
    <ThemedView style={styles.stepperRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
        {label}
      </ThemedText>
      <ThemedView style={styles.stepper}>
        <Pressable style={[styles.stepperButton, { backgroundColor: accentColor }]} onPress={() => onChange(value - 1)}>
          <ThemedText type="smallBold" style={styles.stepperButtonText}>
            −
          </ThemedText>
        </Pressable>
        <ThemedText type="default" style={styles.stepperValue}>
          {value}
        </ThemedText>
        <Pressable style={[styles.stepperButton, { backgroundColor: accentColor }]} onPress={() => onChange(value + 1)}>
          <ThemedText type="smallBold" style={styles.stepperButtonText}>
            +
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heading: {
    fontSize: 34,
    lineHeight: 38,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    gap: Spacing.two,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: '#ffffff',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  hint: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  footerRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 2,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
  },
});
