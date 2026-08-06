import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { TodayPollView } from '@/types/domain';

// TODO: replace with a Supabase query (daily_polls + poll_options + votes,
// realtime-subscribed) for today's poll scoped to the user's flat.
const MOCK_POLL: TodayPollView = {
  pollId: 'mock-poll',
  pollDate: new Date().toISOString().slice(0, 10),
  status: 'open',
  headcount: 3,
  isOutToday: false,
  winnerRecipeId: null,
  winnerReason: null,
  options: [
    { recipeId: 'palak-paneer', name: 'Palak Paneer', cuisine: 'North Indian', dietClass: 'veg', voteCount: 1, votedByMe: false, voterDisplayNames: ['Asha'] },
    { recipeId: 'dal-tadka', name: 'Dal Tadka', cuisine: 'North Indian', dietClass: 'veg', voteCount: 0, votedByMe: false, voterDisplayNames: [] },
    { recipeId: 'tomato-rasam', name: 'Tomato Rasam', cuisine: 'South Indian', dietClass: 'veg', voteCount: 1, votedByMe: false, voterDisplayNames: ['Ravi'] },
  ],
};

export default function TodayScreen() {
  const router = useRouter();
  const [poll, setPoll] = useState<TodayPollView>(MOCK_POLL);
  const [isOut, setIsOut] = useState(poll.isOutToday);

  function castVote(recipeId: string) {
    // TODO: upsert into `votes` (poll_id, user_id) via Supabase; realtime
    // subscription will reconcile voteCount/voterDisplayNames afterwards.
    setPoll((prev) => ({
      ...prev,
      options: prev.options.map((option) => ({
        ...option,
        votedByMe: option.recipeId === recipeId,
        voteCount:
          option.recipeId === recipeId
            ? option.voteCount + (option.votedByMe ? 0 : 1)
            : option.voteCount - (option.votedByMe ? 1 : 0),
      })),
    }));
  }

  const winner = poll.options.find((o) => o.recipeId === poll.winnerRecipeId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.headerRow}>
          <ThemedView>
            <ThemedText type="subtitle">Dinner tonight</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {poll.headcount} eating tonight
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.outToggleRow}>
          <ThemedText type="default">I&apos;m out today</ThemedText>
          <Switch
            value={isOut}
            onValueChange={(value) => {
              setIsOut(value);
              // TODO: upsert day_attendance(flat_id, user_id, poll_date, is_out)
            }}
          />
        </ThemedView>

        {poll.status === 'open' && (
          <ThemedView style={styles.optionsList}>
            {poll.options.map((option) => (
              <Pressable
                key={option.recipeId}
                onPress={() => castVote(option.recipeId)}
                style={({ pressed }) => [
                  styles.optionCard,
                  option.votedByMe && styles.optionCardSelected,
                  pressed && styles.optionCardPressed,
                ]}>
                <ThemedText type="default" style={styles.optionName}>
                  {option.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {option.cuisine} · {option.dietClass}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {option.voteCount} vote{option.voteCount === 1 ? '' : 's'}
                  {option.voterDisplayNames.length > 0 ? ` — ${option.voterDisplayNames.join(', ')}` : ''}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}

        {poll.status === 'closed' && winner && (
          <ThemedView type="backgroundElement" style={styles.winnerCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Tonight&apos;s winner
            </ThemedText>
            <ThemedText type="subtitle">{winner.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {winner.voteCount} vote{winner.voteCount === 1 ? '' : 's'}
              {poll.winnerReason === 'tiebreak_lru' ? ' (tie-break)' : ''}
              {poll.winnerReason === 'auto_no_votes' ? ' (auto-picked — no votes)' : ''}
            </ThemedText>

            <ThemedView style={styles.winnerActions}>
              <Pressable style={styles.actionButton} onPress={() => router.push('/grocery-list')}>
                <ThemedText type="smallBold" style={styles.actionButtonText}>
                  Grocery list
                </ThemedText>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => router.push('/cook-message-preview')}>
                <ThemedText type="smallBold" style={styles.actionButtonText}>
                  Preview cook message
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  outToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  optionsList: {
    gap: Spacing.three,
  },
  optionCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: Spacing.half,
  },
  optionCardSelected: {
    borderColor: '#3c87f7',
  },
  optionCardPressed: {
    opacity: 0.7,
  },
  optionName: {
    fontWeight: '700',
  },
  winnerCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  winnerActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  actionButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  actionButtonText: {
    color: '#ffffff',
  },
});
