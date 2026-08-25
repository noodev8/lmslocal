/*
=======================================================================================================================================
Fixture Service: Core fixture management business logic
=======================================================================================================================================
Purpose: Decides which competitions may receive the staged batch, and pushes it to ONE of them.

         There is only ever one staged batch at a time per team list - add-staged-fixtures
         refuses a new one while fixture_load isn't empty - so there is no gameweek selection or
         catch-up queue here. The only questions are "who is allowed this batch" and "give it to
         this competition".

         PER COMPETITION, DELIBERATELY. This used to be one function that swept every subscribed
         competition in a single press, guarded only by FIXTURE_SERVICE_TEST_MODE - an env var
         naming one organiser's email, which had to be set before touching anything and unset
         afterwards, and which silently starved real customers of fixtures while it was on. The
         admin now pushes one competition at a time and reads each result, the same way results
         already worked (push-results-to-competition). A mis-staged batch can no longer reach
         every customer through one click, so the env var is gone.

         Eligibility lives in evaluateCompetition() and is used by BOTH the candidate list and
         the push, so the admin screen can never offer a button the push then refuses.
=======================================================================================================================================
*/

/**
 * How much notice a competition's *first* round must have. An organiser who creates a
 * competition has to be able to invite players before picks close, and until this existed a
 * competition created on Friday could be handed Saturday's matches - or matches that had
 * already kicked off - with no players in it yet. Later rounds are exempt: the players are
 * already there and the organiser chose the moment to push.
 */
const FIRST_ROUND_LEAD_TIME_HOURS = 48;
const FIRST_ROUND_LEAD_TIME_MS = FIRST_ROUND_LEAD_TIME_HOURS * 60 * 60 * 1000;

/*
 * NOTE ON THE TWO STARTING MODELS - see docs/competition-start.md.
 *
 * A competition created against a calendar block already HAS round 1: real fixtures, a real lock
 * time, from the moment it was created. It never reaches the ready_at / lead time / opens_gameweek
 * rules below, because those only apply to a competition with no round at all. What it needs
 * instead is RECONCILIATION - when its block is finally promoted and pushed, that provisional
 * round is refreshed from the confirmed batch rather than a second one being created.
 *
 * The rules below are therefore NOT dead. They still govern every competition created the old
 * way, and there are live ones waiting on the Ready button right now. Collapsing them, as the
 * design doc originally proposed, would hand those organisers a round they never asked for.
 * They go when the last ready_at competition has started, and not before.
 */

/**
 * Why a competition can't take the batch right now. These reach the admin screen as-is, so they
 * are written to be read by a person deciding what to do next, not parsed.
 */
const BLOCKED = {
  COMPETITION_COMPLETE: 'Competition has finished',
  ROUND_IN_PROGRESS: 'Current round is still being played',
  NO_STAGED_BATCH: 'Nothing staged for this team list',
  NOT_READY: 'Organiser has not pressed Ready',
  MID_GAMEWEEK: 'Batch continues a gameweek - cannot start a competition here',
  KICKOFF_PASSED: 'Batch has already kicked off',
  LEAD_TIME: `First round needs ${FIRST_ROUND_LEAD_TIME_HOURS} hours' notice`,
};

/**
 * Everything the eligibility rules need about one competition, and what the push needs after.
 * Loaded for a single competition or for a whole team list by the two callers below.
 */
