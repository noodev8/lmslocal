/*
=======================================================================================================================================
Round Over Service
=======================================================================================================================================
Purpose: The one definition of who is told a round has been settled, and what they are told.
         Outline row: Player | Game | Round Over. email_type stays 'results'.
         Since 2026-11-26 it covers both games, one email per PERSON across every competition
         with news for them (docs/matchday.md §9.1). Everything below about readiness and
         recipients is LMS's half (findLmsItems), unchanged; MATCHDAY_ITEMS_SQL mirrors it.

The email every player gets every week, and the one the rest of the system exists to support.

READINESS IS THE WHOLE DESIGN. It is not ready when a round ends; it is ready when a round ends AND
the next round's fixtures are in. A "round over" email with nothing to do next is a dead end - the
player reads who went out, has nowhere to go, and has to come back later anyway. Waiting turns two
half-emails into one that settles the last round and opens the next in the same breath.

Ready when the highest FULLY PROCESSED round is followed by a round N+1 that has fixtures AND
round N+1 has not locked yet - see the lock clause in findCandidates. Readiness once ran until
N+1 was itself processed, which meant the whole gap between kickoff and results being keyed, so
a player could be handed a deadline that passed on Saturday afternoon and asked to pick.

Anything else is somebody else's email. Results outstanding -> resultReminder. Settled with no
next round staged -> fixtureReminder. Competition finished -> gameComplete.

THAT LAST ONE USED TO BE THIS EMAIL TOO, and it was a mistake (fixed 2026-08-14). A second arm
here read "or competition status COMPLETE", so the final round being processed fired BOTH this and
gameComplete - one event, two emails, both announcing the same winner to anyone who reached the
end. gameComplete now owns a competition ending outright, for everybody who took part rather than
just the finalists, and this email owns "a round ended and the next one is open".

The fix was to remove a rule rather than add one: the alternative considered was gameComplete
excluding final-round players, which would have meant one email reaching into player_progress to
work out who it was NOT for.

The cost, accepted: a final-round player is no longer told their own last pick and how it went.
They get gameComplete, which names the winner and says whether they survived, but not "your team
lost". They watched that match; the winner is the part they need.

RECIPIENTS COME FROM player_progress, one row per player per round, which is exactly "who was in
this round". A player eliminated in round 3 has no row for round 5 and is not told about a round
they had no part in - that falls out of the data rather than needing a rule. NO-PICK is a real row
there (chosen_team = 'NO-PICK', outcome LOSE), so somebody who forgot to pick is still told what
it cost.

MINUS ANYONE WHO HAS ALREADY PICKED IN THE NEXT ROUND (added 2026-08-25). The email's job is to
bring the player back to the app; if they are already there and have picked, it has nothing left
to do. The organiser is exempt - their copy is also the competition-wide report.

MINUS EVERYONE ONCE ROUND N+1 LOCKS (added 2026-08-26, made absolute 2026-09-12). THE EMAIL DIES
WHEN THE ROUND IT OPENS KICKS OFF. No exemptions, and that is the point of it - the two that used
to be here both rotted the same way.

Eliminated players were exempt because this is their only notification and lock was said to shrink
an already short window. The window was never short: a round settles on the Sunday night and the
next locks the following Saturday.

The organiser was exempt because their copy carries the competition-wide report, which was held not
to stop being true at kickoff. True on the Monday. Not true six days later, when the survivor
counts it quotes are about to be overwritten by a round already being played - and the organiser
needs an email about a round less than anyone, having keyed the results themselves.

What both bought was an offer to send that never expired: a card on the admin screen still
proposing, a week on, to announce a round that had since been played. BEING LATE IS A FACT ABOUT
THE SEND, NOT ABOUT THE READER, so it cannot be argued away one group at a time.

The cost, accepted: if nobody presses the button before lock, nobody is told at all - an eliminated
player never learns by email that they went out. Silence is the better of the two. By then they
have watched a round play out without them and the news has told itself; an email arriving after
that is not news, it is a system admitting it was late.

The queue-to-send gap is a separate matter and is still covered: a row can be queued while the
round is open and drained after it locks, so services/emailService.js re-reads the lock time when
it builds the email and drops the deadline, the fixture list and the pick button if it has passed.

Two different questions, deliberately answered from two places:
  - "did your team win?"    -> player_progress.outcome for this round
  - "are you still in?"     -> competition_user.status
A player with a life left loses and stays in, so one cannot be derived from the other.

Counts are exact and names are sampled. A 100-player competition cannot send a 100-line email, and
the names are there to make it feel like a competition rather than a report - five a side is
plenty for that.
=======================================================================================================================================
*/

