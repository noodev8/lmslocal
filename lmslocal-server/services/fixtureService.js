/*
=======================================================================================================================================
Fixture Service: Core fixture management business logic
=======================================================================================================================================
Purpose: Provides reusable functions for pushing fixtures from fixture_load table to competitions.
         There is only ever one staged batch at a time (add-staged-fixtures refuses a new one
         while fixture_load isn't empty), so this pushes whatever is there to every competition
         that's eligible for it - no gameweek selection or catch-up queue involved.
=======================================================================================================================================
*/

/**
 * Pushes fixtures from fixture_load table to competitions that need them.
 * 1. Find competitions needing fixtures (blank round or completed round)
 * 2. For each, check the staged batch's earliest kickoff is at or after the competition's
 *    earliest_start_date, or NOW() when that is not set. There is no minimum lead time - a
 *    batch kicking off tomorrow is eligible, and one whose kickoff has already passed for a
 *    competition with an earlier start date is too, which would create a round that is locked
 *    on arrival.
 * 3. Push the batch to eligible competitions
 *
 * @param {object} client - Database client (transaction or query context)
 * @returns {Promise<object>} Result object with statistics
 * @throws {Error} With specific error codes: NO_ACTIVE_FIXTURES, NO_SUBSCRIBED_COMPETITIONS
 */
