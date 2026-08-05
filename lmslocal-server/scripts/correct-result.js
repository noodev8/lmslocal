/*
=======================================================================================================================================
Script: correct-result.js
=======================================================================================================================================
Purpose: Change a result that has already been processed, and bring every record that derives
         from it back into line. This is the tooling for docs/results-processing-correction.md -
         read that first; it carries the reasoning, this carries the mechanics.

         A correction is NOT an undo. Nothing is unwound: the round stays processed, the fixtures
         stay claimed, picks stay where they are, no-pick penalties stay applied, team
         availability is never touched. It is a forward action - restate the result, revise the
         affected history rows, then rebuild lives, status and completion from that history.

Usage:
  # assess (read-only) - one fixture in one competition
  node scripts/correct-result.js --fixture 1909 --result DRAW

  # assess - the same real-world match across every competition that took it
  node scripts/correct-result.js --teams ARS-COV --kickoff "2026-08-21 19:00" --result DRAW

  # apply - re-assesses first, then writes, one transaction per competition
  node scripts/correct-result.js --fixture 1909 --result DRAW --apply

  # health check - stored lives/status vs lives/status derived from history
  node scripts/correct-result.js --verify
  node scripts/correct-result.js --verify --competition 199

Options:
  --fixture <id>          address one fixture directly (single competition)
  --teams <HOME-AWAY>     address by team pairing, e.g. ARS-COV
  --kickoff <timestamp>   required with --teams; matches fixture.kickoff_time exactly
  --result <TEAM|DRAW>    the result the fixture should have had (team short code, or DRAW)
  --apply                 write the correction (default is assess only)
  --verify                run the health check instead of a correction
  --competition <id>      limit --verify to one competition
=======================================================================================================================================
*/

require('dotenv').config();
const { query, transaction, pool } = require('../database');

// ========================================
// ARGUMENT PARSING
// ========================================

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const has = (name) => args.includes(`--${name}`);

const opts = {
  fixtureId: flag('fixture') ? parseInt(flag('fixture'), 10) : null,
  teams: flag('teams'),
  kickoff: flag('kickoff'),
  newResult: flag('result'),
  apply: has('apply'),
  verify: has('verify'),
  competitionId: flag('competition') ? parseInt(flag('competition'), 10) : null
};

// ========================================
// HEALTH CHECK (docs section 7)
// ========================================

// The derivation that powers the rebuild, run as a check. Any mismatch is either a bug or a
// manual lives adjustment - both worth knowing about before and after a correction.
const verify = async () => {
  const result = await query(`
    WITH derived AS (
      SELECT cu.competition_id,
             cu.user_id,
             cu.lives_remaining,
             cu.status,
             c.lives_per_player,
             count(*) FILTER (WHERE pp.outcome = 'LOSE') AS losses
      FROM competition_user cu
      JOIN competition c ON c.id = cu.competition_id
      LEFT JOIN player_progress pp
             ON pp.player_id = cu.user_id
            AND pp.competition_id = cu.competition_id
      -- Sweeping the whole platform is limited to live competitions, where a mismatch still
      -- matters. A named competition is checked whatever its status: after a correction the
      -- competition is often COMPLETE, and that is exactly when the check is wanted.
      WHERE (c.status IN ('SETUP','ACTIVE') OR cu.competition_id = $1)
        AND ($1::integer IS NULL OR cu.competition_id = $1)
      GROUP BY cu.competition_id, cu.user_id, cu.lives_remaining, cu.status, c.lives_per_player
    )
    SELECT competition_id, user_id, lives_remaining, status, lives_per_player, losses
    FROM derived
    WHERE lives_remaining <> GREATEST(lives_per_player - losses, 0)
       OR status <> CASE WHEN losses > lives_per_player THEN 'out' ELSE 'active' END
    ORDER BY competition_id, user_id
  `, [opts.competitionId]);

  if (result.rows.length === 0) {
    console.log('Health check: no mismatches. Stored lives and status agree with history everywhere checked.');
    return;
  }

  console.log(`Health check: ${result.rows.length} mismatch(es) - each is a bug or a manual adjustment.\n`);
  for (const row of result.rows) {
    const expectedLives = Math.max(row.lives_per_player - Number(row.losses), 0);
    const expectedStatus = Number(row.losses) > row.lives_per_player ? 'out' : 'active';
    console.log(`  competition ${row.competition_id} player ${row.user_id}: ` +
      `stored ${row.lives_remaining} lives / ${row.status}, ` +
      `derived ${expectedLives} lives / ${expectedStatus} (${row.losses} losses, ${row.lives_per_player} starting)`);
  }
};

