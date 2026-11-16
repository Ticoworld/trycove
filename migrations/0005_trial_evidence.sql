CREATE TABLE IF NOT EXISTS trial_evidence_records (
 id text PRIMARY KEY, opportunity_id text REFERENCES opportunities(id), mode text NOT NULL, evidence_level integer NOT NULL,
 result text NOT NULL, receipt_sha256 text NOT NULL, receipt text NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS trial_evidence_opportunity_idx ON trial_evidence_records(opportunity_id,created_at);
