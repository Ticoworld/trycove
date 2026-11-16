CREATE TABLE IF NOT EXISTS technical_footprints (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), repository text NOT NULL, revision text NOT NULL,
 analyzer_version text NOT NULL, scope text NOT NULL, analyzed_at timestamptz NOT NULL, unknowns text NOT NULL,
 file_count integer NOT NULL, status text NOT NULL
);
CREATE TABLE IF NOT EXISTS footprint_observations (
 id text PRIMARY KEY, footprint_id text NOT NULL REFERENCES technical_footprints(id), project_id text NOT NULL REFERENCES projects(id),
 repository text NOT NULL, revision text NOT NULL, path text NOT NULL, start_line integer NOT NULL, end_line integer NOT NULL,
 dimension text NOT NULL, kind text NOT NULL, fact text NOT NULL, evidence text NOT NULL, verification text NOT NULL, unknowns text NOT NULL
);
CREATE INDEX IF NOT EXISTS footprint_project_idx ON technical_footprints(project_id, analyzed_at);
CREATE INDEX IF NOT EXISTS footprint_observation_idx ON footprint_observations(footprint_id);
