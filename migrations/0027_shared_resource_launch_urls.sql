-- Resource IDs identify allocations; several resources may launch the same app.
DROP INDEX prepared_resources_launch_unique;
-- Existing integrated inventory is unverified and must not be allocated.
ALTER TABLE prepared_resources ADD COLUMN provider_ready boolean NOT NULL DEFAULT false;
