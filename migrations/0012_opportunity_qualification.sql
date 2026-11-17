CREATE TABLE IF NOT EXISTS opportunity_qualification_reviews (
  id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  input_snapshot_sha256 text NOT NULL CHECK (input_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('QUALIFIED','NEEDS_CONFIRMATION','ALREADY_ADDRESSED','REJECTED','BLOCKED','NO_QUALIFIED_PILOT')),
  action_status text NOT NULL CHECK (action_status IN ('NOT_SENT_AWAITING_USER_APPROVAL','NO_QUALIFIED_PILOT')),
  review text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT opportunity_qualification_snapshot_unique UNIQUE (opportunity_id, input_snapshot_sha256)
);
CREATE INDEX IF NOT EXISTS opportunity_qualification_created_idx
  ON opportunity_qualification_reviews(opportunity_id, created_at);
