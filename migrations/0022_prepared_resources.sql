CREATE TABLE prepared_resources (
  id text PRIMARY KEY,
  pack_id text NOT NULL,
  pack_version integer NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('environment','identity','access')),
  launch_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  assigned_session_id text REFERENCES guided_trial_sessions(id),
  expires_at timestamptz,
  FOREIGN KEY (pack_id, pack_version) REFERENCES trial_pack_versions(pack_id, version),
  CHECK ((assigned_session_id IS NULL) = (expires_at IS NULL))
);
CREATE UNIQUE INDEX prepared_resources_session_unique ON prepared_resources(assigned_session_id) WHERE assigned_session_id IS NOT NULL;
CREATE UNIQUE INDEX prepared_resources_launch_unique ON prepared_resources(launch_url);
CREATE INDEX prepared_resources_pool ON prepared_resources(pack_id, pack_version, enabled);
ALTER TABLE prepared_resources ENABLE ROW LEVEL SECURITY;
