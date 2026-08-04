-- =====================================================================================================================================
-- Admin Tool Migration - adds the is_admin flag used by lmslocal-admin
-- =====================================================================================================================================
-- Purpose: Gate the /admin/* API namespace on a real database flag rather than a hardcoded
--          access code. Only accounts with is_admin = true can obtain an admin-scoped token.
--
-- Run with:  cd lmslocal-server && node db/write.js --file ../docs/admin-tool-migration.sql
--
-- Safe to re-run: both statements are idempotent.
-- =====================================================================================================================================

-- Platform administrator flag. Deliberately a dedicated column rather than reusing user_type,
-- which check-user-type.js already reads for a different purpose.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Grant admin to the platform owner.
UPDATE app_user
SET is_admin = true
WHERE email = 'aandreou25@gmail.com';
