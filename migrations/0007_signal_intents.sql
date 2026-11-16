CREATE TABLE IF NOT EXISTS signal_intents (
 id text PRIMARY KEY,
 signal_id text REFERENCES signals(id) ON DELETE CASCADE,
 observation_id text REFERENCES footprint_observations(id) ON DELETE CASCADE,
 project_id text NOT NULL REFERENCES projects(id),
 direction text NOT NULL CHECK (direction IN ('need','capability','offer')),
 intent_type text NOT NULL CHECK (intent_type IN ('technical-integration','validation','technical-review','user-testing','distribution')),
 scope text NOT NULL,
 extraction_rule text NOT NULL,
 verification text NOT NULL,
 source_url text NOT NULL,
 revision text NOT NULL,
 observed_at timestamptz NOT NULL,
 CHECK ((signal_id IS NULL) <> (observation_id IS NULL))
);
CREATE INDEX IF NOT EXISTS signal_intents_scope_idx ON signal_intents(scope, direction);
CREATE INDEX IF NOT EXISTS signal_intents_project_idx ON signal_intents(project_id);
CREATE INDEX IF NOT EXISTS signal_intents_observation_idx ON signal_intents(observation_id);
