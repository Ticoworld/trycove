CREATE TABLE IF NOT EXISTS source_records (id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), source text NOT NULL, source_url text NOT NULL, revision text NOT NULL, raw text NOT NULL, observed_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS signals (id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), kind text NOT NULL, concept text NOT NULL, claim text NOT NULL, source_url text NOT NULL, revision text NOT NULL, verification text NOT NULL, observed_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS signals_project_idx ON signals(project_id);
