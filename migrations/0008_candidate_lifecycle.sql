CREATE TABLE IF NOT EXISTS candidate_capabilities (
 id text PRIMARY KEY,
 opportunity_id text NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
 capability_key text NOT NULL,
 capability text NOT NULL,
 consumer_project_id text NOT NULL REFERENCES projects(id),
 provider_project_id text NOT NULL REFERENCES projects(id),
 lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('proposed','in_progress','demonstrated_in_wild','adopted','superseded','stale_offer','unknown')),
 compatibility_state text NOT NULL CHECK (compatibility_state IN ('unknown','compatible','partially_compatible','incompatible')),
 freshness text NOT NULL CHECK (freshness IN ('current','partial','unresolved')),
 summary text NOT NULL,
 uncertainty text NOT NULL,
 next_action text NOT NULL,
 last_verified_at timestamptz,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CONSTRAINT candidate_capabilities_opportunity_key UNIQUE (opportunity_id, capability_key)
);
CREATE INDEX IF NOT EXISTS candidate_capabilities_projects_idx ON candidate_capabilities(consumer_project_id, provider_project_id);
CREATE INDEX IF NOT EXISTS candidate_capabilities_lifecycle_idx ON candidate_capabilities(lifecycle_state, freshness);

CREATE TABLE IF NOT EXISTS lifecycle_verification_runs (
 id text PRIMARY KEY,
 capability_id text NOT NULL REFERENCES candidate_capabilities(id) ON DELETE CASCADE,
 checked_at timestamptz NOT NULL,
 result text NOT NULL CHECK (result IN ('complete','partial','contradictory','unavailable')),
 freshness text NOT NULL CHECK (freshness IN ('current','partial','unresolved')),
 prior_lifecycle text NOT NULL CHECK (prior_lifecycle IN ('proposed','in_progress','demonstrated_in_wild','adopted','superseded','stale_offer','unknown')),
 evaluated_lifecycle text NOT NULL CHECK (evaluated_lifecycle IN ('proposed','in_progress','demonstrated_in_wild','adopted','superseded','stale_offer','unknown')),
 method text NOT NULL,
 queries text NOT NULL,
 conclusion text NOT NULL,
 limitations text NOT NULL,
 next_action text NOT NULL,
 source_count integer NOT NULL CHECK (source_count >= 0)
);
CREATE INDEX IF NOT EXISTS lifecycle_verification_runs_capability_idx ON lifecycle_verification_runs(capability_id, checked_at);

CREATE TABLE IF NOT EXISTS lifecycle_evidence (
 id text PRIMARY KEY,
 capability_id text NOT NULL REFERENCES candidate_capabilities(id) ON DELETE CASCADE,
 verification_run_id text NOT NULL REFERENCES lifecycle_verification_runs(id) ON DELETE CASCADE,
 evidence_type text NOT NULL CHECK (evidence_type IN ('maintainer_report','code_observed','executed_demo','independent_verification','external_adoption','human_offer','status_update')),
 source_url text NOT NULL,
 revision text,
 path text,
 line integer,
 published_at timestamptz,
 checked_at timestamptz NOT NULL,
 excerpt text NOT NULL,
 conclusion text NOT NULL,
 verification text NOT NULL,
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS lifecycle_evidence_capability_idx ON lifecycle_evidence(capability_id, checked_at);
CREATE INDEX IF NOT EXISTS lifecycle_evidence_run_idx ON lifecycle_evidence(verification_run_id);