async function loadCompetitionRoundState(client, competitionId, stagedBlockId = null) {
  const latestRoundResult = await client.query(
    `SELECT MAX(round_number) AS latest_round FROM round WHERE competition_id = $1`,
    [competitionId]
  );
  const latestRound = latestRoundResult.rows[0].latest_round;

  if (!latestRound) {
    // No rounds at all - the competition's first round.
    return { needsNewRound: true, roundNumber: null, roundState: 'no_round', provisionalRoundId: null };
  }

  // A round created from the very block now being pushed is provisional: it holds calendar
  // fixtures that this batch is the confirmed version of. It looks like 'round_in_progress'
  // - fixtures, no results - which would otherwise block the push and leave those players on
  // whatever was keyed weeks ago.
  if (stagedBlockId !== null) {
    const provisionalResult = await client.query(
      `SELECT r.id, r.round_number
       FROM round r
       WHERE r.competition_id = $1
         AND r.source_block_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM fixture f WHERE f.round_id = r.id AND f.result IS NOT NULL
         )
       ORDER BY r.round_number DESC
       LIMIT 1`,
      [competitionId, stagedBlockId]
    );

    if (provisionalResult.rows.length > 0) {
      return {
        needsNewRound: false,
        roundNumber: provisionalResult.rows[0].round_number,
        roundState: 'provisional_round',
        provisionalRoundId: provisionalResult.rows[0].id
      };
    }
  }

  const fixtureCheckResult = await client.query(
    `SELECT COUNT(*) AS total, COUNT(result) AS with_results
     FROM fixture f
     JOIN round r ON f.round_id = r.id
     WHERE r.competition_id = $1 AND r.round_number = $2`,
    [competitionId, latestRound]
  );

  const total = parseInt(fixtureCheckResult.rows[0].total);
  const withResults = parseInt(fixtureCheckResult.rows[0].with_results);

  // A round that exists but holds no fixtures is one waiting to be filled, not a new round.
  if (total === 0) return { needsNewRound: false, roundNumber: latestRound, roundState: 'blank_round', provisionalRoundId: null };
  if (withResults === total) return { needsNewRound: true, roundNumber: latestRound, roundState: 'round_complete', provisionalRoundId: null };
  return { needsNewRound: null, roundNumber: latestRound, roundState: 'round_in_progress', provisionalRoundId: null };
}

/**
 * The single implementation of "may this competition have this batch, and why not".
 *
 * @returns {{eligible: boolean, reason: string|null, needsNewRound: boolean|null,
 *            roundNumber: number|null, roundState: string, fixtures: Array, cutoff: Date}}
 */
function evaluateCompetition(competition, roundState, stagedFixtures, now = new Date()) {
  const base = { ...roundState, fixtures: [], cutoff: null };

  if (competition.status === 'COMPLETE') {
    return { ...base, eligible: false, reason: BLOCKED.COMPETITION_COMPLETE };
  }

  if (roundState.roundState === 'round_in_progress') {
    return { ...base, eligible: false, reason: BLOCKED.ROUND_IN_PROGRESS };
  }

  if (!stagedFixtures || stagedFixtures.length === 0) {
    return { ...base, eligible: false, reason: BLOCKED.NO_STAGED_BATCH };
  }

  // A provisional round is this batch's own earlier, unconfirmed self. It skips the first-round
  // rules entirely - the start date was chosen deliberately at creation and the players have been
  // looking at it ever since, so there is nothing left to protect them from. It still has to clear
  // the kickoff floor below, because a batch that has already started is no use to anyone.
  const isProvisional = roundState.roundState === 'provisional_round';

  // Everything below this point is about a competition's FIRST round. Once it has one, the
  // organiser is already in the rhythm and the only floor left is "not already kicked off".
  const isFirstRound = !isProvisional && !roundState.roundNumber;

  if (isFirstRound) {
    // The organiser says when they are ready, rather than guessing a date at creation. Until
    // they press it nothing is pushed, however long the competition has sat there.
    if (!competition.ready_at) {
      return { ...base, eligible: false, reason: BLOCKED.NOT_READY };
    }

    // A real gameweek spread over Fri-Sun is staged as several batches, one round each. Joining
    // at the Sunday batch would make round 1 the two matches nobody else's round 1 was, so a
    // competition can only start on a batch that opens a gameweek. Whoever stages it says which
    // those are - no kickoff pattern can tell them apart.
    if (stagedFixtures.some((fixture) => fixture.opens_gameweek === false)) {
      return { ...base, eligible: false, reason: BLOCKED.MID_GAMEWEEK };
    }
  }

  const earliestKickoff = stagedFixtures.reduce((earliest, fixture) => {
    const kickoff = new Date(fixture.kickoff_time);
    return !earliest || kickoff < earliest ? kickoff : earliest;
  }, null);

  // Two floors on the batch's earliest kickoff. A first round also needs enough notice for the
  // organiser to tell everyone; a later one only has to be a round players can still pick in.
  const cutoff = isFirstRound ? new Date(now.getTime() + FIRST_ROUND_LEAD_TIME_MS) : now;

  if (earliestKickoff < cutoff) {
    // A round created from a passed kickoff would be locked the moment it arrived - nobody
    // could pick in it. Reported apart from the lead time because the answers differ: stage a
    // later batch, versus wait for the next gameweek.
    const reason = earliestKickoff < now ? BLOCKED.KICKOFF_PASSED : BLOCKED.LEAD_TIME;
    return { ...base, eligible: false, reason, cutoff };
  }

  return { ...base, eligible: true, reason: null, fixtures: stagedFixtures, cutoff };
}

