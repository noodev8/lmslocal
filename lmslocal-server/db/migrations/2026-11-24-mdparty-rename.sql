-- Matchday Party: party_ -> mdparty_ (Andreas, 2026-11-24). "party_" was too generic: another
-- party game may follow, and each should own its prefix. Names only - no data, column or
-- behaviour changes. Indexes, sequences and constraints are renamed too, so nothing is left
-- carrying the old prefix. Run in one transaction (db/write.js --file) BEFORE deploying the
-- server code that uses the new names.

-- Tables first; constraints are renamed against the new table names below.
ALTER TABLE party_team RENAME TO mdparty_team;
ALTER TABLE party_room RENAME TO mdparty_room;
ALTER TABLE party_player RENAME TO mdparty_player;
ALTER TABLE party_round RENAME TO mdparty_round;
ALTER TABLE party_fixture RENAME TO mdparty_fixture;
ALTER TABLE party_submission RENAME TO mdparty_submission;
ALTER TABLE party_prediction RENAME TO mdparty_prediction;

-- Indexes (a primary key or unique index renames its constraint with it).
ALTER INDEX party_fixture_pkey RENAME TO mdparty_fixture_pkey;
ALTER INDEX party_fixture_round_idx RENAME TO mdparty_fixture_round_idx;
ALTER INDEX party_player_pkey RENAME TO mdparty_player_pkey;
ALTER INDEX party_player_room_idx RENAME TO mdparty_player_room_idx;
ALTER INDEX party_player_room_name_key RENAME TO mdparty_player_room_name_key;
ALTER INDEX party_player_token_hash_key RENAME TO mdparty_player_token_hash_key;
ALTER INDEX party_prediction_fixture_idx RENAME TO mdparty_prediction_fixture_idx;
ALTER INDEX party_prediction_pkey RENAME TO mdparty_prediction_pkey;
ALTER INDEX party_prediction_player_id_fixture_id_key RENAME TO mdparty_prediction_player_id_fixture_id_key;
ALTER INDEX party_room_code_key RENAME TO mdparty_room_code_key;
ALTER INDEX party_room_expires_idx RENAME TO mdparty_room_expires_idx;
ALTER INDEX party_room_host_idx RENAME TO mdparty_room_host_idx;
ALTER INDEX party_room_pkey RENAME TO mdparty_room_pkey;
ALTER INDEX party_round_pkey RENAME TO mdparty_round_pkey;
ALTER INDEX party_round_room_id_round_number_key RENAME TO mdparty_round_room_id_round_number_key;
ALTER INDEX party_submission_pkey RENAME TO mdparty_submission_pkey;
ALTER INDEX party_team_name_key RENAME TO mdparty_team_name_key;
ALTER INDEX party_team_pkey RENAME TO mdparty_team_pkey;
ALTER INDEX party_team_short_name_key RENAME TO mdparty_team_short_name_key;

-- Sequences behind the SERIAL ids. The column defaults follow the rename on their own.
ALTER SEQUENCE party_fixture_id_seq RENAME TO mdparty_fixture_id_seq;
ALTER SEQUENCE party_player_id_seq RENAME TO mdparty_player_id_seq;
ALTER SEQUENCE party_prediction_id_seq RENAME TO mdparty_prediction_id_seq;
ALTER SEQUENCE party_room_id_seq RENAME TO mdparty_room_id_seq;
ALTER SEQUENCE party_round_id_seq RENAME TO mdparty_round_id_seq;
ALTER SEQUENCE party_team_id_seq RENAME TO mdparty_team_id_seq;

-- Check and foreign-key constraints.
ALTER TABLE mdparty_fixture RENAME CONSTRAINT party_fixture_away_team_id_fkey TO mdparty_fixture_away_team_id_fkey;
ALTER TABLE mdparty_fixture RENAME CONSTRAINT party_fixture_home_team_id_fkey TO mdparty_fixture_home_team_id_fkey;
ALTER TABLE mdparty_fixture RENAME CONSTRAINT party_fixture_round_id_fkey TO mdparty_fixture_round_id_fkey;
ALTER TABLE mdparty_player RENAME CONSTRAINT party_player_room_id_fkey TO mdparty_player_room_id_fkey;
ALTER TABLE mdparty_player RENAME CONSTRAINT party_player_user_id_fkey TO mdparty_player_user_id_fkey;
ALTER TABLE mdparty_prediction RENAME CONSTRAINT party_prediction_fixture_id_fkey TO mdparty_prediction_fixture_id_fkey;
ALTER TABLE mdparty_prediction RENAME CONSTRAINT party_prediction_player_id_fkey TO mdparty_prediction_player_id_fkey;
ALTER TABLE mdparty_prediction RENAME CONSTRAINT party_prediction_team_id_fkey TO mdparty_prediction_team_id_fkey;
ALTER TABLE mdparty_room RENAME CONSTRAINT party_room_host_user_id_fkey TO mdparty_room_host_user_id_fkey;
ALTER TABLE mdparty_room RENAME CONSTRAINT party_room_rounds_total_check TO mdparty_room_rounds_total_check;
ALTER TABLE mdparty_room RENAME CONSTRAINT party_room_state_check TO mdparty_room_state_check;
ALTER TABLE mdparty_round RENAME CONSTRAINT party_round_room_id_fkey TO mdparty_round_room_id_fkey;
ALTER TABLE mdparty_submission RENAME CONSTRAINT party_submission_player_id_fkey TO mdparty_submission_player_id_fkey;
ALTER TABLE mdparty_submission RENAME CONSTRAINT party_submission_round_id_fkey TO mdparty_submission_round_id_fkey;
ALTER TABLE mdparty_team RENAME CONSTRAINT party_team_rating_check TO mdparty_team_rating_check;
