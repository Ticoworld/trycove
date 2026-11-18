CREATE TABLE IF NOT EXISTS guided_trial_sessions (
  id text PRIMARY KEY,
  pack_id text NOT NULL,
  product_id text NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  problem_map_slug text NOT NULL,
  problem_map_opportunity_id text REFERENCES opportunities(id) ON DELETE RESTRICT,
  definition_version text NOT NULL,
  definition_sha256 text NOT NULL CHECK (definition_sha256 ~ '^[a-f0-9]{64}$'),
  definition_snapshot text NOT NULL,
  access_token_sha256 text NOT NULL CHECK (access_token_sha256 ~ '^[a-f0-9]{64}$'),
  self_reported_at timestamptz NOT NULL,
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS guided_trial_sessions_product_idx ON guided_trial_sessions(product_id, started_at);
CREATE INDEX IF NOT EXISTS guided_trial_sessions_pack_idx ON guided_trial_sessions(pack_id, started_at);

CREATE TABLE IF NOT EXISTS guided_trial_step_events (
  id serial PRIMARY KEY,
  session_id text NOT NULL REFERENCES guided_trial_sessions(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'failed', 'stuck', 'skipped')),
  note text NOT NULL DEFAULT '',
  observed_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS guided_trial_step_events_session_idx ON guided_trial_step_events(session_id, id);

CREATE TABLE IF NOT EXISTS guided_trial_receipts (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES guided_trial_sessions(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  receipt_sha256 text NOT NULL CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  receipt text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE(session_id, version)
);
CREATE INDEX IF NOT EXISTS guided_trial_receipts_session_created_idx ON guided_trial_receipts(session_id, created_at);

CREATE OR REPLACE FUNCTION reject_guided_trial_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'guided trial events and receipt versions are append-only';
END;
$$;
DROP TRIGGER IF EXISTS guided_trial_step_events_append_only ON guided_trial_step_events;
CREATE TRIGGER guided_trial_step_events_append_only BEFORE UPDATE OR DELETE ON guided_trial_step_events
  FOR EACH ROW EXECUTE FUNCTION reject_guided_trial_history_mutation();
DROP TRIGGER IF EXISTS guided_trial_receipts_append_only ON guided_trial_receipts;
CREATE TRIGGER guided_trial_receipts_append_only BEFORE UPDATE OR DELETE ON guided_trial_receipts
  FOR EACH ROW EXECUTE FUNCTION reject_guided_trial_history_mutation();
