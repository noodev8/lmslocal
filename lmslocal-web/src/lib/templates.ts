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
 * - [FIXTURE_RESULTS] - Fixture-by-fixture breakdown with results (for Detailed template)
 * - [JOIN_CODE] - Competition invite code
 * - [JOIN_URL] - Full join URL (for pre-launch)
 * - [GAME_URL] - Direct game URL (for active competitions)
 * - [TOTAL_PLAYERS] - Total players who ever joined
 * - [PLAYERS_WITHOUT_PICKS] - Count of players who haven't picked
 * - [PICK_PERCENTAGE] - Percentage of players who have picked
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
  // PRE-LAUNCH TEMPLATES (3)
  // ==================================================
  {
    id: 'pre_launch_1',
    name: 'Simple Invitation',
    category: 'pre_launch',
    tone: 'casual',
    content: `🏆 Last Man Standing Competition 🏆

I'm running a [COMP_NAME] competition!

How to join:
1. Go to: [JOIN_URL]
2. Use code: [JOIN_CODE]

It's free to play and easy to enter. Pick a team each round - if they win, you survive!

Good luck! ⚽`
  },
  {
    id: 'pre_launch_2',
    name: 'Detailed Invitation',
    category: 'pre_launch',
    tone: 'professional',
    content: `🎯 Join Our Last Man Standing Competition

Competition: [COMP_NAME]

HOW IT WORKS:
• Pick one team each round
• If your team wins, you survive
• If they lose or draw, you lose a life
• Last player standing wins!

HOW TO JOIN:
Visit: [JOIN_URL]
Enter code: [JOIN_CODE]

Don't miss out - join today! 🏆`
  },
  {
    id: 'pre_launch_3',
    name: 'Exciting Launch',
    category: 'pre_launch',
    tone: 'excited',
    content: `🔥 WHO WILL BE THE LAST ONE STANDING? 🔥

We're kicking off [COMP_NAME] and YOU'RE invited!

The rules are simple:
✅ Pick a winning team each round
✅ Winners survive, losers are OUT
✅ Last survivor takes the glory!

Ready to compete?
👉 [JOIN_URL]
🔑 Code: [JOIN_CODE]

Let's do this! ⚽🏆`
  },

  // ==================================================
  // PICK REMINDER TEMPLATES (3)
  // ==================================================
  {
    id: 'pick_reminder_gentle',
    name: 'Gentle Reminder',
    category: 'pick_reminder',
    tone: 'gentle',
    content: `⚽ [COMP_NAME] - Round [ROUND_NUMBER]

Hey everyone! Just a friendly reminder to make your pick if you haven't already.

📊 [PICK_PERCENTAGE]% of players have picked
⏰ Deadline: [PICK_DEADLINE]

Make your pick: [GAME_URL]

Good luck! 👍`
  },
  {
    id: 'pick_reminder_urgent',
    name: 'Urgent Reminder',
    category: 'pick_reminder',
    tone: 'urgent',
    content: `🚨 PICK REMINDER - Round [ROUND_NUMBER] 🚨

[PLAYERS_WITHOUT_PICKS] players still need to make their pick!

⏰ Picks lock: [PICK_DEADLINE]
⚽ Don't lose a life by missing the deadline

👉 Pick now: [GAME_URL]

[COMP_NAME]`
  },
  {
    id: 'pick_reminder_critical',
    name: 'Final Warning',
    category: 'pick_reminder',
    tone: 'critical',
    content: `⚠️ FINAL WARNING ⚠️

Round [ROUND_NUMBER] picks are locking soon!

🚨 [PLAYERS_WITHOUT_PICKS] players haven't picked yet
⏰ DEADLINE: [PICK_DEADLINE]

If you don't pick, you LOSE A LIFE automatically!

👉 PICK NOW: [GAME_URL]

[COMP_NAME]`
  },

  // ==================================================
  // ROUND UPDATE TEMPLATES (3)
  // ==================================================
  {
    id: 'round_minimal',
    name: 'Minimal',
    category: 'round_update',
    content: `📊 Round [ROUND_NUMBER] - [COMP_NAME]

💪 Survivors: [PLAYERS_REMAINING]
💔 Eliminated: [PLAYERS_ELIMINATED]

Next round: [NEXT_ROUND_INFO]

[GAME_URL]`
  },
  {
    id: 'round_detailed',
    name: 'Detailed with Fixtures',
    category: 'round_update',
    content: `⚽ Round [ROUND_NUMBER] Results - [COMP_NAME]

SUMMARY:
💪 Survivors: [PLAYERS_REMAINING]
💔 Eliminated: [PLAYERS_ELIMINATED]

[FIXTURE_RESULTS]

Next round: [NEXT_ROUND_INFO]

[GAME_URL]`
  },
  {
    id: 'round_elimination_focus',
    name: 'Elimination Focus',
    category: 'round_update',
    content: `💥 Round [ROUND_NUMBER] Eliminations

[PLAYERS_ELIMINATED] players eliminated from [COMP_NAME]!

Only [PLAYERS_REMAINING] survivors remain...

Top performers:
[TOP_3_PLAYERS]

Next round: [NEXT_ROUND_INFO]

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
    fixture_results?: Array<{
      home_team: string;
      away_team: string;
      result: string | null;
      outcome: 'home_win' | 'away_win' | 'draw' | null;
      survivors: number;
      eliminated: number;
    }>;
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

  // Format top players list
  const topPlayersFormatted = data.top_players
    .map((p, index) => `${index === 0 ? '👑' : '  '} ${p.display_name} (${p.lives_remaining} ${p.lives_remaining === 1 ? 'life' : 'lives'})`)
    .join('\n');
  result = result.replace(/\[TOP_3_PLAYERS\]/g, topPlayersFormatted || 'No players yet');

  // Format fixture results
  if (data.fixture_results) {
    const fixtureResultsFormatted = formatFixtureResults(data.fixture_results);
    result = result.replace(/\[FIXTURE_RESULTS\]/g, fixtureResultsFormatted);
  } else {
    result = result.replace(/\[FIXTURE_RESULTS\]/g, 'Loading fixture results...');
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
