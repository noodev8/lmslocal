-- Matchday Party, phase 1: its own tables. docs/matchday-party.md §7.
--
-- Additive and self-contained. Nothing that exists reads these tables, and they reference only
-- app_user. Run BEFORE deploying the server code that uses them.
--
-- UNLIKE prediction (2026-11-22-matchday-prediction.sql), the foreign keys inside a party CASCADE.
-- A room is a short-lived thing (§7: deleted after about a day), and deleting it must take its
-- players, rounds, fixtures and predictions with it in one statement - that is the whole of
-- scripts/prune-party-rooms.js. Nothing outside the party tables points in, so a cascade here
-- cannot reach anyone's competition.

-- The twenty teams and their ratings (§4.1). A rating is our judgement, maintained by hand; a
-- game copies the effective rating onto each fixture, so changing one never alters a game in play.
CREATE TABLE IF NOT EXISTS party_team (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(40) NOT NULL UNIQUE,
  short_name  VARCHAR(5)  NOT NULL UNIQUE,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 100),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROVISIONAL ratings, 2026-11-24, the same set as scripts/party-engine-sim.js. Andreas sets the
-- real ones; change them with an UPDATE, not by editing this file. Names and short names match
-- team_list 1 (English Premier League 2026-27).
INSERT INTO party_team (name, short_name, rating) VALUES
  ('Man City', 'MCI', 92), ('Arsenal', 'ARS', 90), ('Liverpool', 'LIV', 88), ('Chelsea', 'CHE', 82),
  ('Newcastle', 'NEW', 78), ('Tottenham', 'TOT', 74), ('Aston Villa', 'AVL', 74), ('Man Utd', 'MUN', 70),
  ('Brighton', 'BHA', 68), ('Nottm Forest', 'NFO', 65), ('Crystal Palace', 'CRY', 64), ('Bournemouth', 'BOU', 62),
  ('Brentford', 'BRE', 60), ('Fulham', 'FUL', 58), ('Everton', 'EVE', 56), ('Leeds', 'LEE', 48),
  ('Sunderland', 'SUN', 44), ('Ipswich', 'IPS', 36), ('Coventry', 'COV', 30), ('Hull', 'HUL', 20)
ON CONFLICT (name) DO NOTHING;

-- One evening's game. state runs lobby -> open -> revealing -> table -> (open ...) -> finished
-- (§5). version goes up on every change anyone could see, so a poll that already has the latest
-- version is answered without building the state (§7).
CREATE TABLE IF NOT EXISTS party_room (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(5)  NOT NULL UNIQUE,
  host_user_id  INTEGER     NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  state         VARCHAR(10) NOT NULL DEFAULT 'lobby'
                CHECK (state IN ('lobby', 'open', 'revealing', 'table', 'finished')),
  rounds_total  INTEGER     NOT NULL CHECK (rounds_total IN (4, 6, 8)),
  current_round INTEGER     NOT NULL DEFAULT 0,
  version       INTEGER     NOT NULL DEFAULT 1,
  ended_early   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS party_room_expires_idx ON party_room (expires_at);
CREATE INDEX IF NOT EXISTS party_room_host_idx ON party_room (host_user_id);

-- Everyone in the room, the host included. Players are not users (§7): they hold a random token
-- for this room only, stored as a SHA-256 hash. user_id is set for the host and nobody else.
-- A removed player keeps their row (removed_at) so the room's history stays consistent.
CREATE TABLE IF NOT EXISTS party_player (
  id            SERIAL PRIMARY KEY,
  room_id       INTEGER     NOT NULL REFERENCES party_room (id) ON DELETE CASCADE,
  user_id       INTEGER              REFERENCES app_user (id) ON DELETE SET NULL,
  display_name  VARCHAR(20) NOT NULL,
  token_hash    CHAR(64)    NOT NULL UNIQUE,
  is_host       BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at    TIMESTAMPTZ
);
-- Two people in one room cannot share a name: the TV is how everyone tells each other apart.
CREATE UNIQUE INDEX IF NOT EXISTS party_player_room_name_key
  ON party_player (room_id, LOWER(display_name)) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS party_player_room_idx ON party_player (room_id);

-- A round. draw_seed draws the fixtures when it opens; play_seed is set, and the results played,
-- only when it locks (§4.5).
CREATE TABLE IF NOT EXISTS party_round (
  id            SERIAL PRIMARY KEY,
  room_id       INTEGER     NOT NULL REFERENCES party_room (id) ON DELETE CASCADE,
  round_number  INTEGER     NOT NULL,
  draw_seed     BIGINT      NOT NULL,
  play_seed     BIGINT,
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at     TIMESTAMPTZ,
  UNIQUE (room_id, round_number)
);

-- Ten a round. The ratings, goals and goal minutes are null until the round locks; the ratings
-- recorded are the effective ones the engine used, bonus included, and are never sent to players.
CREATE TABLE IF NOT EXISTS party_fixture (
  id            SERIAL PRIMARY KEY,
  round_id      INTEGER     NOT NULL REFERENCES party_round (id) ON DELETE CASCADE,
  sort_order    INTEGER     NOT NULL,
  home_team_id  INTEGER     NOT NULL REFERENCES party_team (id),
  away_team_id  INTEGER     NOT NULL REFERENCES party_team (id),
  home_rating   INTEGER,
  away_rating   INTEGER,
  home_goals    INTEGER,
  away_goals    INTEGER,
  goals         JSONB
);
CREATE INDEX IF NOT EXISTS party_fixture_round_idx ON party_fixture (round_id);

-- A player has sent their coupon for the round. Separate from the predictions because a coupon may
-- be sent with every match left blank, and the round locks itself once everyone has sent one.
CREATE TABLE IF NOT EXISTS party_submission (
  round_id      INTEGER     NOT NULL REFERENCES party_round (id) ON DELETE CASCADE,
  player_id     INTEGER     NOT NULL REFERENCES party_player (id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, player_id)
);

-- One row per predicted match. A blank has no row and scores 0. Points are derived from the
-- fixture's goals, never stored (services/party.js).
CREATE TABLE IF NOT EXISTS party_prediction (
  id            SERIAL PRIMARY KEY,
  fixture_id    INTEGER     NOT NULL REFERENCES party_fixture (id) ON DELETE CASCADE,
  player_id     INTEGER     NOT NULL REFERENCES party_player (id) ON DELETE CASCADE,
  team_id       INTEGER     NOT NULL REFERENCES party_team (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS party_prediction_fixture_idx ON party_prediction (fixture_id);
