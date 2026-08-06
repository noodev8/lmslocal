/**
 * Every cache key the app uses, in one place.
 *
 * Keys used to be inline template strings at both the write and the delete site, which meant a
 * mismatch was undetectable — nothing throws, the delete simply does nothing, and the stale data
 * survives. An audit found fifteen invalidation calls in exactly that state, including several
 * that had presumably never worked:
 *
 *   - `user-dashboard` where the key is `user-dashboard-${userId}`
 *   - `pick-stats-${id}` where the key is `pick-statistics-${id}`
 *   - `competitions-user-${userId}`, which nothing ever wrote
 *   - `competition-players-${id}`, where the real key carries page/size/search on the end
 *
 * Build keys from here and that class of bug stops compiling.
 *
 * ## Exact keys vs prefixes
 *
 * Some families are parameterised by pagination or filters, so a single competition owns many
 * keys — `competition-players-199-page-1-size-50-search-none` and every other combination the
 * user has scrolled through. **Those can only be cleared by prefix.** An exact-key delete of
 * `competition-players-199` matches nothing, which is precisely the bug above. They live under
 * `cachePrefixes`, and the type of the thing you're holding tells you which tool to reach for.
 */

/**
 * Must stay identical to the id used when keys are written, fallbacks included — an invalidation
 * that resolves 'anonymous' where the write resolved 'ssr' silently misses.
 */
export function cacheUserId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id?.toString() || 'unknown';
    }
  } catch (error) {
    console.warn('Failed to get user ID for cache key:', error);
  }
  return 'anonymous';
}

/** Keys that identify exactly one cached entry. Safe to delete by value. */
export const cacheKeys = {
  userDashboard: (userId: string = cacheUserId()) => `user-dashboard-${userId}`,
  userCredits: (userId: string = cacheUserId()) => `user-credits-${userId}`,
  userSubscription: (userId: string = cacheUserId()) => `user-subscription-${userId}`,
  billingHistory: (userId: string = cacheUserId()) => `billing-history-${userId}`,

  competitionStatus: (competitionId: number | string) => `competition-status-${competitionId}`,
  pickStatistics: (competitionId: number | string) => `pick-statistics-${competitionId}`,
  standingsSummary: (competitionId: number | string) => `standings-summary-${competitionId}`,
  promoteData: (competitionId: number | string) => `promote-data-${competitionId}`,
  rounds: (competitionId: number | string) => `rounds-${competitionId}`,

  fixtures: (roundId: number | string) => `fixtures-${roundId}`,
  calculatedFixtures: (roundId: number | string) => `calculated-fixtures-${roundId}`,
  teams: (teamListId: number | string | undefined) => `teams-${teamListId}`,

  /* Competition id is last, so this family cannot be cleared per competition by prefix. Delete it
     by exact key where the round is known. */
  currentPick: (roundId: number | string, competitionId: number | string) =>
    `current-pick-${roundId}-${competitionId}`,
};

/**
 * Families whose keys carry extra parameters. Delete these by prefix — never by exact key.
 * Each returns a string that every key in the family starts with.
 */
export const cachePrefixes = {
  competitionPlayers: (competitionId: number | string) => `competition-players-${competitionId}-`,
  competitionStandings: (competitionId: number | string) => `competition-standings-${competitionId}-`,
  roundStatistics: (competitionId: number | string) => `round-statistics-${competitionId}-`,
  allowedTeams: (competitionId: number | string) => `allowed-teams-${competitionId}-`,
};

/**
 * Every prefix scoped to one competition — what "this competition's data changed" means.
 *
 * `competitionStatus`, `pickStatistics`, `standingsSummary`, `promoteData` and `rounds` are exact
 * keys rather than prefixes, but they're included here as prefixes because each is the whole key:
 * a prefix delete of `rounds-199` also catches nothing else, since no other key starts with it.
 */
export function competitionCachePrefixes(competitionId: number | string): string[] {
  return [
    cachePrefixes.competitionPlayers(competitionId),
    cachePrefixes.competitionStandings(competitionId),
    cachePrefixes.roundStatistics(competitionId),
    cachePrefixes.allowedTeams(competitionId),
    cacheKeys.competitionStatus(competitionId),
    cacheKeys.pickStatistics(competitionId),
    cacheKeys.standingsSummary(competitionId),
    cacheKeys.promoteData(competitionId),
    cacheKeys.rounds(competitionId),
  ];
}
