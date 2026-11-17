-- Need atoms outlive replaceable source-signal rows. Source revision changes append
-- a new atom and mark the previous one as superseded instead of deleting history.
ALTER TABLE need_items ALTER COLUMN signal_id DROP NOT NULL;
ALTER TABLE need_items DROP CONSTRAINT IF EXISTS need_items_signal_id_fkey;
ALTER TABLE need_items ADD CONSTRAINT need_items_signal_id_fkey
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL;
ALTER TABLE need_items DROP CONSTRAINT IF EXISTS need_items_stance_check;
ALTER TABLE need_items ADD CONSTRAINT need_items_stance_check
  CHECK (stance IN ('explicit-request','reported-obstacle','explicit-offer','roadmap','status-update','ambiguous'));

ALTER TABLE need_items ADD COLUMN IF NOT EXISTS source_claim text NOT NULL DEFAULT '';
ALTER TABLE need_items ADD COLUMN IF NOT EXISTS lineage_key text NOT NULL DEFAULT '';
ALTER TABLE need_items ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE need_items ADD COLUMN IF NOT EXISTS superseded_by text;
UPDATE need_items n SET source_claim=s.claim
FROM signals s WHERE n.signal_id=s.id AND n.source_claim='';
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY source_url, md5(excerpt) ORDER BY start_offset, id) AS occurrence
  FROM need_items WHERE lineage_key=''
)
UPDATE need_items n SET lineage_key=n.source_url || '#need#' || md5(n.excerpt) || '#' || numbered.occurrence
FROM numbered WHERE n.id=numbered.id AND n.lineage_key='';
ALTER TABLE need_items ALTER COLUMN source_claim DROP DEFAULT;
CREATE INDEX IF NOT EXISTS need_items_lineage_idx ON need_items(lineage_key);
CREATE INDEX IF NOT EXISTS need_items_current_idx ON need_items(project_id, superseded_at);

ALTER TABLE signal_intents ADD COLUMN IF NOT EXISTS need_item_id text;
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_check;
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_source_check;
ALTER TABLE signal_intents ADD CONSTRAINT signal_intents_source_check CHECK (
  (signal_id IS NOT NULL AND observation_id IS NULL AND need_item_id IS NULL) OR
  (signal_id IS NULL AND observation_id IS NOT NULL AND need_item_id IS NULL) OR
  (signal_id IS NULL AND observation_id IS NULL AND need_item_id IS NOT NULL)
);
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_intent_type_check;
ALTER TABLE signal_intents ADD CONSTRAINT signal_intents_intent_type_check
  CHECK (intent_type IN ('technical-integration','validation','technical-review','user-testing','distribution','adoption','product-feedback','security-review'));
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_signal_id_fkey;
ALTER TABLE signal_intents ADD CONSTRAINT signal_intents_signal_id_fkey
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL;
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_observation_id_fkey;
ALTER TABLE signal_intents ADD CONSTRAINT signal_intents_observation_id_fkey
  FOREIGN KEY (observation_id) REFERENCES footprint_observations(id) ON DELETE SET NULL;
ALTER TABLE signal_intents DROP CONSTRAINT IF EXISTS signal_intents_need_item_id_fkey;
ALTER TABLE signal_intents ADD CONSTRAINT signal_intents_need_item_id_fkey
  FOREIGN KEY (need_item_id) REFERENCES need_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS signal_intents_need_item_idx ON signal_intents(need_item_id);

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS need_item_id text;
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_need_item_id_fkey;
ALTER TABLE evidence ADD CONSTRAINT evidence_need_item_id_fkey
  FOREIGN KEY (need_item_id) REFERENCES need_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS evidence_need_item_idx ON evidence(need_item_id);

-- A no-provider conclusion is a valid saved decision. NULL means the engine
-- searched its provider inventory and abstained; it is not a self-match.
ALTER TABLE opportunities ALTER COLUMN project_b DROP NOT NULL;
