// Winner selection (docs/02-prd.md §F2):
//   - most votes wins outright
//   - a tie among the top vote-getters, or zero votes at all, falls back to
//     least-recently-eaten among the tied (or all 3, if zero votes) options
//   - "recently eaten" is derived from daily_polls.winner_recipe_id where
//     status='dispatched', per docs/04-architecture.md — never served before
//     sorts first (oldest/never = most eligible)

export interface VoteTally {
  recipeId: string;
  voteCount: number;
}

export type WinnerReason = 'votes' | 'tiebreak_lru' | 'auto_no_votes';

export interface WinnerResult {
  recipeId: string;
  reason: WinnerReason;
}

// `lastServedAt` maps recipeId -> most recent dispatched poll_date it won,
// or undefined if this flat has never been served that recipe.
export function selectWinner(
  tallies: VoteTally[],
  lastServedAt: Map<string, string | undefined>
): WinnerResult | null {
  if (tallies.length === 0) return null;

  const maxVotes = Math.max(...tallies.map((t) => t.voteCount));

  if (maxVotes === 0) {
    return { recipeId: leastRecentlyEaten(tallies.map((t) => t.recipeId), lastServedAt), reason: 'auto_no_votes' };
  }

  const topTied = tallies.filter((t) => t.voteCount === maxVotes);
  if (topTied.length === 1) {
    return { recipeId: topTied[0].recipeId, reason: 'votes' };
  }

  return {
    recipeId: leastRecentlyEaten(topTied.map((t) => t.recipeId), lastServedAt),
    reason: 'tiebreak_lru',
  };
}

function leastRecentlyEaten(recipeIds: string[], lastServedAt: Map<string, string | undefined>): string {
  return recipeIds.reduce((best, current) => {
    const bestDate = lastServedAt.get(best);
    const currentDate = lastServedAt.get(current);
    if (!currentDate) return bestDate ? current : best; // never served beats any date; first never-served wins ties
    if (!bestDate) return best;
    return currentDate < bestDate ? current : best;
  });
}
