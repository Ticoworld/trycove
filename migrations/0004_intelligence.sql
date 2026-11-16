CREATE TABLE IF NOT EXISTS intelligence_runs (
 id text PRIMARY KEY, created_at timestamptz NOT NULL, summary text NOT NULL
);
CREATE TABLE IF NOT EXISTS intelligence_assessments (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES intelligence_runs(id), opportunity_id text NOT NULL REFERENCES opportunities(id),
 consumer_footprint_id text NOT NULL REFERENCES technical_footprints(id), provider_footprint_id text NOT NULL REFERENCES technical_footprints(id),
 conclusion text NOT NULL, findings text NOT NULL, created_at timestamptz NOT NULL
);
