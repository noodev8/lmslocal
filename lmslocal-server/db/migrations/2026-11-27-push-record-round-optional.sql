-- Push notifications: the record no longer needs a round (docs/mobile-notifications.md §1, 2026-11-27).
--
-- mobile_notification_queue is now the record of pushes sent WITH an email, one row per person.
-- Game complete is about a competition, not a round - its own email_queue row carries round_id NULL -
-- so its push has no round to file under. The columns were NOT NULL only because the old queue was
-- always about a round.
--
-- Loosening only: every existing row and every pick reminder / Round Over push still has a round.
ALTER TABLE mobile_notification_queue ALTER COLUMN round_id DROP NOT NULL;
ALTER TABLE mobile_notification_queue ALTER COLUMN round_number DROP NOT NULL;
