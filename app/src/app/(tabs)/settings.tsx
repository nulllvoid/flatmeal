import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO: load from `profiles` (mine), `flats` + `flat_members` (my flat),
// and `cooks` (active cook for my flat) via Supabase.
export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="subtitle">Settings</ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">My dietary profile</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Diet type, Jain toggle, and allergies — editable here.
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Flat</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Members, invite link, and poll timings (default 09:00 / 11:00 / 16:00 IST).
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Cook</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Name, phone (E.164), and language. Changes take effect at the next dispatch.
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Send feedback</ThemedText>
          <TextInput
            placeholder="Tell us what's not working…"
            multiline
            style={styles.feedbackInput}
            // TODO: insert into `feedback` (user_id, flat_id, body) on submit
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={[styles.section, styles.dangerSection]}>
          <ThemedText type="smallBold" themeColor="text">
            Leave flat
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
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
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  dangerSection: {
    borderWidth: 1,
    borderColor: '#e5484d',
  },
  feedbackInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
});
