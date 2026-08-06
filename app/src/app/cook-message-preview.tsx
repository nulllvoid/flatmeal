import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO: replace with dispatch_log row for today's poll (payload_en,
// payload_translated, status) fetched/subscribed via Supabase.
const MOCK_COOK_NAME = 'Lakshmi';
const MOCK_COOK_PHONE = '+919900000000';
const MOCK_STATUS: 'queued' | 'sent' | 'delivered' | 'failed' = 'queued';
const MOCK_EN = `Hello ${MOCK_COOK_NAME}\nToday's meal: Palak Paneer\nPlease cook for 3 people.\n\nIngredients: Spinach 2 bunches, Paneer 200g, Onion 2, Tomato 2\n\nMethod:\nWash and blanch the spinach...\n\nNote: —`;
const MOCK_HI = `नमस्ते ${MOCK_COOK_NAME} 🙏\nआज का खाना: पालक पनीर\n3 लोगों के लिए बनाना है।\n\nसामग्री: पालक 2 गुच्छे, पनीर 200 ग्राम, प्याज़ 2, टमाटर 2\n\nबनाने का तरीका:\nपालक को धोकर 2 मिनट उबालें...\n\nनोट: —`;

export default function CookMessagePreviewScreen() {
  const [showEnglish, setShowEnglish] = useState(false);

  const isPreDispatch = MOCK_STATUS === 'queued';
  const failed = MOCK_STATUS === 'failed';

  function openWhatsAppFallback() {
    const text = encodeURIComponent(MOCK_HI);
    Linking.openURL(`https://wa.me/${MOCK_COOK_PHONE.replace('+', '')}?text=${text}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {isPreDispatch ? 'Will be sent at dispatch time' : `Status: ${MOCK_STATUS}`}
          </ThemedText>
          <Pressable onPress={() => setShowEnglish((v) => !v)}>
            <ThemedText type="linkPrimary">{showEnglish ? 'Show translated' : 'Show English'}</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.messageBox}>
          <ThemedText type="default">{showEnglish ? MOCK_EN : MOCK_HI}</ThemedText>
        </ThemedView>

        {isPreDispatch && (
          <Pressable style={styles.secondaryButton}>
            <ThemedText type="smallBold">Edit flat note</ThemedText>
          </Pressable>
        )}

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
    borderRadius: Spacing.three,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#3c87f7',
  },
  whatsAppButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#25D366',
    alignItems: 'center',
  },
  whatsAppButtonText: {
    color: '#ffffff',
  },
});
