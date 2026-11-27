CREATE TABLE trial_resource_claim_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
CREATE INDEX trial_resource_claim_limits_window_idx ON trial_resource_claim_limits(window_started_at);
