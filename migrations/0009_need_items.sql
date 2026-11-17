CREATE TABLE IF NOT EXISTS need_items (
 id text PRIMARY KEY,
 signal_id text NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
 project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 source_url text NOT NULL,
 revision text NOT NULL,
 observed_at timestamptz NOT NULL,
 excerpt text NOT NULL,
 category text NOT NULL CHECK (category IN ('user-testing','adoption','technical-review','security','product-feedback','technical-integration','infrastructure','distribution','unknown')),
 stance text NOT NULL CHECK (stance IN ('explicit-request','reported-obstacle','roadmap','status-update','ambiguous')),
 verification text NOT NULL,
 extraction_rule text NOT NULL,
 start_offset integer NOT NULL CHECK (start_offset >= 0),
 end_offset integer NOT NULL CHECK (end_offset >= start_offset)
);
CREATE INDEX IF NOT EXISTS need_items_project_idx ON need_items(project_id, observed_at);
CREATE INDEX IF NOT EXISTS need_items_signal_idx ON need_items(signal_id);
CREATE INDEX IF NOT EXISTS need_items_category_idx ON need_items(category, stance);