async function pushFixturesToCompetitions(client) {
  // Step 1: Find all competitions that need fixtures
  const allCompetitionsResult = await client.query(`
    SELECT id, name, team_list_id, status, earliest_start_date
    FROM competition
    WHERE fixture_service = true
    AND (earliest_start_date IS NULL OR earliest_start_date <= NOW())
  `);

  if (allCompetitionsResult.rows.length === 0) {
    throw new Error('NO_SUBSCRIBED_COMPETITIONS');
  }

  const allCompetitions = allCompetitionsResult.rows;
  const competitionsNeedingFixtures = [];

  // Check each competition to see if it needs fixtures
  for (const competition of allCompetitions) {
    const compId = competition.id;
    const competitionStatus = competition.status;

    // Skip if competition is already complete
    if (competitionStatus === 'COMPLETE') {
      continue;
    }

    // Get latest round for this competition
    const latestRoundResult = await client.query(`
      SELECT MAX(round_number) as latest_round
      FROM round
      WHERE competition_id = $1
    `, [compId]);

    const latestRound = latestRoundResult.rows[0].latest_round;

    // NEW COMPETITION: No rounds exist at all - needs fixtures
    if (!latestRound) {
      competitionsNeedingFixtures.push({
        ...competition,
        needs_new_round: true,
        round_number: null
      });
      continue;
    }

    // Check if latest round has fixtures and if all fixtures have results
    const fixtureCheckResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(result) as with_results
      FROM fixture f
      JOIN round r ON f.round_id = r.id
      WHERE r.competition_id = $1 AND r.round_number = $2
    `, [compId, latestRound]);

    const fixtureCheck = fixtureCheckResult.rows[0];
    const totalFixtures = parseInt(fixtureCheck.total);
    const fixturesWithResults = parseInt(fixtureCheck.with_results);

    if (totalFixtures === 0) {
      // BLANK ROUND: Round exists but has no fixtures - needs fixtures
      competitionsNeedingFixtures.push({
        ...competition,
        needs_new_round: false,
        round_number: latestRound
      });
    } else if (fixturesWithResults === totalFixtures) {
      // COMPLETED ROUND: All fixtures have results - needs new round
      competitionsNeedingFixtures.push({
        ...competition,
        needs_new_round: true,
        round_number: latestRound
      });
    }
    // else: Round in progress (some fixtures without results) - skip
  }

  // If no competitions need fixtures, exit early
  if (competitionsNeedingFixtures.length === 0) {
    return {
      competitions_updated: 0,
      competitions_skipped: allCompetitions.length,
      fixtures_pushed: 0,
      details: []
    };
  }

  // The staged batch, whatever team lists it spans - there is only ever one per list.
  const allAvailableFixturesResult = await client.query(`
    SELECT fixture_id, team_list_id, league, home_team_short, away_team_short, kickoff_time
    FROM fixture_load
    ORDER BY kickoff_time
  `);

  const allAvailableFixtures = allAvailableFixturesResult.rows;

  if (allAvailableFixtures.length === 0) {
    throw new Error('NO_ACTIVE_FIXTURES');
  }

  // Group fixtures by team_list_id for processing
  const fixturesByTeamList = {};
  allAvailableFixtures.forEach(fixture => {
    if (!fixturesByTeamList[fixture.team_list_id]) {
      fixturesByTeamList[fixture.team_list_id] = [];
    }
    fixturesByTeamList[fixture.team_list_id].push(fixture);
  });

  // Step 3: Push fixtures to each competition that needs them
  const competitionDetails = [];
  let totalCompetitionsUpdated = 0;
  let totalCompetitionsSkipped = 0;
  let totalFixturesPushed = 0;

  for (const competition of competitionsNeedingFixtures) {
    const compId = competition.id;
    const competitionName = competition.name;
    const teamListId = competition.team_list_id;
    const needsNewRound = competition.needs_new_round;
    const currentRoundNumber = competition.round_number;
    const earliestStartDate = competition.earliest_start_date;

    // The staged batch is only eligible once its earliest kickoff is >= earliest_start_date
    // (or NOW() if that isn't set).
    const cutoffDate = earliestStartDate ? new Date(earliestStartDate) : new Date();

    const candidateFixtures = fixturesByTeamList[teamListId] || [];
    let fixturesToPush = null;

    if (candidateFixtures.length > 0) {
      const earliestKickoff = candidateFixtures.reduce((earliest, fixture) => {
        const kickoffDate = new Date(fixture.kickoff_time);
        return !earliest || kickoffDate < earliest ? kickoffDate : earliest;
      }, null);

      if (earliestKickoff >= cutoffDate) {
        fixturesToPush = candidateFixtures;
      }
    }

    if (!fixturesToPush || fixturesToPush.length === 0) {
      competitionDetails.push({
        competition_id: compId,
        competition_name: competitionName,
        status: 'skipped',
        reason: `No fixtures available for team list ${teamListId} with kickoff >= ${cutoffDate.toISOString()}`
      });
      totalCompetitionsSkipped++;
      continue;
    }

    // Calculate lock_time: use earliest kickoff time from fixtures
    const earliestKickoff = fixturesToPush.reduce((earliest, fixture) => {
      if (!earliest || new Date(fixture.kickoff_time) < new Date(earliest)) {
        return fixture.kickoff_time;
      }
      return earliest;
    }, null);

    // Determine target round
    let targetRoundId;
    let targetRoundNumber;
    let roundAction; // 'created' or 'populated'

    if (needsNewRound) {
      // Create new round
      const newRoundResult = await client.query(`
        INSERT INTO round (
          competition_id,
          round_number,
          lock_time,
          created_at
        )
        SELECT
          $1,
          COALESCE(MAX(r.round_number), 0) + 1,
          $2,
          CURRENT_TIMESTAMP
        FROM competition c
        LEFT JOIN round r ON r.competition_id = c.id
        WHERE c.id = $1
        GROUP BY c.id
        RETURNING id, round_number
      `, [compId, earliestKickoff]);

      const newRound = newRoundResult.rows[0];
      targetRoundId = newRound.id;
      targetRoundNumber = newRound.round_number;
      roundAction = 'created';
    } else {
      // Use existing blank round
      const existingRoundResult = await client.query(`
        SELECT id, round_number
        FROM round
        WHERE competition_id = $1 AND round_number = $2
      `, [compId, currentRoundNumber]);

      targetRoundId = existingRoundResult.rows[0].id;
      targetRoundNumber = existingRoundResult.rows[0].round_number;
      roundAction = 'populated';

      // Update lock_time for the existing round
      await client.query(`
        UPDATE round
        SET lock_time = $1
        WHERE id = $2
      `, [earliestKickoff, targetRoundId]);
    }

    // Lookup full team names from team table based on short names
    const teamLookupResult = await client.query(`
      SELECT short_name, name
      FROM team
      WHERE team_list_id = $1 AND is_active = true
    `, [teamListId]);

    const teamMap = {};
    teamLookupResult.rows.forEach(team => {
      teamMap[team.short_name] = team.name;
    });

    // Insert all fixtures into the target round
    for (const fixture of fixturesToPush) {
      // Lookup full team names from map (fallback to short name if not found)
      const homeTeamFull = teamMap[fixture.home_team_short] || fixture.home_team_short;
      const awayTeamFull = teamMap[fixture.away_team_short] || fixture.away_team_short;

      await client.query(`
        INSERT INTO fixture (
          round_id,
          competition_id,
          home_team,
          away_team,
          home_team_short,
          away_team_short,
          kickoff_time,
          round_number,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        targetRoundId,
        compId,
        homeTeamFull,
        awayTeamFull,
        fixture.home_team_short,
        fixture.away_team_short,
        fixture.kickoff_time,
        targetRoundNumber
      ]);

      totalFixturesPushed++;
    }

    // Auto-reset teams ONLY if allowed_teams is empty for active players
    const teamResetResult = await client.query(`
      INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
      SELECT $1, cu.user_id, t.id, NOW()
      FROM competition_user cu
      CROSS JOIN team t
      WHERE cu.competition_id = $1
      AND cu.status = 'active'
      AND t.team_list_id = $2
      AND t.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM allowed_teams at
        WHERE at.competition_id = $1 AND at.user_id = cu.user_id
      )
      RETURNING user_id
    `, [compId, teamListId]);

    // Log team resets for affected players
    if (teamResetResult.rows.length > 0) {
      const uniqueUserIds = [...new Set(teamResetResult.rows.map(row => row.user_id))];

      for (const userId of uniqueUserIds) {
        // Get user display name for audit log
        const userResult = await client.query(
          'SELECT display_name FROM app_user WHERE id = $1',
          [userId]
        );

        const displayName = userResult.rows[0]?.display_name || `User ${userId}`;

        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details)
          VALUES ($1, $2, 'Teams Auto-Reset', $3)
        `, [
          compId,
          userId,
          `Teams automatically reset for ${displayName} at start of Round ${targetRoundNumber}`
        ]);
      }
    }

    // === QUEUE MOBILE NOTIFICATIONS ===
    // Queue 'new_round' and 'pick_reminder' notifications for all active players
    // new_round: sends immediately on next cron run - message is "Results are in - see how you did!"
    // pick_reminder: sends when within 24hrs of lock_time
    // Excludes guest users (email starts with 'lms-guest')

    // NEW_ROUND: Only insert if user has no pending new_round notification (any competition)
    // This avoids spamming users in multiple competitions with separate notifications
    // Also requires user has a device token registered (no point queueing if they can't receive)
    await client.query(`
      INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
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
          WHERE mnq.user_id = cu.user_id
            AND mnq.type = 'new_round'
            AND mnq.status = 'pending'
        )
    `, [compId, targetRoundId, targetRoundNumber]);

    /* FUTURE: Per-competition new_round notifications (commented out for now)
    await client.query(`
      INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
      SELECT cu.user_id, 'new_round', $1, $2, $3, 'pending', NOW()
      FROM competition_user cu
      JOIN app_user au ON au.id = cu.user_id
      WHERE cu.competition_id = $1
        AND cu.status = 'active'
        AND cu.hidden IS NOT TRUE
        AND au.email NOT LIKE '%@lms-guest.%'
        AND NOT EXISTS (
          SELECT 1 FROM mobile_notification_queue mnq
          WHERE mnq.user_id = cu.user_id
            AND mnq.type = 'new_round'
            AND mnq.competition_id = $1
            AND mnq.round_id = $2
        )
    `, [compId, targetRoundId, targetRoundNumber]);
    */

    // PICK_REMINDER: Per-competition, requires device token
    await client.query(`
      INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
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
          WHERE mnq.user_id = cu.user_id
            AND mnq.type = 'pick_reminder'
            AND mnq.competition_id = $1
            AND mnq.round_id = $2
        )
    `, [compId, targetRoundId, targetRoundNumber]);

    // Create audit log entry for fixture push
    await client.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, NULL, 'Fixtures Pushed', $2)
    `, [
      compId,
      `Fixture service ${roundAction} Round ${targetRoundNumber} with ${fixturesToPush.length} fixtures`
    ]);

    // Mark this competition as updated
    competitionDetails.push({
      competition_id: compId,
      competition_name: competitionName,
      status: 'updated',
      reason: null
    });
    totalCompetitionsUpdated++;
  }

  // Return all data needed for response
  return {
    competitions_updated: totalCompetitionsUpdated,
    competitions_skipped: totalCompetitionsSkipped,
    fixtures_pushed: totalFixturesPushed,
    details: competitionDetails
  };
}

module.exports = {
  pushFixturesToCompetitions
};
