/**
 * Marketing Template Library
 *
 * This file contains pre-written message templates for organizers to share their competitions.
 * Templates use variable placeholders that get replaced with real competition data.
 *
 * Variables available:
 * - [COMP_NAME] - Competition name
 * - [ROUND_NUMBER] - Current round number
 * - [PLAYERS_REMAINING] - Active player count
 * - [PLAYERS_ELIMINATED] - Players eliminated this round
 * - [TOP_3_PLAYERS] - Top 5 players formatted list
 * - [PICK_DEADLINE] - Lock time formatted (e.g., "Friday 7pm")
 * - [NEXT_ROUND_INFO] - Next round info message (e.g., "Saturday 15 Jan at 3:00pm" or "Fixtures coming soon")
 * - [FIXTURES] - Upcoming fixture list (for pick reminders)
 * - [FIXTURE_RESULTS] - Fixture-by-fixture breakdown with results (for round updates)
 * - [JOIN_CODE] - Competition invite code
 * - [JOIN_URL] - Full join URL (for pre-launch)
 * - [GAME_URL] - Direct game URL (for active competitions)
 * - [TOTAL_PLAYERS] - Total players who ever joined
 * - [PLAYERS_WITHOUT_PICKS] - Count of players who haven't picked
 * - [PICK_PERCENTAGE] - Percentage of players who have picked
 * - [ENTRY_DETAILS] - Entry fee and prize structure (formatted based on competition settings)
 */

export interface Template {
  id: string;
  name: string;
  category: 'pre_launch' | 'pick_reminder' | 'round_update' | 'winner';
  tone?: 'casual' | 'excited' | 'dramatic' | 'professional' | 'gentle' | 'urgent' | 'critical';
  content: string;
}

export const templates: Template[] = [
  // ==================================================
  // PRE-LAUNCH TEMPLATES (1)
  // ==================================================
  {
    id: 'pre_launch_1',
    name: 'Simple Invitation',
    category: 'pre_launch',
    tone: 'casual',
    content: `🏆 Last Man Standing Competition 🏆

I'm running a [COMP_NAME] competition!

How to join:
1. Go to https://lmslocal.co.uk
2. Click "Join Competition"
3. Use code: [JOIN_CODE]

[ENTRY_DETAILS]

Pick a team each round - if they win, you survive!

Good luck! ⚽`
  },

  // ==================================================
  // PICK REMINDER TEMPLATE (1)
  // ==================================================
  {
    id: 'pick_reminder',
    name: 'Pick Reminder',
    category: 'pick_reminder',
    tone: 'gentle',
    content: `⚽ [COMP_NAME] - Round [ROUND_NUMBER]

⏰ Round locks: [PICK_DEADLINE]

📅 Fixtures:
[FIXTURES]

Make your pick before the deadline!
https://lmslocal.co.uk

Good luck! 👍`
  },

  // ==================================================
  // ROUND UPDATE TEMPLATE (1)
  // ==================================================
  {
    id: 'round_results',
    name: 'Round Results',
    category: 'round_update',
    content: `💥 Round [ROUND_NUMBER] Results

[ROUND_STATS]

[PLAYERS_REMAINING] survivors remain

Top performers:
[TOP_3_PLAYERS]

📊 View full standings online:
[GAME_URL]`
  },

  // ==================================================
  // WINNER ANNOUNCEMENT TEMPLATES (2)
  // ==================================================
  {
    id: 'winner_celebratory',
    name: 'Celebratory Winner',
    category: 'winner',
    tone: 'excited',
    content: `🏆👑 WE HAVE A CHAMPION! 👑🏆

[COMP_NAME] is COMPLETE!

After [ROUND_NUMBER] rounds and [TOTAL_PLAYERS] competitors...

🥇 WINNER:
[TOP_3_PLAYERS]

What a competition! Congratulations to our champion and thanks to everyone who played! 🎉

View final standings: [GAME_URL]`
  },
  {
    id: 'winner_professional',
    name: 'Professional Winner',
    category: 'winner',
    tone: 'professional',
    content: `🏆 [COMP_NAME] - Competition Complete

FINAL RESULTS:
After [ROUND_NUMBER] rounds, we have our winner!

CHAMPION:
[TOP_3_PLAYERS]

COMPETITION STATS:
• Total participants: [TOTAL_PLAYERS]
• Rounds completed: [ROUND_NUMBER]

Congratulations to our champion and well played to all competitors.

View final standings: [GAME_URL]`
  }
];

/**
 * Format upcoming fixtures for display (without results)
 */
function formatFixtures(fixtures: Array<{
  home_team: string;
  away_team: string;
  kickoff_time?: string;
}>): string {
  if (!fixtures || fixtures.length === 0) {
    return 'No fixtures available';
  }

  return fixtures.map(f => {
    return `⚽ ${f.home_team} vs ${f.away_team}`;
  }).join('\n');
}

/**
 * Format fixture results for display
 */
