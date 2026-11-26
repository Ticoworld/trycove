ALTER TABLE prepared_resources ADD COLUMN retired boolean NOT NULL DEFAULT false;
-- Earlier versions did not retain exposure history, so existing identities
-- cannot safely be distinguished from previously disclosed identities.
UPDATE prepared_resources SET retired = true, enabled = false WHERE kind = 'identity';
