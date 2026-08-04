# Auto-Lock Round Feature - Implementation Plan

## Overview
Implement a Python cron script that automatically locks rounds when all players have made their picks, improving user experience by eliminating wait time for official lock deadlines.

## Requirements
- **Trigger Condition**: All active players in a competition have submitted picks for the current round
- **Round Restriction**: Only apply to Round 2+ (skip Round 1 to avoid immediate locking)
- **Action**: Update round's `lock_time` to current timestamp (`NOW()`)
- **Frequency**: Run every 6 hours via system cron

## Technical Approach

### Cron Schedule
```bash
0 */6 * * * /usr/bin/python3 /path/to/auto_lock_rounds.py
```

### Core Logic
1. Find rounds that meet criteria:
   - `lock_time > NOW()` (not yet time-locked)
   - `round_number >= 2` (Round 2 or higher)
   - `status != 'COMPLETE'` (active rounds only)

2. For each qualifying round, check if:
   - Count of picks for round = Count of active players in competition

3. If condition met:
   - `UPDATE rounds SET lock_time = NOW() WHERE id = ?`
   - Log the auto-lock action

### Database Queries Needed
- Identify qualifying rounds
- Count picks per round
- Count active players per competition
- Update lock time when conditions met

## Benefits
- **Better UX**: Players see picks immediately when everyone has submitted
- **No waiting**: Eliminates dead time between "all picked" and "official lock time"
- **Strategic fairness**: Maintains pick secrecy until everyone commits
- **Reliability**: Independent cron process, survives server restarts

## Implementation Notes
- Use system cron (not Node.js cron) for reliability
- Python script for ease of maintenance
- Direct database access via psycopg2
- Include logging for monitoring/debugging
- Preserve original lock_time logic as fallback safety mechanism

## Current State
- **Status**: Planned - Ready for implementation when prioritized
- **Dependencies**: Python 3, psycopg2 package, database credentials
- **Testing**: Will need to test with various pick completion scenarios

---
*Document created: 2025-01-28*