const { query } = require('../database');
const { ROUND_OVER_WINDOW_DAYS } = require('./emailExpiry');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { notArchivedSql } = require('./competitionEngagement');
const { isLmsSql, isMatchdaySql } = require('./gameType');
const { getRecentMatchdayTable } = require('./matchdayTable');
const { groupByPerson, queueBundle, lmsFirst } = require('./emailBundle');

const EMAIL_TYPE = 'results';

// How many names are listed each way. Counts are always exact; this caps only the sample.
const SAMPLE_SIZE = 5;

/**
 * The subject line. A function because it carries the competition name and round, and the tracking
 * row is written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName, roundNumber) => `${competitionName} — Round ${roundNumber} results`;

/**
 * Last Man Standing's items: one row per player per competition with a settled round - the shape
 * this service returned before Matchday. Always platform-wide, because findCandidates needs every
 * competition a person has news in; the scope is applied after grouping.
 *
 * @returns {Promise<Array>} item rows, each carrying everything lmsTemplateData needs
 */
async function findLmsItems() {
  const competition_id = null;

  const result = await query(`
    SELECT
      'lms'                  AS game_type,
      pp.player_id           AS user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      UPPER(c.status)         AS competition_status,

      last_round.id          AS round_id,
      last_round.round_number,
      last_round.settled_at,

      -- This player's own round: what they picked and how it went.
      pp.chosen_team,

      /*
      The pick spelled out - "Arsenal", not the "ARS" that player_progress stores. Correlated on
      the competition's own team_list, since short names are only unique within one. NULL for
      'NO-PICK' and for a team since removed from the list, and the template falls back to the
      stored code rather than printing nothing.
      */
      (
        SELECT t.name
        FROM team t
        WHERE t.team_list_id = c.team_list_id
          AND t.short_name = pp.chosen_team
        LIMIT 1
      ) AS chosen_team_name,
      pp.outcome,
      cu.status              AS player_status,
      cu.lives_remaining,

      /*
      Whether this recipient runs the competition. Every organiser plays in their own competition
      - 29 of 30 - so they were already getting this email as a player; this flag adds an
      organiser block to their copy rather than sending them a second email. That is deliberate:
      a separate organiser email would collide with this one under magic send, and which of the
      two survived would be decided by whichever the operator pressed first.
      */
      (pp.player_id = c.organiser_id) AS is_organiser,

      -- The shape of the competition after this round. Constant per competition, so these are
      -- subqueries rather than a per-recipient lookup - see the N+1 rule in CLAUDE.md.
      (
        SELECT COUNT(*) FROM competition_user s
        WHERE s.competition_id = c.id AND s.status = 'active'
      ) AS survivors_count,
      (
        SELECT COUNT(*) FROM player_progress pp2
        INNER JOIN competition_user cu2
          ON cu2.competition_id = c.id AND cu2.user_id = pp2.player_id
        WHERE pp2.round_id = last_round.id
          AND pp2.outcome = 'LOSE'
          AND cu2.status = 'out'
      ) AS out_this_round_count,
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT su.display_name
          FROM competition_user s
          INNER JOIN app_user su ON su.id = s.user_id
          WHERE s.competition_id = c.id AND s.status = 'active'
          ORDER BY su.display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS survivors_sample,
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT ou.display_name
          FROM player_progress pp3
          INNER JOIN competition_user cu3
            ON cu3.competition_id = c.id AND cu3.user_id = pp3.player_id
          INNER JOIN app_user ou ON ou.id = pp3.player_id
          WHERE pp3.round_id = last_round.id
            AND pp3.outcome = 'LOSE'
            AND cu3.status = 'out'
          ORDER BY ou.display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS out_this_round_sample,

      -- What happens next. Null throughout when the competition has finished.
      next_round.id           AS next_round_id,
      next_round.round_number AS next_round_number,
      next_round.lock_time    AS next_deadline,
      (
        SELECT json_agg(json_build_object(
                 'home', f.home_team,
                 'away', f.away_team,
                 'kickoff', f.kickoff_time
               ) ORDER BY f.kickoff_time, f.id)
        FROM fixture f WHERE f.round_id = next_round.id
      ) AS next_fixtures

    FROM competition c

    /*
    The highest round that is genuinely settled: it has fixtures and every one of them has been
    processed. LATERAL so the fixture aggregate is computed for that round alone.
    */
    INNER JOIN LATERAL (
      SELECT
        r.id,
        r.round_number,
        /*
        When this round was settled. Not used by the template: it drives the "waiting since"
        column on the admin screen, which is how the operator tells a round that finished last
        night from one that finished in the spring.
        */
        (SELECT MAX(f2.processed) FROM fixture f2 WHERE f2.round_id = r.id) AS settled_at
      FROM round r
      WHERE r.competition_id = c.id
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id AND f.processed IS NULL)
      ORDER BY r.round_number DESC
      LIMIT 1
    ) last_round ON true

    /*
    The next round, and only if it carries fixtures. LEFT JOIN because a finished competition has
    no next round and still qualifies - the readiness test below is what enforces the rule.
    */
    LEFT JOIN LATERAL (
      SELECT r.id, r.round_number, r.lock_time, r.created_at
      FROM round r
      WHERE r.competition_id = c.id
        AND r.round_number = last_round.round_number + 1
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
      LIMIT 1
    ) next_round ON true

    -- Who was in that round. This is the recipient list.
    INNER JOIN player_progress pp
      ON pp.round_id = last_round.id

    INNER JOIN competition_user cu
      ON cu.competition_id = c.id
      AND cu.user_id = pp.player_id

    INNER JOIN app_user u
      ON u.id = pp.player_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE
      -- Archived competitions get no email at all. See notArchivedSql.
      ${notArchivedSql('c')} AND
      -- Last Man Standing's copy: no other game receives it. See isLmsSql.
      ${isLmsSql('c')} AND

      /*
      The readiness rule, and now the ONLY arm of it: the next round is staged.

      There used to be a second arm - "or the competition is COMPLETE" - and it was the entire
      overlap with game_complete. Both emails fired on the same event, the final round being
      processed, so a player who reached the end got two messages announcing the same winner.
      Removed 2026-08-14; game_complete is the email for a competition ending, for everybody who
      took part.

      Dropping it also makes this service's founding rule true by construction rather than by a
      branch: "never a dead end" now holds because a next round is the only thing that qualifies.
      */
      next_round.id IS NOT NULL

      /*
      Already picked in the next round -> not sent. The email exists to get the player back into
      the app to pick; somebody who has picked is already there, and telling them again buys
      nothing. At a few thousand players that is most of a send saved on an active competition.

      The organiser is exempt. Their copy carries the organiser block (see is_organiser above),
      which is not about picking at all, and they are usually the first person in - so keying
      their own pick would silently cost them the one email that tells them how the round went
      across the competition.

      Note this cannot suppress an eliminated player: they have no next round to pick in, so the
      NOT EXISTS holds and they are still told how their last round ended.
      */
      AND (
        pp.player_id = c.organiser_id
        OR NOT EXISTS (
          SELECT 1 FROM pick pk
          WHERE pk.round_id = next_round.id
            AND pk.user_id = pp.player_id
        )
      )

      /*
      AND ONLY WHILE THE NEXT ROUND CAN STILL BE ENTERED. Readiness used to hold until the next
      round was fully PROCESSED, which left the whole gap between kickoff and results going in -
      most of a weekend - during which this email showed fixtures and a deadline that had already
      passed and asked the player to pick. That is the founding rule broken: not a dead end
      because there is nothing next, but because what is next cannot be entered.

      NO EXEMPTIONS (2026-09-12). Both of the ones that used to be here are gone, and they went for
      the same reason rather than two:

        - ELIMINATED PLAYERS were exempt because this is their only notification and lock was said
          to shrink an already short window. The window was never short - a round settles on the
          Sunday night and the next locks the following Saturday.

        - The ORGANISER was exempt because their copy is the competition-wide report, which was
          held not to stop being true at kickoff. True on the Monday. Not true six days later,
          when the survivor counts it quotes are about to be overwritten by a round already being
          played - and the organiser is the one person who needs an email about a round least,
          having keyed the results themselves.

      What both exemptions actually bought was an offer to send that never expired: a card on the
      admin screen still proposing, a week on, to announce a round that had since been played.
      Being late is a fact about the send, not about the reader, so it cannot be argued away one
      group at a time. The rule states itself now - THE EMAIL DIES WHEN THE ROUND IT OPENS KICKS
      OFF - and a rule with no exemptions is one that cannot rot at the edges.

      So this withdraws the email from everyone it has become useless to. They are told nothing
      instead of told wrongly, which is the better of the two - a message saying what they missed
      is a different email, and deliberately not this one.

      A missing lock_time counts as OPEN. Every round carries one today, so this is a guard
      rather than a case; silently withholding is the worse way to be wrong.
      */
      AND (
        next_round.lock_time IS NULL
        OR next_round.lock_time > NOW()
      )

      -- Became ready recently - see ROUND_OVER_WINDOW_DAYS. GREATEST skips the NULL next round
      -- of a finished competition, leaving the settle.
      AND GREATEST(last_round.settled_at, next_round.created_at) > NOW() - ($3 || ' days')::interval

      -- Once per player per round.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.round_id = last_round.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}

      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($1::int IS NULL OR c.id = $1)

    ORDER BY c.id, u.id
  `, [competition_id, groupFor(EMAIL_TYPE), String(ROUND_OVER_WINDOW_DAYS)]);

  return result.rows;
}

