CREATE TABLE IF NOT EXISTS external_source_snapshots (
  id text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('ckbdapps-json','ckb-pulse-state','ckb-pulse-repo','github-repository-identity')),
  key text NOT NULL,
  requested_url text NOT NULL,
  canonical_url text,
  source_revision text,
  etag text,
  content_sha256 text CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('ok','not_modified','not_followed','unavailable','invalid')),
  raw text,
  error text,
  checked_at timestamptz NOT NULL,
  fetched_at timestamptz,
  CHECK ((status IN ('ok','not_modified') AND content_sha256 IS NOT NULL) OR status NOT IN ('ok','not_modified'))
);
CREATE INDEX IF NOT EXISTS external_source_snapshots_source_key_idx
  ON external_source_snapshots(source, key, checked_at DESC);
CREATE INDEX IF NOT EXISTS external_source_snapshots_hash_idx
  ON external_source_snapshots(content_sha256);
