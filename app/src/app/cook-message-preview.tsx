import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/contexts/active-group';
import { useCookDispatch } from '@/hooks/use-cook-dispatch';
import { mealNoun } from '@/lib/meal-copy';

export default function CookMessagePreviewScreen() {
  const { activeGroup } = useActiveGroup();
  const flatId = activeGroup?.id;
  const meal = activeGroup?.meal ?? 'dinner';
  const { dispatch } = useCookDispatch(flatId);
  const [showEnglish, setShowEnglish] = useState(false);

  if (dispatch === undefined) {
    return null; // loading
  }

  if (dispatch === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">No cook message yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This shows up once the {mealNoun(meal)} cart locks and a cook is set in Settings.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const isPreDispatch = dispatch.status === 'queued';
  const failed = dispatch.status === 'failed';
  const body = showEnglish ? dispatch.payloadEn : dispatch.payloadTranslated;

  function openWhatsAppFallback() {
    if (!dispatch) return;
    const text = encodeURIComponent(dispatch.payloadTranslated || dispatch.payloadEn);
    Linking.openURL(`https://wa.me/${dispatch.cookPhone.replace('+', '')}?text=${text}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {isPreDispatch ? 'Will be sent at dispatch time' : `Status: ${dispatch.status}`}
          </ThemedText>
          {!isPreDispatch && (
            <Pressable onPress={() => setShowEnglish((v) => !v)}>
              <ThemedText type="linkPrimary">{showEnglish ? 'Show translated' : 'Show English'}</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.messageBox}>
          <ThemedText type="default">
            {isPreDispatch ? `Cook: ${dispatch.cookName}\nMessage composes at dispatch time.` : body}
          </ThemedText>
        </ThemedView>

        {failed && (
          <Pressable style={styles.whatsAppButton} onPress={openWhatsAppFallback}>
            <ThemedText type="smallBold" style={styles.whatsAppButtonText}>
              Send it yourself on WhatsApp
            </ThemedText>
          </Pressable>
        )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageBox: {
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  whatsAppButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: '#25D366',
    alignItems: 'center',
  },
  whatsAppButtonText: {
    fontFamily: Fonts.bodyBold,
    color: '#ffffff',
  },
});