/**
 * The template data for one LMS competition - the email as it was before Matchday, and the LMS
 * item inside a bundled one.
 *
 * @param {object} candidate - an LMS item row from findLmsItems
 * @returns {Promise<object>}
 */
async function lmsTemplateData(candidate) {
  const {
    user_id,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    competition_status,
    round_id,
    round_number,
    chosen_team,
    chosen_team_name,
    outcome,
    player_status,
    lives_remaining,
    survivors_count,
    out_this_round_count,
    survivors_sample,
    out_this_round_sample,
    next_round_number,
    next_deadline,
    next_fixtures,
    is_organiser
  } = candidate;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  const survivors = Number(survivors_count) || 0;

  /*
  Always false now, and kept only so the template's shape does not change under it. A candidate
  must have a next round staged to get here (see findCandidates), and a COMPLETE competition has
  none - so the "who won" branch below is unreachable. gameComplete owns a competition ending.

  Left in rather than ripped out because the template reads these three keys and a missing key
  renders differently from a false one. Remove them together when that template is next touched.
  */
  const isComplete = competition_status === 'COMPLETE';

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${round_id}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    round_id,
    round_number: Number(round_number),

    /*
    The recipient's own round. chosen_team carries the full name the reader would say out loud;
    missed_pick is taken from the raw code below, because 'NO-PICK' is a real value here, not a
    missing one, and it has no row in team to resolve against.
    */
    chosen_team: chosen_team_name || chosen_team,
    outcome,
    missed_pick: chosen_team === 'NO-PICK',
    survived: player_status === 'active',
    lives_remaining: Number(lives_remaining) || 0,

    survivors_count: survivors,
    out_this_round_count: Number(out_this_round_count) || 0,
    survivors_sample: survivors_sample || null,
    out_this_round_sample: out_this_round_sample || null,

    /*
    Adds an organiser block to this recipient's copy. Coerced rather than passed through: this is
    stored on email_queue.template_data as JSON and read back by the template, so it must be a
    real boolean and not whatever the driver hands back for a SQL comparison.
    */
    is_organiser: is_organiser === true,

    /*
    The ending, when there is one. A COMPLETE competition with one survivor has a winner; with
    none, everybody left went out together and there is no winner to name. Same three-way split as
    services/gameComplete.js, and for the same reason - it is what the data can actually say.
    */
    competition_complete: isComplete,
    winner_names: isComplete ? survivors_sample : null,
    is_draw: isComplete && survivors !== 1,

    // What happens next. All null when the competition has finished.
    next_round_number: next_round_number ? Number(next_round_number) : null,
    next_deadline: next_deadline || null,
    next_fixtures: next_fixtures || [],

    user_id
  };
}

