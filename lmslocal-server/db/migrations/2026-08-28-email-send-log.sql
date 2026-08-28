-- One row per call to the email provider, written inside deliver().
--
-- WHY: get-email-volume counted email_queue rows with status='sent', which misses every send that
-- was never queued - password reset, verification, the contact form, onboarding, the Stripe
-- payment confirmation - and every [TEST] copy, which spends a provider send like any other. Its
-- own header called that out and said the fix was to log inside deliver(); that only became safe
-- once deliver() was genuinely the single exit point.
--
-- Additive only. Nothing reads or writes any existing table.
--
-- ROWS DO NOT LIVE FOREVER. scripts/prune-email-send-log.js deletes anything over 90 days, nightly
-- on the crontab. 90 days is chosen to span the SES migration's phases 4 and 5, when marketing and
-- transactional are on different providers and both have to still be here to be compared.
CREATE TABLE IF NOT EXISTS email_send_log (
  id          BIGSERIAL PRIMARY KEY,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Which provider took it. Exists for the SES migration: the cutover is measurable, and a day
  -- that straddles it can be counted per provider rather than as one undifferentiated total.
  provider    TEXT        NOT NULL DEFAULT 'resend',
  -- The catalog key off the payload's email_type tag. NULL means untagged, which is exactly the
  -- transactional mail this table exists to make visible.
  email_type  TEXT,
  -- A [TEST] redirect is still a real send against the allowance.
  test_mode   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Whether the provider took it. Rejections are kept rather than dropped so a day of failures
  -- does not read as a quiet day.
  accepted    BOOLEAN     NOT NULL,
  message_id  TEXT,
  error       TEXT
);

-- PARTIAL, matching idx_email_queue_sent_recent next door and for the same reason. The only query
-- against this table counts ACCEPTED sends in a two-day window. A plain index on sent_at leaves the
-- planner filtering `accepted` off the heap, and it reverts to a sequential scan of the whole
-- table - measured at 20,000 rows, before this was changed.
--
-- It also covers `SELECT MIN(sent_at) ... WHERE accepted`, the handover boundary in
-- get-email-volume, which is why that query is bounded to accepted rows rather than reading MIN
-- over everything. With this index every access in that route is an Index Only Scan and the work
-- is proportional to the two-day window rather than to the size of the table.
CREATE INDEX IF NOT EXISTS idx_email_send_log_accepted_recent
  ON email_send_log (sent_at) WHERE accepted;
