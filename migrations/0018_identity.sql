CREATE TABLE app_users (
  id uuid PRIMARY KEY,
  organizer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_memberships (
  project_id text NOT NULL REFERENCES projects(id),
  user_id uuid NOT NULL REFERENCES app_users(id),
  role text NOT NULL CHECK (role IN ('owner', 'maintainer')),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_memberships_user_idx ON project_memberships(user_id);
CREATE TABLE ownership_claims (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  user_id uuid NOT NULL REFERENCES app_users(id),
  repository text NOT NULL,
  method text NOT NULL CHECK (method IN ('personal', 'organization', 'review')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'revoked')),
  evidence text NOT NULL,
  reviewer_id uuid REFERENCES app_users(id),
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ownership_claims_project_idx ON ownership_claims(project_id);
CREATE TABLE authorization_audit (
  id serial PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES app_users(id),
  project_id text REFERENCES projects(id),
  action text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER authorization_audit_append_only BEFORE UPDATE OR DELETE ON authorization_audit
  FOR EACH ROW EXECUTE FUNCTION reject_follow_up_history_mutation();
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_audit ENABLE ROW LEVEL SECURITY;