// ========================================
// ADDRESSING (docs section 5)
// ========================================

// Round numbers are per competition and diverge, so a real-world match is identified by team
// pairing and kickoff time - the same key the push matched on. Run backwards, it finds the
// fixture row in every competition that took that push.
const findFixtures = async () => {
  if (opts.fixtureId) {
    const result = await query(`SELECT id FROM fixture WHERE id = $1`, [opts.fixtureId]);
    if (result.rows.length === 0) throw new Error(`Fixture ${opts.fixtureId} not found`);
    return [opts.fixtureId];
  }

  const [home, away] = opts.teams.split('-');
  if (!home || !away) throw new Error('--teams must look like ARS-COV');

  const result = await query(`
    SELECT f.id
    FROM fixture f
    JOIN round r ON r.id = f.round_id
    WHERE f.home_team_short = $1
      AND f.away_team_short = $2
      AND f.kickoff_time = $3::timestamptz
    ORDER BY r.competition_id
  `, [home.toUpperCase(), away.toUpperCase(), opts.kickoff]);

  if (result.rows.length === 0) {
    throw new Error(`No fixture found for ${home}-${away} at ${opts.kickoff}`);
  }
  return result.rows.map(row => row.id);
};

// ========================================
// PHASE ONE - ASSESS (read-only, writes nothing)
// ========================================