/** The staged batch for one team list, earliest kickoff first. */
async function loadStagedBatch(client, teamListId) {
  const result = await client.query(
    `SELECT fixture_id, team_list_id, league, home_team_short, away_team_short, kickoff_time,
            opens_gameweek, source_block_id
     FROM fixture_load
     WHERE team_list_id = $1
     ORDER BY kickoff_time`,
    [teamListId]
  );
  return result.rows;
}

/**
 * The calendar block a staged batch was promoted from, or null for one keyed by hand.
 *
 * Read from the rows rather than passed around, because every caller already has the batch. A
 * batch is one block by construction - promote-fixture-block writes the whole thing in one
 * transaction - so the first row speaks for all of them.
 */
function stagedBlockId(stagedFixtures) {
  return stagedFixtures.length > 0 ? (stagedFixtures[0].source_block_id ?? null) : null;
}

/**
 * Every competition subscribed to a team list, with a verdict on each.
 *
 * Blocked competitions are returned rather than filtered out. A competition that simply vanishes
 * from the admin screen looks like a bug, and "why didn't that one get its fixtures?" is the
 * question this list exists to answer without anyone opening a database.
 *
 * @returns {Promise<Array>} one row per competition, eligible or not
 */
async function getFixturePushCandidates(client, teamListId) {
  const competitionsResult = await client.query(
    `SELECT c.id, c.name, c.status, c.team_list_id, c.ready_at,
            u.email AS organiser_email, u.display_name AS organiser_name,
            COUNT(cu.user_id) AS players,
            COUNT(cu.user_id) FILTER (WHERE cu.status = 'active') AS active_players
     FROM competition c
     JOIN app_user u ON u.id = c.organiser_id
     LEFT JOIN competition_user cu ON cu.competition_id = c.id
     WHERE c.fixture_service = true AND c.team_list_id = $1
       -- A finished competition can never take another round, and unlike every other skip
       -- reason that will never change - so it is not an answer to "why didn't that one get
       -- its fixtures?", just a row you cannot press. evaluateCompetition still refuses it
       -- (BLOCKED.COMPETITION_COMPLETE), which is what guards the push itself.
       AND UPPER(c.status) <> 'COMPLETE'
     GROUP BY c.id, u.email, u.display_name
     ORDER BY c.id`,
    [teamListId]
  );

  const stagedFixtures = await loadStagedBatch(client, teamListId);
  const blockId = stagedBlockId(stagedFixtures);
  const now = new Date();
  const candidates = [];

  for (const competition of competitionsResult.rows) {
    const roundState = await loadCompetitionRoundState(client, competition.id, blockId);
    const verdict = evaluateCompetition(competition, roundState, stagedFixtures, now);

    candidates.push({
      competition_id: competition.id,
      name: competition.name,
      organiser_email: competition.organiser_email,
      organiser_name: competition.organiser_name,
      players: parseInt(competition.players) || 0,
      active_players: parseInt(competition.active_players) || 0,
      round_number: roundState.roundNumber,
      round_state: roundState.roundState,
      ready_at: competition.ready_at,
      eligible: verdict.eligible,
      reason: verdict.reason,
    });
  }

  return {
    staged_total: stagedFixtures.length,
    earliest_kickoff: stagedFixtures.length > 0 ? stagedFixtures[0].kickoff_time : null,
    competitions: candidates,
  };
}

