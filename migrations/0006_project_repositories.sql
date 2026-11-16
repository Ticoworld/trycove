CREATE TABLE IF NOT EXISTS project_repositories (
 id text PRIMARY KEY,
 project_id text NOT NULL REFERENCES projects(id),
 repository text NOT NULL,
 role text NOT NULL,
 source_url text NOT NULL,
 revision text NOT NULL,
 verification text NOT NULL,
 observed_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS project_repositories_project_idx ON project_repositories(project_id, repository);
