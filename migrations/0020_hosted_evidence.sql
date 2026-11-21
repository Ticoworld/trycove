CREATE TABLE historical_feedback (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  project_id text NOT NULL REFERENCES projects(id),
  export_json text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER historical_feedback_append_only BEFORE UPDATE OR DELETE ON historical_feedback
  FOR EACH ROW EXECUTE FUNCTION reject_follow_up_history_mutation();

DO $$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', entry.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND
     EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END
$$;
