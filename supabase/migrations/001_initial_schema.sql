-- =============================================
-- Migration 001: Initial Schema
-- BlackChat Instagram Automation
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- instagram_accounts
-- Stores the connected Instagram account.
-- Tokens are AES-256-GCM encrypted before storage.
-- =============================================
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_user_id          TEXT UNIQUE NOT NULL,
  username                   TEXT NOT NULL,
  access_token_encrypted     TEXT NOT NULL,
  page_id                    TEXT,
  page_access_token_encrypted TEXT,
  token_expires_at           TIMESTAMPTZ,
  is_connected               BOOLEAN DEFAULT TRUE,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- automations
-- Each row is one comment-keyword → DM automation.
-- media_id NULL means "any post/reel".
-- match_type: exact | contains | starts_with
-- =============================================
CREATE TABLE IF NOT EXISTS automations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  instagram_account_id  UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  media_id              TEXT,        -- NULL = match any post/reel
  keyword               TEXT NOT NULL,
  match_type            TEXT NOT NULL DEFAULT 'contains'
                          CHECK (match_type IN ('exact', 'contains', 'starts_with')),
  dm_message            TEXT NOT NULL,
  button_text           TEXT,
  button_url            TEXT,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- webhook_events
-- Stores every received Meta webhook event.
-- event_id UNIQUE ensures idempotency — Meta retries
-- are safely ignored via ON CONFLICT DO NOTHING.
-- =============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT UNIQUE NOT NULL,   -- composite key from Meta payload
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status       TEXT DEFAULT 'received'
                 CHECK (status IN ('received', 'processing', 'processed', 'failed', 'skipped')),
  error        TEXT,
  received_at  TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- =============================================
-- automation_executions
-- Records every attempt to send a DM.
-- UNIQUE on (automation_id, instagram_comment_id)
-- prevents the same comment from triggering the
-- same automation twice even if events are replayed.
-- =============================================
CREATE TABLE IF NOT EXISTS automation_executions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id        UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  webhook_event_id     UUID REFERENCES webhook_events(id),
  instagram_comment_id TEXT NOT NULL,
  instagram_user_id    TEXT,
  status               TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (automation_id, instagram_comment_id)
);

-- =============================================
-- settings
-- Key-value store for non-secret app settings.
-- Secrets should always use environment variables.
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_automations_account ON automations(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_automations_active   ON automations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_executions_automation ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON automation_executions(created_at DESC);