/*
Matchday's half (docs/matchday.md §9.1). The same readiness as LMS, clause for clause: the highest
fully processed round, a next round with fixtures, not yet locked, ready recently, once per player
per round. What differs is who was in the round and what "already back in the app" means:

  - RECIPIENTS are the competition's members. Nobody is eliminated in Matchday and joining closes
    when round 1 locks (§6), so every member was in every settled round. There is no
    player_progress to read, and nothing to read it for.
  - ALREADY PREDICTED in the next round -> not sent, the counterpart of LMS's "already picked".
    Any one prediction counts: the player is in the app, and the table is on the screen they used.
  - NO ORGANISER EXEMPTION. LMS exempts the organiser because their copy carries the organiser
    block; Matchday's has none, so there is nothing for the exemption to protect.

A Matchday competition's final round leaves no next round, so it qualifies for nothing here -
the same as LMS, where game_complete owns the ending. Matchday's game_complete is not built yet;
until it is, the last round of a Matchday game sends no email.
*/
const MATCHDAY_ITEMS_SQL = `
    SELECT
      'matchday'             AS game_type,
      cu.user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      UPPER(c.status)        AS competition_status,
      c.end_value            AS rounds_total,

      last_round.id          AS round_id,
      last_round.round_number,
      last_round.settled_at,

      next_round.id           AS next_round_id,
      next_round.round_number AS next_round_number,
      next_round.lock_time    AS next_deadline,
      (
        SELECT json_agg(json_build_object(
                 'home', f.home_team,
                 'away', f.away_team,
                 'kickoff', f.kickoff_time
               ) ORDER BY f.kickoff_time, f.id)
        FROM fixture f WHERE f.round_id = next_round.id
      ) AS next_fixtures

    FROM competition c

    INNER JOIN LATERAL (
      SELECT
        r.id,
        r.round_number,
        (SELECT MAX(f2.processed) FROM fixture f2 WHERE f2.round_id = r.id) AS settled_at
      FROM round r
      WHERE r.competition_id = c.id
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id AND f.processed IS NULL)
      ORDER BY r.round_number DESC
      LIMIT 1
    ) last_round ON true

    LEFT JOIN LATERAL (
      SELECT r.id, r.round_number, r.lock_time, r.created_at
      FROM round r
      WHERE r.competition_id = c.id
        AND r.round_number = last_round.round_number + 1
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
      LIMIT 1
    ) next_round ON true

    INNER JOIN competition_user cu
      ON cu.competition_id = c.id
      AND cu.status = 'active'

    INNER JOIN app_user u
      ON u.id = cu.user_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE
      ${notArchivedSql('c')} AND
      ${isMatchdaySql('c')} AND
      next_round.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM prediction pr
        WHERE pr.round_id = next_round.id
          AND pr.user_id = cu.user_id
      )
      AND (
        next_round.lock_time IS NULL
        OR next_round.lock_time > NOW()
      )
      AND GREATEST(last_round.settled_at, next_round.created_at) > NOW() - ($3 || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.round_id = last_round.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      AND ($1::int IS NULL OR c.id = $1)

    ORDER BY c.id, u.id
`;

