CREATE TABLE IF NOT EXISTS handoff_reports (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('feedback', 'connection')),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  share_token text NOT NULL UNIQUE CHECK (share_token ~ '^[A-Za-z0-9_-]{40,60}$'),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  session_id text REFERENCES guided_trial_sessions(id) ON DELETE RESTRICT,
  content text NOT NULL,
  approved_note_task_ids text NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK ((kind = 'feedback' AND session_id IS NOT NULL) OR (kind = 'connection' AND session_id IS NULL))
);
CREATE INDEX IF NOT EXISTS handoff_reports_opportunity_created_idx ON handoff_reports(opportunity_id, created_at);
CREATE INDEX IF NOT EXISTS handoff_reports_session_idx ON handoff_reports(session_id);

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS handoff_report_id text REFERENCES handoff_reports(id) ON DELETE RESTRICT;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS public_note boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION reject_follow_up_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'follow-up history is append-only';
END;
$$;
DROP TRIGGER IF EXISTS follow_ups_append_only ON follow_ups;
CREATE TRIGGER follow_ups_append_only BEFORE UPDATE OR DELETE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION reject_follow_up_history_mutation();