function formatFixtureResults(fixtures: Array<{
  home_team: string;
  away_team: string;
  result: string | null;
  outcome: 'home_win' | 'away_win' | 'draw' | null;
  survivors: number;
  eliminated: number;
}>): string {
  if (!fixtures || fixtures.length === 0) {
    return 'No fixture results available';
  }

  // Filter out fixtures with no picks
  const fixturesWithPicks = fixtures.filter(f => f.survivors > 0 || f.eliminated > 0);

  if (fixturesWithPicks.length === 0) {
    return 'No players picked any fixtures';
  }

  return fixturesWithPicks.map(f => {
    if (!f.result) {
      return `${f.home_team} vs ${f.away_team} - No result yet`;
    }

    if (f.outcome === 'draw') {
      return `💔 ${f.home_team} vs ${f.away_team} (Draw)\n   💔 ${f.eliminated} eliminated`;
    } else if (f.outcome === 'home_win') {
      return `✅ ${f.home_team} vs ${f.away_team} (${f.home_team} won)\n   ✅ ${f.survivors} survived | ❌ ${f.eliminated} eliminated`;
    } else if (f.outcome === 'away_win') {
      return `✅ ${f.home_team} vs ${f.away_team} (${f.away_team} won)\n   ✅ ${f.survivors} survived | ❌ ${f.eliminated} eliminated`;
    } else {
      return `${f.home_team} vs ${f.away_team} - Result pending`;
    }
  }).join('\n\n');
}

/**
 * Replace template variables with actual competition data
 */
export function replaceTemplateVariables(
  template: string,
  data: {
    competition_name: string;
    round_number: number | null;
    players_remaining: number;
    players_eliminated: number;
    top_players: Array<{ display_name: string; lives_remaining: number }>;
    pick_deadline: string | null;
    next_round_info: string | null;
    join_code: string;
    join_url: string;
    game_url: string;
    total_players: number;
    players_without_picks: number;
    pick_percentage: number;
    entry_fee?: number | null;
    prize_structure?: string | null;
    fixtures?: Array<{
      home_team: string;
      away_team: string;
      kickoff_time?: string;
    }>;
    fixture_results?: Array<{
      home_team: string;
      away_team: string;
      result: string | null;
      outcome: 'home_win' | 'away_win' | 'draw' | null;
      survivors: number;
      eliminated: number;
    }>;
    round_stats?: {
      total_players: number;
      won: number;
      lost: number;
      eliminated: number;
    };
  }
): string {
  let result = template;

  // Replace simple variables
  result = result.replace(/\[COMP_NAME\]/g, data.competition_name);
  result = result.replace(/\[ROUND_NUMBER\]/g, data.round_number?.toString() || '?');
  result = result.replace(/\[PLAYERS_REMAINING\]/g, data.players_remaining.toString());
  result = result.replace(/\[PLAYERS_ELIMINATED\]/g, data.players_eliminated.toString());
  result = result.replace(/\[PICK_DEADLINE\]/g, data.pick_deadline || 'TBD');
  result = result.replace(/\[NEXT_ROUND_INFO\]/g, data.next_round_info || 'Fixtures coming soon');
  result = result.replace(/\[JOIN_CODE\]/g, data.join_code);
  result = result.replace(/\[JOIN_URL\]/g, data.join_url);
  result = result.replace(/\[GAME_URL\]/g, data.game_url);
  result = result.replace(/\[TOTAL_PLAYERS\]/g, data.total_players.toString());
  result = result.replace(/\[PLAYERS_WITHOUT_PICKS\]/g, data.players_without_picks.toString());
  result = result.replace(/\[PICK_PERCENTAGE\]/g, data.pick_percentage.toString());

  // Format entry details (entry fee + prize structure)
  let entryDetails = '';
  const entryFeeNum = data.entry_fee ? Number(data.entry_fee) : 0;
  if (entryFeeNum > 0) {
    entryDetails = `💷 Entry: £${entryFeeNum.toFixed(2)}`;
    if (data.prize_structure) {
      entryDetails += `\n🏆 Prizes: ${data.prize_structure}`;
    }
  } else if (data.prize_structure) {
    entryDetails = `🏆 Prizes: ${data.prize_structure}`;
  }
  result = result.replace(/\[ENTRY_DETAILS\]/g, entryDetails);

  // Format top players list
  const topPlayersFormatted = data.top_players
    .map((p, index) => `${index === 0 ? '👑' : '  '} ${p.display_name} (${p.lives_remaining} ${p.lives_remaining === 1 ? 'life' : 'lives'})`)
    .join('\n');
  result = result.replace(/\[TOP_3_PLAYERS\]/g, topPlayersFormatted || 'No players yet');

  // Format upcoming fixtures (for pick reminders)
  if (data.fixtures) {
    const fixturesFormatted = formatFixtures(data.fixtures);
    result = result.replace(/\[FIXTURES\]/g, fixturesFormatted);
  } else {
    result = result.replace(/\[FIXTURES\]/g, 'Loading fixtures...');
  }

  // Format fixture results
  if (data.fixture_results) {
    const fixtureResultsFormatted = formatFixtureResults(data.fixture_results);
    result = result.replace(/\[FIXTURE_RESULTS\]/g, fixtureResultsFormatted);
  } else {
    result = result.replace(/\[FIXTURE_RESULTS\]/g, 'Loading fixture results...');
  }

  // Format round statistics
  if (data.round_stats) {
    const lostLife = data.round_stats.lost - data.round_stats.eliminated;
    const roundStatsFormatted =
      `📊 ${data.round_stats.total_players} played → ${data.round_stats.won} won\n` +
      `⚠️ ${lostLife} lost a life\n` +
      `☠️ ${data.round_stats.eliminated} eliminated`;
    result = result.replace(/\[ROUND_STATS\]/g, roundStatsFormatted);
  } else {
    result = result.replace(/\[ROUND_STATS\]/g, `[PLAYERS_ELIMINATED] players eliminated from [COMP_NAME]!`);
  }

  return result;
}

/**
 * Get templates for a specific category
 */
export function getTemplatesByCategory(category: Template['category']): Template[] {
  return templates.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id);
}