/**
 * Pushes the staged batch to ONE competition: creates or fills its round, inserts the fixtures,
 * queues notifications, writes the audit row.
 *
 * Does not touch fixture_load. The other subscribed competitions still need those rows, so
 * clearing the batch is its own deliberate step (/admin/clear-staged-batch) - the same shape as
 * push-results-to-competition.
 *
 * @throws {Error} COMPETITION_NOT_FOUND, NOT_SUBSCRIBED, or a NOT_ELIGIBLE:<reason> error
 * @returns {Promise<object>} what was created, for the admin screen to report
 */
async function pushFixturesToCompetition(client, competitionId) {
  const competitionResult = await client.query(
    `SELECT id, name, status, team_list_id, ready_at, fixture_service
     FROM competition WHERE id = $1`,
    [competitionId]
  );

  if (competitionResult.rows.length === 0) throw new Error('COMPETITION_NOT_FOUND');
  const competition = competitionResult.rows[0];

  if (competition.fixture_service !== true) throw new Error('NOT_SUBSCRIBED');

  const stagedFixtures = await loadStagedBatch(client, competition.team_list_id);
  const roundState = await loadCompetitionRoundState(
    client, competitionId, stagedBlockId(stagedFixtures)
  );
  const verdict = evaluateCompetition(competition, roundState, stagedFixtures);

  // Re-checked here rather than trusted from the screen: the list may have been loaded minutes
  // ago, and a round can start or a kickoff pass in between.
  if (!verdict.eligible) {
    const error = new Error(`NOT_ELIGIBLE`);
    error.reason = verdict.reason;
    throw error;
  }

  const fixturesToPush = verdict.fixtures;
  const teamListId = competition.team_list_id;

  // The round's lock time is the batch's earliest kickoff - every fixture in a batch shares one
  // deadline, which is why a Fri-Sun gameweek is staged as several batches.
  const earliestKickoff = fixturesToPush.reduce((earliest, fixture) => {
    if (!earliest || new Date(fixture.kickoff_time) < new Date(earliest)) return fixture.kickoff_time;
    return earliest;
  }, null);

  let targetRoundId;
  let targetRoundNumber;
  let roundAction;

  if (roundState.provisionalRoundId) {
    // Reconcile: this round already holds the calendar's provisional version of these fixtures,
    // and its players have been looking at them since the competition was created. Replace them
    // with the confirmed batch and move the lock time to match.
    //
    // Fixtures are deleted and re-inserted rather than updated in place. A moved kickoff is the
    // easy case; a fixture dropped or added between keying and confirmation is the one that
    // matters, and there is no stable identity to match on across that.
    //
    // Picks are deliberately left alone. A pick on a team still in the batch is unaffected; a
    // pick on a team whose fixture has gone is the manual case in docs/competition-start.md,
    // which is operator-fixed by hand for now. Deleting picks here would silently throw away a
    // player's choice on every reconcile, which is far worse than the rare orphan.
    targetRoundId = roundState.provisionalRoundId;
    targetRoundNumber = roundState.roundNumber;
    roundAction = 'reconciled';

    await client.query(`DELETE FROM fixture WHERE round_id = $1`, [targetRoundId]);

    // Existing picks point at the fixture rows just deleted, and push-results-to-competition
    // resolves a pick by p.fixture_id. Left as they were, every player who picked before their
    // round was confirmed would go unmatched when results came in - read as a missed pick, and
    // charged a life for it. Cleared here and re-pointed after the new fixtures are in.
    await client.query(`UPDATE pick SET fixture_id = NULL WHERE round_id = $1`, [targetRoundId]);

    // source_block_id is cleared with the same statement that moves the lock time: once the
    // confirmed batch is in, this round is no longer provisional and must not be reconciled a
    // second time. Leaving it set made a repeat push look like another confirmation.
    await client.query(
      `UPDATE round SET lock_time = $1, source_block_id = NULL WHERE id = $2`,
      [earliestKickoff, targetRoundId]
    );
  } else if (roundState.needsNewRound) {
    const newRoundResult = await client.query(
      `INSERT INTO round (competition_id, round_number, lock_time, created_at)
       SELECT $1, COALESCE(MAX(r.round_number), 0) + 1, $2, CURRENT_TIMESTAMP
       FROM competition c
       LEFT JOIN round r ON r.competition_id = c.id
       WHERE c.id = $1
       GROUP BY c.id
       RETURNING id, round_number`,
      [competitionId, earliestKickoff]
    );
    targetRoundId = newRoundResult.rows[0].id;
    targetRoundNumber = newRoundResult.rows[0].round_number;
    roundAction = 'created';
  } else {
    const existingRoundResult = await client.query(
      `SELECT id, round_number FROM round WHERE competition_id = $1 AND round_number = $2`,
      [competitionId, roundState.roundNumber]
    );
    targetRoundId = existingRoundResult.rows[0].id;
    targetRoundNumber = existingRoundResult.rows[0].round_number;
    roundAction = 'populated';

    await client.query(`UPDATE round SET lock_time = $1 WHERE id = $2`, [earliestKickoff, targetRoundId]);
  }

  const teamLookupResult = await client.query(
    `SELECT short_name, name FROM team WHERE team_list_id = $1 AND is_active = true`,
    [teamListId]
  );
  const teamMap = {};
  teamLookupResult.rows.forEach((team) => {
    teamMap[team.short_name] = team.name;
  });

  for (const fixture of fixturesToPush) {
    const homeTeamFull = teamMap[fixture.home_team_short] || fixture.home_team_short;
    const awayTeamFull = teamMap[fixture.away_team_short] || fixture.away_team_short;

    await client.query(
      `INSERT INTO fixture (
         round_id, competition_id, home_team, away_team,
         home_team_short, away_team_short, kickoff_time, round_number, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        targetRoundId,
        competitionId,
        homeTeamFull,
        awayTeamFull,
        fixture.home_team_short,
        fixture.away_team_short,
        fixture.kickoff_time,
        targetRoundNumber,
      ]
    );
  }

  if (roundAction === 'reconciled') {
    // Re-point the picks cleared above at the confirmed fixtures, matched on the team the player
    // actually chose - the only identity that survives a fixture being re-keyed.
    //
    // A pick whose team is no longer playing this round keeps fixture_id NULL. That is the
    // postponement case docs/competition-start.md leaves to the operator by hand; NULL is the
    // honest record of it, and every reader of pick.fixture_id LEFT JOINs.
    await client.query(
      `UPDATE pick p
       SET fixture_id = f.id
       FROM fixture f
       WHERE p.round_id = $1
         AND f.round_id = $1
         AND (f.home_team_short = p.team OR f.away_team_short = p.team)`,
      [targetRoundId]
    );
  }

  // NEW_ROUND: one pending notification per user across all competitions, so someone in four
  // competitions gets one nudge rather than four. Needs a device token to be worth queueing.
  await client.query(
    `INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
     SELECT cu.user_id, 'new_round', $1, $2, $3, 'pending', NOW()
     FROM competition_user cu
     JOIN app_user au ON au.id = cu.user_id
     WHERE cu.competition_id = $1
       AND cu.status = 'active'
       AND cu.hidden IS NOT TRUE
       AND au.email NOT LIKE '%@lms-guest.%'
       AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = cu.user_id)
       AND NOT EXISTS (
         SELECT 1 FROM mobile_notification_queue mnq
         WHERE mnq.user_id = cu.user_id AND mnq.type = 'new_round' AND mnq.status = 'pending'
       )`,
    [competitionId, targetRoundId, targetRoundNumber]
  );

  // PICK_REMINDER: per competition, sent when within 24h of lock_time.
  await client.query(
    `INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
     SELECT cu.user_id, 'pick_reminder', $1, $2, $3, 'pending', NOW()
     FROM competition_user cu
     JOIN app_user au ON au.id = cu.user_id
     WHERE cu.competition_id = $1
       AND cu.status = 'active'
       AND cu.hidden IS NOT TRUE
       AND au.email NOT LIKE '%@lms-guest.%'
       AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = cu.user_id)
       AND NOT EXISTS (
         SELECT 1 FROM mobile_notification_queue mnq
         WHERE mnq.user_id = cu.user_id AND mnq.type = 'pick_reminder'
           AND mnq.competition_id = $1 AND mnq.round_id = $2
       )`,
    [competitionId, targetRoundId, targetRoundNumber]
  );

  await client.query(
    `INSERT INTO audit_log (competition_id, user_id, action, details)
     VALUES ($1, NULL, 'Fixtures Pushed', $2)`,
    [
      competitionId,
      `Fixture service ${roundAction} Round ${targetRoundNumber} with ${fixturesToPush.length} fixtures`,
    ]
  );

  return {
    competition_id: competitionId,
    competition_name: competition.name,
    round_number: targetRoundNumber,
    round_action: roundAction,
    fixtures_pushed: fixturesToPush.length,
  };
}

/**
 * What one organiser should be told about their next round.
 *
 * Deliberately the same evaluateCompetition() the admin screen and the push use, rather than a
 * second reading of the rules written for the player-facing side. If the organiser is shown a
 * date, it is the date the push would actually produce.
 *
 * **Evaluated as though they were already ready**, which is the whole point: an organiser about to
 * press Ready needs to know what pressing it does, and asking them to commit first and find out
 * afterwards is the one thing this feature exists to avoid. Every other rule still applies to the
 * hypothetical - a mid-gameweek batch or one kicking off inside the lead time gives no date here
 * either, because it would give them no round.
 *
 * @returns {Promise<object>} starts_at is the kickoff their first round would have, ready or not;
 *   null when there is no batch they could start on, which is exactly when waiting_for_fixtures is
 *   true. fixtures is the batch behind that date - empty whenever starts_at is null, since there is
 *   nothing to preview. can_start gates the Ready button; blocked_reason and current_batch_kickoff
 *   say why not, and when to come back if we know.
 */
async function getCompetitionStartOutlook(client, competitionId) {
  const competitionResult = await client.query(
    `SELECT id, name, status, team_list_id, ready_at, fixture_service
     FROM competition WHERE id = $1`,
    [competitionId]
  );

  if (competitionResult.rows.length === 0) return null;
  const competition = competitionResult.rows[0];

  const stagedFixtures = await loadStagedBatch(client, competition.team_list_id);
  const roundState = await loadCompetitionRoundState(
    client, competitionId, stagedBlockId(stagedFixtures)
  );
  const verdict = evaluateCompetition(
    { ...competition, ready_at: competition.ready_at || new Date() },
    roundState,
    stagedFixtures
  );

  // The organiser cannot press Ready unless we can actually give them a round, so the screen needs
  // to tell two refusals apart. A staged batch they can't have (mid-gameweek, or too close to
  // kickoff) has a date attached, so we can say when to come back. An empty staging table has no
  // date at all - the next batch arrives when it is entered by hand - so we say only that there is
  // nothing for them yet, and promise nothing.
  const batchKickoff = stagedFixtures.length > 0 ? stagedFixtures[0].kickoff_time : null;

  return {
    ready_at: competition.ready_at,
    starts_at: verdict.eligible ? stagedFixtures[0].kickoff_time : null,
    waiting_for_fixtures: !verdict.eligible,
    can_start: verdict.eligible,
    blocked_reason: verdict.eligible ? null : verdict.reason,
    current_batch_kickoff: verdict.eligible ? null : batchKickoff,
    // Only when eligible: an ineligible batch is not the one they would get, so showing it would
    // preview a round that is never going to happen.
    fixtures: verdict.eligible
      ? stagedFixtures.map(f => ({
          home_team: f.home_team_short,
          away_team: f.away_team_short,
          kickoff_time: f.kickoff_time,
        }))
      : [],
  };
}

module.exports = {
  getFixturePushCandidates,
  pushFixturesToCompetition,
  getCompetitionStartOutlook,
  FIRST_ROUND_LEAD_TIME_HOURS,
  BLOCKED,
};