/**
 * Find every PERSON who should be told a round is settled, with every competition that has news
 * for them. One email per person across both games - docs/matchday.md §9.1, and
 * services/emailBundle.js for the grouping and the scope rule.
 *
 * The lead item is the one whose next round locks first: the email's most urgent job is the next
 * deadline. A finished-for-them LMS item (knocked out) sorts by the same next round, which still
 * exists for everybody else.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - only people with news in this competition
 * @returns {Promise<Array>} one candidate per person: the lead item's fields, plus `items`
 */
async function findCandidates(opts = {}) {
  const params = [null, groupFor(EMAIL_TYPE), String(ROUND_OVER_WINDOW_DAYS)];
  const [lms, matchday] = await Promise.all([
    findLmsItems(),
    query(MATCHDAY_ITEMS_SQL, params).then((result) => result.rows)
  ]);

  const deadline = (item) => (item.next_deadline ? new Date(item.next_deadline).getTime() : Infinity);

  return groupByPerson([...lms, ...matchday], {
    competitionId: opts.competition_id || null,
    order: (a, b) =>
      deadline(a) - deadline(b)
      || lmsFirst(a) - lmsFirst(b)
      || a.competition_id - b.competition_id
  });
}

/*
A person whose only news is one LMS competition: rendered exactly as before Matchday. A queued row
from before 2026-11-26 has no `items` and counts too.
*/
const isLegacyLms = (candidate) =>
  !candidate.items || (candidate.items.length === 1 && candidate.items[0].game_type === 'lms');

