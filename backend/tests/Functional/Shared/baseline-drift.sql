-- What `doctrine:schema:update --dump-sql` proposes against a database built from the migrations on MySQL 8.0.
-- This is the recorded drift between the mappings and the production schema. It is NEVER applied: the production
-- database must not change. SchemaInvarianceTest.php (next to this file) fails when the proposal differs from
-- the statements below, so any mapping change by the restructure is caught.
-- Recorded 2026-10-05 on master 4b23610 (migrations from the repository; no production dump was available).
-- Updated by the entity move (item 0, step 0.5): the CREATE TABLE invoice_line lines are gone because the dead
-- InvoiceLine entity was deleted (no migration ever created its table, and its mapping was invalid). The two lines
-- left are the columns mapped as json but created as DC2Type:array; they stay as they are on purpose.
ALTER TABLE user CHANGE roles roles JSON NOT NULL;
ALTER TABLE warehouse CHANGE urls urls JSON NOT NULL;
