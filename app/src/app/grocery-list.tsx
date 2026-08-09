import { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useGroceryList } from '@/hooks/use-grocery-list';
import { useMyFlat } from '@/hooks/use-my-flat';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import type { GroceryLineView } from '@/types/domain';

const CATEGORY_ORDER = ['vegetable', 'dairy', 'protein', 'other'] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  vegetable: 'Vegetables',
  dairy: 'Dairy',
  protein: 'Protein',
  other: 'Other',
};

export default function GroceryListScreen() {
  const session = useSession();
  const flatId = useMyFlat(session);
  const { data, toggleChecked } = useGroceryList(flatId);
  const theme = useTheme();

  const buyList = useMemo(() => data?.lines.filter((l) => !l.isStaple) ?? [], [data]);
  const staples = useMemo(() => data?.lines.filter((l) => l.isStaple) ?? [], [data]);
  const uncheckedCount = buyList.filter((l) => !l.checked).length;

  const shareText = useMemo(() => {
    if (!data) return '';
    const toBuy = buyList
      .filter((l) => !l.checked)
      .map((l) => `- ${l.nameEn} — ${l.quantityLabel} (for ${l.dishName})`)
      .join('\n');
    const stapleNames = staples.map((s) => s.nameEn).join(', ');
    return `🛒 Tonight: ${data.dishSummary}\nTo buy:\n${toBuy}\nCheck at home: ${stapleNames}`;
  }, [data, buyList, staples]);

  async function handleShare() {
    await Share.share({ message: shareText });
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: buyList.filter((l: GroceryLineView) => l.category === category),
  })).filter((g) => g.items.length > 0);

  if (data === undefined) {
    return null; // loading
  }

  if (data === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">No grocery list yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This shows up once something&apos;s in tonight&apos;s cart.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="subtitle">{data.dishSummary}</ThemedText>

        {grouped.map(({ category, items }) => (
          <ThemedView key={category} style={styles.categorySection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {CATEGORY_LABEL[category]}
            </ThemedText>
            {items.map((item) => (
              <Pressable
                key={item.ingredientId}
                onPress={() => toggleChecked(item.ingredientId, !item.checked)}
                style={styles.itemRow}>
                <ThemedView
                  style={[
                    styles.checkbox,
                    { borderColor: theme.accent },
                    item.checked && { backgroundColor: theme.accent },
                  ]}
                />
                <ThemedView style={styles.itemTextCol}>
                  <ThemedText type="default" style={item.checked && styles.itemTextChecked}>
                    {item.nameEn}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantityLabel} — for {item.dishName}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        ))}

        {staples.length > 0 && (
          <ThemedView type="backgroundElement" style={styles.stapleLine}>
            <ThemedText type="small">
              Check you have: {staples.map((s) => s.nameEn).join(', ')}
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>

      <ThemedView type="backgroundElement" style={[styles.footer, { borderTopColor: theme.divider }]}>
        <ThemedText type="small">{uncheckedCount} to buy</ThemedText>
        <ThemedView style={styles.footerActions}>
          <Pressable style={styles.footerButton} onPress={handleShare}>
            <ThemedText type="smallBold" style={styles.footerButtonText}>
              Share to WhatsApp
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  categorySection: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  stapleLine: {
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footerButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: '#25D366',
  },
  footerButtonText: {
    fontFamily: Fonts.bodyBold,
    color: '#ffffff',
  },
});