const assess = async (fixtureId, newResult) => {
  const report = { fixtureId, newResult, blockers: [], warnings: [], players: [], noop: false };

  const fixtureResult = await query(`
    SELECT f.id, f.result, f.processed, f.kickoff_time,
           f.home_team_short, f.away_team_short,
           r.id AS round_id, r.round_number, r.competition_id,
           c.name AS competition_name, c.status AS competition_status,
           c.winner_id, c.lives_per_player
    FROM fixture f
    JOIN round r ON r.id = f.round_id
    JOIN competition c ON c.id = r.competition_id
    WHERE f.id = $1
  `, [fixtureId]);

  if (fixtureResult.rows.length === 0) {
    report.blockers.push(`Fixture ${fixtureId} not found`);
    return report;
  }

  const fixture = fixtureResult.rows[0];
  Object.assign(report, {
    competitionId: fixture.competition_id,
    competitionName: fixture.competition_name,
    competitionStatus: fixture.competition_status,
    winnerId: fixture.winner_id,
    roundNumber: fixture.round_number,
    pairing: `${fixture.home_team_short} v ${fixture.away_team_short}`,
    currentResult: fixture.result
  });

  // The result must name a team in this fixture, or be a draw.
  const valid = [fixture.home_team_short, fixture.away_team_short, 'DRAW'];
  if (!valid.includes(newResult)) {
    // Return immediately - every projection below is computed against this value, and showing a
    // player impact derived from a result the fixture cannot have had is worse than showing none.
    report.blockers.push(`Result must be one of ${valid.join(', ')} - got "${newResult}"`);
    return report;
  }

  // An unprocessed fixture is not a correction case: the organiser can simply edit the result,
  // and nothing has moved yet. Sending it through here would leave it unprocessed with a new
  // result and no player effect, which looks fixed and is not.
  if (fixture.processed === null) {
    report.blockers.push('Fixture is not processed - edit the result normally instead');
  }

  if (fixture.result === newResult) {
    report.noop = true;
    return report;
  }

  // Only the most recently processed round may be corrected. Anything earlier cannot be resolved
  // automatically in either direction - a resurrected player has no picks in the rounds since,
  // and a newly eliminated one has picks they should never have been allowed to make. Both need
  // a human. Rounds above with no processed fixtures are fine: pushing fixtures creates rounds
  // cheaply, so an empty next round often sits waiting.
  const laterProcessed = await query(`
    SELECT r.round_number, count(f.id) FILTER (WHERE f.processed IS NOT NULL) AS processed_count
    FROM round r
    LEFT JOIN fixture f ON f.round_id = r.id
    WHERE r.competition_id = $1 AND r.round_number > $2
    GROUP BY r.round_number
    HAVING count(f.id) FILTER (WHERE f.processed IS NOT NULL) > 0
  `, [fixture.competition_id, fixture.round_number]);

  for (const row of laterProcessed.rows) {
    report.blockers.push(
      `Round ${row.round_number} already has ${row.processed_count} processed fixture(s) - ` +
      `only the most recently processed round can be corrected`
    );
  }

  // A locked round above means players have already picked for it. Resurrecting someone there
  // hands them a no-pick penalty for a round they were barred from - one mistake becoming two.
  const roundAbove = await query(`
    SELECT r.round_number, r.lock_time,
           (SELECT count(*) FROM pick p WHERE p.round_id = r.id) AS picks
    FROM round r
    WHERE r.competition_id = $1 AND r.round_number = $2
  `, [fixture.competition_id, fixture.round_number + 1]);

  if (roundAbove.rows.length > 0 && Number(roundAbove.rows[0].picks) > 0) {
    report.warnings.push(
      `Round ${roundAbove.rows[0].round_number} already has ${roundAbove.rows[0].picks} pick(s) - ` +
      `a resurrected player had no chance to pick in it`
    );
  }

  // Manual lives adjustments leave no history row, so the rebuild will overwrite them. Warn and
  // continue - refusing would block a real fix for a rare, easily repaired side effect.
  // Detection is awkward: the audit action embeds the player name, so match on the prefix.
  const manualAdjustments = await query(`
    SELECT action, details, created_at
    FROM audit_log
    WHERE competition_id = $1 AND action ILIKE 'Lives set%'
    ORDER BY created_at DESC
  `, [fixture.competition_id]);

  for (const row of manualAdjustments.rows) {
    report.warnings.push(`Manual lives adjustment on record - "${row.action}" (${row.details || 'no detail'}) - the rebuild may overwrite it`);
  }

  // Affected players: one pick per player per round, so each has exactly one on this fixture.
  const picks = await query(`
    SELECT p.id AS pick_id, p.user_id, p.team, p.outcome AS pick_outcome,
           au.display_name,
           cu.lives_remaining, cu.status,
           pp.id AS progress_id, pp.outcome AS progress_outcome,
           (SELECT count(*) FROM player_progress x
             WHERE x.competition_id = p.competition_id
               AND x.player_id = p.user_id
               AND x.outcome = 'LOSE') AS losses_now
    FROM pick p
    JOIN app_user au ON au.id = p.user_id
    LEFT JOIN competition_user cu ON cu.competition_id = $2 AND cu.user_id = p.user_id
    LEFT JOIN player_progress pp ON pp.fixture_id = p.fixture_id AND pp.player_id = p.user_id
    WHERE p.fixture_id = $1
    ORDER BY au.display_name
  `, [fixtureId, fixture.competition_id]);

  const outcomeFor = (team) => (newResult === 'DRAW' || team !== newResult) ? 'LOSE' : 'WIN';
  const livesFor = (losses) => Math.max(fixture.lives_per_player - losses, 0);
  const statusFor = (losses) => (losses > fixture.lives_per_player ? 'out' : 'active');

  for (const pick of picks.rows) {
    const before = pick.progress_outcome || pick.pick_outcome;
    const after = outcomeFor(pick.team);

    // The rebuild derives from history, so the delta that matters is the history row's outcome.
    const lossesNow = Number(pick.losses_now);
    let lossesAfter = lossesNow;
    if (before === 'LOSE' && after === 'WIN') lossesAfter -= 1;
    if (before !== 'LOSE' && after === 'LOSE') lossesAfter += 1;

    // Every processed pick gets a history row, and the rebuild derives lives from history alone.
    // A pick without one means the rebuild would silently ignore this player's outcome, so refuse
    // rather than write a correction that only half lands.
    if (pick.progress_id === null) {
      report.blockers.push(`${pick.display_name} (${pick.user_id}) has a pick on this fixture but no history row - fix by hand`);
    }

    // "Lives after" comes from history, "lives before" is what is stored. If those already
    // disagree, part of what the operator is about to see is the rebuild repairing existing
    // drift, not the correction - say so, or they will attribute it to the change they asked for.
    if (livesFor(lossesNow) !== pick.lives_remaining || statusFor(lossesNow) !== pick.status) {
      report.warnings.push(
        `${pick.display_name} (${pick.user_id}) is already out of step with history ` +
        `(stored ${pick.lives_remaining}/${pick.status}, derived ${livesFor(lossesNow)}/${statusFor(lossesNow)}) - ` +
        `the rebuild will repair that too, independently of this correction`
      );
    }

    report.players.push({
      userId: pick.user_id,
      name: pick.display_name,
      team: pick.team,
      pickId: pick.pick_id,
      progressId: pick.progress_id,
      outcomeBefore: before,
      outcomeAfter: after,
      livesBefore: pick.lives_remaining,
      livesAfter: livesFor(lossesAfter),
      statusBefore: pick.status,
      statusAfter: statusFor(lossesAfter)
    });
  }

  // Completion is rebuilt from the resulting active count, so work out that count with the
  // corrected statuses applied. Steps that "look like nothing changed" still matter here - one
  // flipped player can uncomplete a competition.
  const activeNow = await query(`
    SELECT user_id FROM competition_user WHERE competition_id = $1 AND status = 'active'
  `, [fixture.competition_id]);

  const activeAfter = new Set(activeNow.rows.map(row => row.user_id));
  for (const player of report.players) {
    if (player.statusAfter === 'active') activeAfter.add(player.userId);
    else activeAfter.delete(player.userId);
  }

  // The round must be fully processed before a competition may complete - the same gate the
  // process routes use. Reopening is not gated: if more than one player is active, a COMPLETE
  // competition is wrong whatever the round's state.
  const roundState = await query(`
    SELECT count(*) AS total, count(processed) AS processed
    FROM fixture WHERE round_id = $1
  `, [fixture.round_id]);
  const roundComplete = Number(roundState.rows[0].total) > 0 &&
                        Number(roundState.rows[0].total) === Number(roundState.rows[0].processed);

  const activeCount = activeAfter.size;
  let statusAfter = fixture.competition_status;
  let winnerAfter = fixture.winner_id;

  if (activeCount <= 1 && roundComplete) {
    statusAfter = 'COMPLETE';
    winnerAfter = activeCount === 1 ? [...activeAfter][0] : null;
  } else if (activeCount > 1) {
    statusAfter = fixture.competition_status === 'COMPLETE' ? 'ACTIVE' : fixture.competition_status;
    winnerAfter = null;
  }

  Object.assign(report, {
    roundId: fixture.round_id,
    roundComplete,
    activeCountAfter: activeCount,
    competitionStatusAfter: statusAfter,
    winnerAfterId: winnerAfter,
    livesPerPlayer: fixture.lives_per_player
  });

  return report;
};

