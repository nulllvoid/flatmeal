import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMyFlat } from '@/hooks/use-my-flat';
import { useSession } from '@/hooks/use-session';
import { useTodayPoll } from '@/hooks/use-today-poll';

export default function TodayScreen() {
  const router = useRouter();
  const session = useSession();
  const flatId = useMyFlat(session);
  const { poll, headcount, castVote, castAccompanimentVote, setOutToday } = useTodayPoll(flatId, session?.user.id);

  if (poll === undefined) {
    return null; // loading
  }

  if (poll === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">No poll yet today</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Options land at your flat&apos;s poll-open time.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const winner = poll.options.find((o) => o.recipeId === poll.winnerRecipeId);
  const accompanimentWinner = poll.accompanimentOptions.find((a) => a.recipeId === poll.winnerAccompanimentRecipeId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.headerRow}>
          <ThemedView>
            <ThemedText type="subtitle">Dinner tonight</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {headcount} eating tonight
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.outToggleRow}>
          <ThemedText type="default">I&apos;m out today</ThemedText>
          <Switch value={poll.isOutToday} onValueChange={setOutToday} />
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

        {(poll.status === 'closed' || poll.status === 'dispatched') && winner && (
          <ThemedView type="backgroundElement" style={styles.winnerCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Tonight&apos;s winner
            </ThemedText>
            <ThemedText type="subtitle">
              {winner.name}
              {accompanimentWinner ? ` with ${accompanimentWinner.name}` : ''}
            </ThemedText>
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

        {poll.accompanimentVotingOpen && (
          <ThemedView style={styles.optionsList}>
            <ThemedText type="subtitle">What should it come with?</ThemedText>
            {poll.accompanimentOptions.map((option) => (
              <Pressable
                key={option.recipeId}
                onPress={() => castAccompanimentVote(option.recipeId)}
                style={({ pressed }) => [
                  styles.optionCard,
                  option.votedByMe && styles.optionCardSelected,
                  pressed && styles.optionCardPressed,
                ]}>
                <ThemedText type="default" style={styles.optionName}>
                  {option.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {option.voteCount} vote{option.voteCount === 1 ? '' : 's'}
                  {option.voterDisplayNames.length > 0 ? ` — ${option.voterDisplayNames.join(', ')}` : ''}
                </ThemedText>
              </Pressable>
            ))}
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
