import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { GroceryLineView } from '@/types/domain';

const CATEGORY_ORDER = ['vegetable', 'dairy', 'protein', 'other'] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  vegetable: 'Vegetables',
  dairy: 'Dairy',
  protein: 'Protein',
  other: 'Other',
};

// TODO: replace with recipe_ingredients for daily_polls.winner_recipe_id,
// qty_per_person × headcount rounded to buyable units, joined with
// grocery_checks (realtime-synced "we already have this" ticks).
const MOCK_HEADCOUNT = 3;
const MOCK_DISH = 'Palak Paneer';
const MOCK_LINES: GroceryLineView[] = [
  { ingredientId: '1', nameEn: 'Spinach (palak)', nameHi: 'पालक', nameKn: 'ಪಾಲಕ್ ಸೊಪ್ಪು', quantityLabel: '2 bunches', category: 'vegetable', unit: 'bunch', isStaple: false, checked: false },
  { ingredientId: '2', nameEn: 'Paneer', nameHi: 'पनीर', nameKn: 'ಪನೀರ್', quantityLabel: '200 g', category: 'dairy', unit: 'g', isStaple: false, checked: false },
  { ingredientId: '3', nameEn: 'Onion (medium)', nameHi: 'प्याज़', nameKn: 'ಈರುಳ್ಳಿ', quantityLabel: '2 medium', category: 'vegetable', unit: 'piece', isStaple: false, checked: false },
  { ingredientId: '4', nameEn: 'Tomato (medium)', nameHi: 'टमाटर', nameKn: 'ಟೊಮೇಟೊ', quantityLabel: '2 medium', category: 'vegetable', unit: 'piece', isStaple: false, checked: false },
  { ingredientId: '5', nameEn: 'Ginger-garlic paste', nameHi: null, nameKn: null, quantityLabel: 'check you have', category: 'staple', unit: 'tsp', isStaple: true, checked: false },
  { ingredientId: '6', nameEn: 'Cumin (jeera)', nameHi: null, nameKn: null, quantityLabel: 'check you have', category: 'staple', unit: 'tsp', isStaple: true, checked: false },
  { ingredientId: '7', nameEn: 'Garam masala', nameHi: null, nameKn: null, quantityLabel: 'check you have', category: 'staple', unit: 'tsp', isStaple: true, checked: false },
  { ingredientId: '8', nameEn: 'Turmeric', nameHi: null, nameKn: null, quantityLabel: 'check you have', category: 'staple', unit: 'tsp', isStaple: true, checked: false },
];

export default function GroceryListScreen() {
  const [lines, setLines] = useState<GroceryLineView[]>(MOCK_LINES);

  function toggleChecked(ingredientId: string) {
    // TODO: upsert grocery_checks(poll_id, ingredient_id, checked_by)
    setLines((prev) =>
      prev.map((line) => (line.ingredientId === ingredientId ? { ...line, checked: !line.checked } : line))
    );
  }

  const buyList = useMemo(() => lines.filter((l) => !l.isStaple), [lines]);
  const staples = useMemo(() => lines.filter((l) => l.isStaple), [lines]);
  const uncheckedCount = buyList.filter((l) => !l.checked).length;

  const shareText = useMemo(() => {
    const toBuy = buyList
      .filter((l) => !l.checked)
      .map((l) => `- ${l.nameEn} — ${l.quantityLabel}`)
      .join('\n');
    const stapleNames = staples.map((s) => s.nameEn).join(', ');
    return `🛒 Tonight: ${MOCK_DISH} (${MOCK_HEADCOUNT} people)\nTo buy:\n${toBuy}\nCheck at home: ${stapleNames}`;
  }, [buyList, staples]);

  async function handleShare() {
    await Share.share({ message: shareText });
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: buyList.filter((l) => l.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="subtitle">{MOCK_DISH}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Scaled for {MOCK_HEADCOUNT}
        </ThemedText>

        {grouped.map(({ category, items }) => (
          <ThemedView key={category} style={styles.categorySection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {CATEGORY_LABEL[category]}
            </ThemedText>
            {items.map((item) => (
              <Pressable
                key={item.ingredientId}
                onPress={() => toggleChecked(item.ingredientId)}
                style={styles.itemRow}>
                <ThemedView style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
                <ThemedView style={styles.itemTextCol}>
                  <ThemedText type="default" style={item.checked && styles.itemTextChecked}>
                    {item.nameEn}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantityLabel}
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

      <ThemedView type="backgroundElement" style={styles.footer}>
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
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3c87f7',
  },
  checkboxChecked: {
    backgroundColor: '#3c87f7',
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
    borderRadius: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000020',
  },
  footerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footerButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#25D366',
  },
  footerButtonText: {
    color: '#ffffff',
  },
});