// ========================================
// PHASE TWO - APPLY (one transaction per competition)
// ========================================

const apply = async (report) => {
  await transaction(async (client) => {
    // 1. The fixture stays processed. That is what keeps the round out of reach of the process
    //    routes - there is no window in which a second process run could claim it.
    await client.query(`UPDATE fixture SET result = $2 WHERE id = $1`, [report.fixtureId, report.newResult]);

    const affectedIds = report.players.map(p => p.userId);

    for (const player of report.players) {
      // 2. Recompute the outcome stamped on the pick.
      await client.query(`UPDATE pick SET outcome = $2 WHERE id = $1`, [player.pickId, player.outcomeAfter]);

      // 3. Revise the history row. The only thing in the system permitted to do this - see the
      //    logic doc: history is append-only *during processing*. No-pick rows carry no fixture
      //    and are matched out by fixture_id, so they are never touched.
      if (player.progressId !== null) {
        await client.query(
          `UPDATE player_progress SET outcome = $2 WHERE id = $1`,
          [player.progressId, player.outcomeAfter]
        );
      }
    }

    // 4. Rebuild lives and status from history for the affected players only. Idempotent, needs
    //    no knowledge of the previous value, and handles resurrection and new elimination without
    //    anyone computing a delta. Limited to affected players so an unrelated manual adjustment
    //    elsewhere in the competition is left alone.
    if (affectedIds.length > 0) {
      await client.query(`
        UPDATE competition_user cu
        SET lives_remaining = GREATEST(c.lives_per_player - d.losses, 0),
            status = CASE WHEN d.losses > c.lives_per_player THEN 'out' ELSE 'active' END
        FROM competition c,
             (SELECT u.user_id,
                     (SELECT count(*) FROM player_progress pp
                       WHERE pp.competition_id = $1
                         AND pp.player_id = u.user_id
                         AND pp.outcome = 'LOSE') AS losses
                FROM unnest($2::integer[]) AS u(user_id)) d
        WHERE cu.competition_id = $1
          AND cu.user_id = d.user_id
          AND c.id = $1
      `, [report.competitionId, affectedIds]);
    }

    // 5. Rebuild completion and winner. Never skipped - a correction that flips one player can
    //    uncomplete a competition, and reopening means status back to ACTIVE with a null winner.
    if (report.competitionStatusAfter !== report.competitionStatus ||
        report.winnerAfterId !== report.winnerId) {
      await client.query(
        `UPDATE competition SET status = $2, winner_id = $3 WHERE id = $1`,
        [report.competitionId, report.competitionStatusAfter, report.winnerAfterId]
      );
    }

    // 6. The narrative of actions stays append-only even though a row was revised.
    const detail = report.players.length === 0
      ? 'no players picked this fixture'
      : report.players.map(p =>
          `${p.name} (${p.userId}) ${p.team}: ${p.outcomeBefore}->${p.outcomeAfter}, ` +
          `lives ${p.livesBefore}->${p.livesAfter}, ${p.statusBefore}->${p.statusAfter}`
        ).join('; ');

    await client.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, NULL, 'Result Corrected', $2)
    `, [
      report.competitionId,
      `Round ${report.roundNumber} ${report.pairing} (fixture ${report.fixtureId}): ` +
      `result ${report.currentResult} -> ${report.newResult}. ${detail}. ` +
      `Competition ${report.competitionStatus} -> ${report.competitionStatusAfter}, ` +
      `winner ${report.winnerId ?? 'none'} -> ${report.winnerAfterId ?? 'none'}`
    ]);
  });
};

// ========================================
// REPORTING
// ========================================

const printReport = (report) => {
  console.log(`\n--- Competition ${report.competitionId} ${report.competitionName ? `"${report.competitionName}"` : ''} ---`);
  console.log(`Fixture ${report.fixtureId} ${report.pairing || ''} (round ${report.roundNumber ?? '?'})`);
  console.log(`Result: ${report.currentResult ?? 'none'} -> ${report.newResult}`);

  if (report.noop) {
    console.log('Nothing to do - the fixture already has this result.');
    return;
  }

  for (const blocker of report.blockers) console.log(`  BLOCKED: ${blocker}`);
  for (const warning of report.warnings) console.log(`  WARNING: ${warning}`);

  // Assessment bailed out before projecting anything - there is no impact to show.
  if (report.activeCountAfter === undefined) return;

  if (report.players.length === 0) {
    console.log('  No players picked this fixture - nothing to change but completion.');
  }
  for (const player of report.players) {
    const resurrection = player.statusBefore === 'out' && player.statusAfter === 'active' ? '  <- RESURRECTED' : '';
    const elimination = player.statusBefore === 'active' && player.statusAfter === 'out' ? '  <- ELIMINATED' : '';
    console.log(
      `  ${player.name} (${player.userId}) picked ${player.team}: ` +
      `${player.outcomeBefore} -> ${player.outcomeAfter}, ` +
      `lives ${player.livesBefore} -> ${player.livesAfter}, ` +
      `${player.statusBefore} -> ${player.statusAfter}${resurrection}${elimination}`
    );
  }

  console.log(`  Active after: ${report.activeCountAfter}. ` +
    `Competition ${report.competitionStatus} -> ${report.competitionStatusAfter}, ` +
    `winner ${report.winnerId ?? 'none'} -> ${report.winnerAfterId ?? 'none'}`);
};

// ========================================
// MAIN
// ========================================

const main = async () => {
  if (opts.verify) {
    await verify();
    return;
  }

  if (!opts.newResult) throw new Error('--result is required (a team short code, or DRAW)');
  if (!opts.fixtureId && !opts.teams) throw new Error('Address the fixture with --fixture or --teams');
  if (opts.teams && !opts.kickoff) throw new Error('--teams needs --kickoff');

  const fixtureIds = await findFixtures();
  const newResult = opts.newResult.toUpperCase();

  // Assess every competition first, so the whole picture is visible before anything is written.
  console.log(`Assessing ${fixtureIds.length} fixture(s)...`);
  const reports = [];
  for (const fixtureId of fixtureIds) {
    reports.push(await assess(fixtureId, newResult));
  }
  reports.forEach(printReport);

  if (!opts.apply) {
    console.log('\nAssessment only. Re-run with --apply to write the correction.');
    return;
  }

  const blocked = reports.filter(r => r.blockers.length > 0);
  if (blocked.length > 0) {
    console.log(`\nRefusing to apply: ${blocked.length} competition(s) failed a precondition.`);
    process.exitCode = 2;
    return;
  }

  // Each competition applies independently, in its own transaction, reported one at a time -
  // the same lesson the results push learned. Half-applied is recoverable: a second run finds
  // the corrected competitions already in the desired state and reports nothing to do.
  console.log('\nApplying...');
  for (const report of reports) {
    if (report.noop) {
      console.log(`  Competition ${report.competitionId}: already correct, skipped.`);
      continue;
    }
    try {
      await apply(report);
      console.log(`  Competition ${report.competitionId}: corrected.`);
    } catch (error) {
      console.log(`  Competition ${report.competitionId}: FAILED, rolled back - ${error.message}`);
      process.exitCode = 1;
    }
  }

  console.log('\nRunning the health check over the affected competitions...');
  for (const competitionId of [...new Set(reports.map(r => r.competitionId))]) {
    opts.competitionId = competitionId;
    await verify();
  }

  console.log('\nRemember: players have already seen the old result, emails have gone out, and ' +
    'notifications were skipped. None of that is fixed by this script - tell people.');
};

main()
  .catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