/** How many of the table's top rows the email shows. Everyone else sees their own line. */
const TABLE_TOP = 5;

/**
 * One Matchday competition's part of the email: this player's round, where they stand, and the
 * next round. Totals come from services/matchdayTable.js, the one place they are derived
 * (docs/matchday.md §4.2); the round's own breakdown is this player's settled predictions.
 */
async function matchdayItemData(item) {
  const own = await query(`
    SELECT
      COUNT(*)                                  AS predictions,
      COALESCE(SUM(points), 0)                  AS points,
      COUNT(*) FILTER (WHERE points = 3)        AS right_count,
      COUNT(*) FILTER (WHERE points = 1)        AS draw_count
    FROM prediction
    WHERE user_id = $1 AND round_id = $2
  `, [item.user_id, item.round_id]);

  const table = await getRecentMatchdayTable(item.competition_id);
  const rows = table ? table.rows : [];
  const mine = rows.find((r) => r.user_id === item.user_id) || null;
  const o = own.rows[0];

  return {
    game_type: 'matchday',
    competition_id: item.competition_id,
    competition_name: item.competition_name,
    round_id: item.round_id,
    round_number: Number(item.round_number),
    rounds_total: item.rounds_total ? Number(item.rounds_total) : null,

    predictions: Number(o.predictions) || 0,
    round_points: Number(o.points) || 0,
    right_count: Number(o.right_count) || 0,
    draw_count: Number(o.draw_count) || 0,

    position: mine ? mine.position : null,
    position_shared: mine ? rows.filter((r) => r.position === mine.position).length > 1 : false,
    total: mine ? mine.total : null,
    player_count: rows.length,
    table_top: rows.slice(0, TABLE_TOP).map((r) => ({
      position: r.position,
      display_name: r.display_name,
      total: r.total,
      is_me: r.user_id === item.user_id
    })),

    next_round_number: item.next_round_number ? Number(item.next_round_number) : null,
    next_deadline: item.next_deadline || null,
    next_fixtures: item.next_fixtures || []
  };
}

