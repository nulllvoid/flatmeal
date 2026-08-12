import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/contexts/active-group';
import { useAttendance } from '@/hooks/use-attendance';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useTodayCart } from '@/hooks/use-today-cart';

// Mockup screen 07: "who are you picking for?" — lets any member mark any
// OTHER group member in/out for the day (day_attendance RLS was widened from
// self-only to any group member specifically for this —
// supabase/migrations/20260109000001_sides_limits_activity.sql). Distinct
// from the Today tab's own "I'm out today" self-toggle, which stays as the
// quick self-service path; this is the fuller per-person view.
export default function WhoIsEatingScreen() {
  const router = useRouter();
  const session = useSession();
  const { activeGroup } = useActiveGroup();
  const flatId = activeGroup?.id;
  const { members, setMemberOut } = useAttendance(flatId);
  const { cart } = useTodayCart(flatId, session?.user.id);
  const theme = useTheme();

  if (members === undefined) {
    return null; // loading
  }

  if (members === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">No group yet</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const eatingCount = members.filter((m) => !m.isOut).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.heading}>
          who are you picking for?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Quantities fill themselves from what each person eats. Leave someone out and they can add
          themselves back later.
        </ThemedText>

        <ThemedView style={styles.memberList}>
          {members.map((member) => {
            const eating = !member.isOut;
            return (
              <Pressable
                key={member.userId}
                onPress={() => setMemberOut(member.userId, eating, session?.user.id, cart?.pollId)}
                style={[
                  styles.memberRow,
                  { borderColor: eating ? theme.accent : theme.divider, backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedView style={styles.avatar}>
                  <ThemedText type="smallBold">{initials(member.displayName)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.memberInfo}>
                  <ThemedText type="default" style={styles.memberName}>
                    {member.displayName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {member.dietSummary}
                  </ThemedText>
                </ThemedView>
                <ThemedView
                  style={[
                    styles.checkbox,
                    { borderColor: theme.accent },
                    eating && { backgroundColor: theme.accent },
                  ]}
                />
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          <ThemedView style={styles.summaryRow}>
            <ThemedText type="smallBold">{eatingCount} eating</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              of {members.length}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.summaryRow}>
            <ThemedText type="small">Everything in the cart starts at</ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              ×{eatingCount}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <Pressable style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
          <ThemedText type="smallBold" style={[styles.primaryButtonText, { color: theme.background }]}>
            Back to the cart
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.match(/[a-zA-Z]/)?.[0])
    .filter((c): c is string => Boolean(c))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  heading: {
    fontSize: 34,
    lineHeight: 38,
  },
  memberList: {
    gap: Spacing.two,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  memberName: {
    fontFamily: Fonts.bodyBold,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
  },
  summaryCard: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
  },
});
