CREATE TABLE project_declarations (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  author_id uuid NOT NULL REFERENCES app_users(id),
  kind text NOT NULL CHECK (kind IN ('testing-need','product-need','capability')),
  content text NOT NULL,
  prerequisites text NOT NULL DEFAULT '',
  provenance text NOT NULL DEFAULT 'authenticated-builder' CHECK (provenance = 'authenticated-builder'),
  state text NOT NULL CHECK (state IN ('published','withdrawn')),
  moderation text NOT NULL DEFAULT 'visible' CHECK (moderation IN ('visible','hidden')),
  supersedes_id uuid UNIQUE REFERENCES project_declarations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_declarations_project_idx ON project_declarations(project_id, created_at);
CREATE TABLE trial_participations (
  session_id text PRIMARY KEY REFERENCES guided_trial_sessions(id),
  user_id uuid NOT NULL REFERENCES app_users(id),
  consented_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE feedback_listing_consents (
  report_id text PRIMARY KEY REFERENCES handoff_reports(id),
  consented_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE project_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_listing_consents ENABLE ROW LEVEL SECURITY;