/**
 * Build the template data one email needs.
 *
 * A person whose only news is one LMS competition gets EXACTLY the data this built before Matchday
 * (lmsTemplateData, no `items`), so the template renders them the email it always has. Anyone else
 * gets `items`, one per competition in deadline order.
 *
 * @param {object} candidate - from findCandidates
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  if (isLegacyLms(candidate)) return lmsTemplateData(candidate);

  const { user_id, user_email, user_display_name, competition_id, round_id } = candidate;
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  const items = [];
  for (const item of candidate.items) {
    if (item.game_type === 'matchday') {
      items.push(await matchdayItemData(item));
    } else {
      const lms = await lmsTemplateData(item);
      delete lms.unsubscribe;
      delete lms.email_tracking_id;
      items.push({ game_type: 'lms', ...lms });
    }
  }

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${round_id}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    round_id,
    user_id,
    items
  };
}

/**
 * The subject for any Round Over, from its template data. One competition keeps its subject,
 * which names no game ("X — Round 3 results") and so serves both. More than one names neither
 * competition: there is no room for two names in what a phone shows.
 *
 * @param {object} templateData - as built by buildTemplateData
 * @returns {string}
 */
function subjectForData(templateData) {
  const { items } = templateData;
  if (!items) return subjectFor(templateData.competition_name, templateData.round_number);
  if (items.length === 1) return subjectFor(items[0].competition_name, items[0].round_number);
  return `Your results — ${items.length} competitions`;
}

/**
 * The push notification that goes WITH this email, for someone who has the app (2026-11-27).
 *
 * THE EMAIL IS THE MASTER. services/emailPush.js sends it only when this email was sent, and it
 * says what the email says: the subject as its title, the email's opening sentence - this player's
 * own round - as its body. The sentences are the template's own functions, not copies.
 *
 * THE TAP GOES WHERE THE EMAIL GOES. One competition: its page (`type: results` is not one the app
 * names, so it takes the default, the competition's own page - where the result and the next round
 * are). More than one: the email's button is the dashboard, so the push names no competition and
 * the app just opens.
 *
 * @param {object} templateData - as built by buildTemplateData
 * @returns {{type: string, title: string, body: string, data: object, record: object}}
 */
function pushFor(templateData) {
  // Required here, not at the top: emailService requires this file at load for its subjects.
  const { lmsRoundOverResultLine, matchdayRoundOverResultLine, roundOverBundleIntro } = require('./emailService');
  const { items } = templateData;
  const title = subjectForData(templateData);

  if (!items) {
    const record = {
      competition_id: templateData.competition_id,
      round_id: templateData.round_id,
      round_number: templateData.round_number
    };
    return { type: EMAIL_TYPE, title, body: lmsRoundOverResultLine(templateData), data: record, record };
  }

  const lead = items[0];
  const record = { competition_id: lead.competition_id, round_id: lead.round_id, round_number: lead.round_number };

  if (items.length === 1) {
    // A single item is always Matchday: one LMS competition is the no-`items` shape above.
    const body = lead.game_type === 'matchday'
      ? matchdayRoundOverResultLine(lead)
      : lmsRoundOverResultLine(lead);
    return { type: EMAIL_TYPE, title, body, data: record, record };
  }

  return { type: EMAIL_TYPE, title, body: roundOverBundleIntro(items), data: {}, record };
}

/**
 * Queue one email, and open its tracking row. One queue row per competition in the email - see
 * queueBundle in services/emailBundle.js.
 *
 * @param {object} candidate - from findCandidates
 * @returns {Promise<{success: boolean, queue_id?: number, queue_ids?: number[], template_data?: object, error?: string}>}
 */
async function queueCandidate(candidate) {
  try {
    const templateData = await buildTemplateData(candidate);
    const { queue_id, queue_ids } = await queueBundle({
      emailType: EMAIL_TYPE,
      candidate,
      templateData,
      subject: subjectForData(templateData)
    });
    return { success: true, queue_id, queue_ids, template_data: templateData };
  } catch (error) {
    console.error('roundOver.queueCandidate failed:', { competition_id: candidate.competition_id, user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  SAMPLE_SIZE,
  subjectFor,
  subjectForData,
  pushFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
