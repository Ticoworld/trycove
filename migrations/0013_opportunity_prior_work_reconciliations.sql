CREATE TABLE IF NOT EXISTS opportunity_prior_work_reconciliations (
  id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  input_snapshot_sha256 text NOT NULL CHECK (input_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  action_readiness text NOT NULL CHECK (action_readiness IN (
    'CONTACT_WORTHY','CONTACTED','INTEREST_CONFIRMED','PILOT_READY',
    'ALREADY_ADDRESSED','NEEDS_CONFIRMATION','REJECTED','BLOCKED',
    'NO_CONTACT_WORTHY_OPPORTUNITY'
  )),
  report text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT opportunity_prior_work_snapshot_unique UNIQUE (opportunity_id, input_snapshot_sha256)
);
CREATE INDEX IF NOT EXISTS opportunity_prior_work_created_idx
  ON opportunity_prior_work_reconciliations(opportunity_id, created_at);
