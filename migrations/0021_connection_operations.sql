CREATE TABLE connection_operations (
  opportunity_id text PRIMARY KEY REFERENCES opportunities(id) ON DELETE RESTRICT,
  next_action text NOT NULL DEFAULT '',
  responsible_user_id uuid REFERENCES app_users(id),
  due_date date,
  watchlist boolean NOT NULL DEFAULT false,
  progress text NOT NULL DEFAULT 'open' CHECK (progress IN ('open','in-progress','blocked','done')),
  publication text NOT NULL DEFAULT 'private' CHECK (publication IN ('legacy','private','published')),
  reviewed_by uuid REFERENCES app_users(id),
  reviewed_at timestamptz,
  public_title text,
  public_summary text,
  public_source_url text,
  public_kind text CHECK (public_kind IN ('need','proposal','evidenced'))
);
ALTER TABLE connection_operations ENABLE ROW LEVEL SECURITY;
