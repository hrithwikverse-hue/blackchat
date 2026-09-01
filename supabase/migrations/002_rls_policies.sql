-- =============================================
-- Migration 002: Row Level Security Policies
-- BlackChat Instagram Automation
--
-- All tables are restricted to the authenticated
-- user only. Since this is a single-user app,
-- all rows belong to that one user via Supabase Auth.
-- =============================================

-- Enable RLS on all tables
ALTER TABLE instagram_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings               ENABLE ROW LEVEL SECURITY;

-- =============================================
-- instagram_accounts policies
-- =============================================
CREATE POLICY "Authenticated user can read own accounts"
  ON instagram_accounts FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated user can insert accounts"
  ON instagram_accounts FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated user can update accounts"
  ON instagram_accounts FOR UPDATE
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated user can delete accounts"
  ON instagram_accounts FOR DELETE
  TO authenticated
  USING (TRUE);

-- Service role bypass (for webhook processing from server-side)
CREATE POLICY "Service role full access to accounts"
  ON instagram_accounts FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- automations policies
-- =============================================
CREATE POLICY "Authenticated user can manage automations"
  ON automations FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Service role full access to automations"
  ON automations FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- webhook_events policies
-- =============================================
CREATE POLICY "Authenticated user can read webhook events"
  ON webhook_events FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Service role full access to webhook events"
  ON webhook_events FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- automation_executions policies
-- =============================================
CREATE POLICY "Authenticated user can read executions"
  ON automation_executions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Service role full access to executions"
  ON automation_executions FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- settings policies
-- =============================================
CREATE POLICY "Authenticated user can manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Service role full access to settings"
  ON settings FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
