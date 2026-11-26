CREATE TABLE playground_handoffs (
  digest text PRIMARY KEY,
  resource_id text NOT NULL REFERENCES prepared_resources(id),
  session_id text NOT NULL REFERENCES guided_trial_sessions(id),
  application_origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE UNIQUE INDEX playground_handoffs_resource ON playground_handoffs(resource_id);
ALTER TABLE playground_handoffs ENABLE ROW LEVEL SECURITY;
